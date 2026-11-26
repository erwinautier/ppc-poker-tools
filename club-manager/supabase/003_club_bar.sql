-- ════════════════════════════════════════════════════════════════════════════
--  PPC · Le Club : la buvette
--
--  À exécuter UNE FOIS dans l'éditeur SQL, après 001_club.sql et 002_club_accounts.sql.
--  Le script peut être relancé sans risque : il ne supprime aucune donnée.
--
--  Tous les montants sont en centimes. Aucune table n'est accessible directement :
--  tout passe par les fonctions, qui appliquent les règles.
--
--   · chacun note et voit sa propre ardoise ;
--   · l'équipe (gestionnaires, administrateurs, trésorerie) voit tout et relance ;
--   · la trésorerie et les administrateurs valident les paiements, jamais le leur ;
--   · la tablette du comptoir a une clé : elle note, et ne voit que la soirée.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── Tables ──────────────────────────────────────────────────────────────────

alter table public.club_members add column if not exists treasurer boolean not null default false;

create table if not exists public.club_bar_items (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 1 and 30),
  emoji      text not null default '' check (char_length(emoji) <= 8),
  price      int  not null check (price between 0 and 10000),
  active     boolean not null default true,
  sort       int  not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.club_bar_kiosks (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 1 and 40),
  key_hash   text not null unique,
  created_by uuid references public.club_members (id) on delete set null,
  created_at timestamptz not null default now(),
  used_at    timestamptz,
  revoked_at timestamptz
);

-- Une conso, ou une correction (item_id nul, montant positif ou négatif). Le prix est
-- celui du moment. Une fiche supprimée laisse ses lignes, anonymes, pour le bilan.
create table if not exists public.club_bar_lines (
  id           uuid primary key,
  member_id    uuid references public.club_members (id) on delete set null,
  item_id      uuid references public.club_bar_items (id),
  label        text not null,
  price        int  not null check (price between -100000 and 100000),
  guest        boolean not null default false,
  by_member    uuid references public.club_members (id) on delete set null,
  by_kiosk     uuid references public.club_bar_kiosks (id) on delete set null,
  created_at   timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by uuid references public.club_members (id) on delete set null
);
create index if not exists club_bar_lines_member on public.club_bar_lines (member_id, created_at);
create index if not exists club_bar_lines_date on public.club_bar_lines (created_at);

create table if not exists public.club_bar_payments (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid references public.club_members (id) on delete set null,
  amount      int  not null check (amount between 1 and 100000),
  method      text not null check (method in ('cash', 'transfer', 'other')),
  status      text not null default 'pending' check (status in ('pending', 'validated', 'refused')),
  declared_by uuid references public.club_members (id) on delete set null,
  decided_by  uuid references public.club_members (id) on delete set null,
  created_at  timestamptz not null default now(),
  decided_at  timestamptz
);
create index if not exists club_bar_payments_member on public.club_bar_payments (member_id, created_at);

create table if not exists public.club_bar_reminders (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references public.club_members (id) on delete cascade,
  amount     int  not null,
  by_member  uuid references public.club_members (id) on delete set null,
  created_at timestamptz not null default now(),
  seen_at    timestamptz
);
create index if not exists club_bar_reminders_member on public.club_bar_reminders (member_id, created_at);

-- Une seule ligne ; « rev » prévient les écrans qu'il faut relire.
create table if not exists public.club_bar_settings (
  id       boolean primary key default true check (id),
  alert    int  not null default 2000 check (alert between 0 and 100000),
  days     int  not null default 30 check (days between 1 and 365),
  pay_info text not null default 'Espèces dans la caisse, ou virement au club.' check (char_length(pay_info) <= 200),
  rev      bigint not null default 0
);
insert into public.club_bar_settings (id) values (true) on conflict do nothing;

alter table public.club_bar_items     enable row level security;
alter table public.club_bar_kiosks    enable row level security;
alter table public.club_bar_lines     enable row level security;
alter table public.club_bar_payments  enable row level security;
alter table public.club_bar_reminders enable row level security;
alter table public.club_bar_settings  enable row level security;

revoke all on public.club_bar_items, public.club_bar_kiosks, public.club_bar_lines,
  public.club_bar_payments, public.club_bar_reminders, public.club_bar_settings from anon, authenticated;

-- Seule lecture directe : les réglages, pour le signal du temps réel.
drop policy if exists club_bar_settings_read on public.club_bar_settings;
create policy club_bar_settings_read on public.club_bar_settings for select to authenticated
  using ((select public.club_is_member()));
grant select on public.club_bar_settings to authenticated;

-- ── Qui est qui ─────────────────────────────────────────────────────────────

create or replace function public.club_bar_me() returns public.club_members
language plpgsql stable security definer set search_path = '' as $$
declare m public.club_members;
begin
  select * into m from public.club_members x where x.user_id = auth.uid() and x.active;
  if not found then raise exception 'Réservé aux adhérents connectés.'; end if;
  return m;
end $$;

create or replace function public.club_bar_manager(m public.club_members) returns boolean
language sql immutable set search_path = '' as $$ select m.role in ('director', 'admin') or m.treasurer $$;

create or replace function public.club_bar_validator(m public.club_members) returns boolean
language sql immutable set search_path = '' as $$ select m.role = 'admin' or m.treasurer $$;

create or replace function public.club_bar_need_manager() returns public.club_members
language plpgsql stable security definer set search_path = '' as $$
declare m public.club_members := public.club_bar_me();
begin
  if not public.club_bar_manager(m) then raise exception 'Action réservée aux gestionnaires et à la trésorerie.'; end if;
  return m;
end $$;

create or replace function public.club_bar_need_validator() returns public.club_members
language plpgsql stable security definer set search_path = '' as $$
declare m public.club_members := public.club_bar_me();
begin
  if not public.club_bar_validator(m) then raise exception 'Seuls la trésorerie et les administrateurs valident les paiements.'; end if;
  return m;
end $$;

-- Personne ne valide son propre paiement, sauf s'il est seul à pouvoir valider.
create or replace function public.club_bar_not_mine(p_member uuid, me public.club_members) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_member = me.id and exists (
    select 1 from public.club_members m
    where m.id <> me.id and m.active and m.user_id is not null and public.club_bar_validator(m)
  ) then
    raise exception 'Quelqu''un d''autre doit valider ton propre paiement.';
  end if;
end $$;

-- La clé de la tablette : seule son empreinte est gardée.
create or replace function public.club_bar_kiosk(p_key text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare k uuid;
begin
  select x.id into k from public.club_bar_kiosks x
  where x.revoked_at is null and x.key_hash = encode(sha256(convert_to(coalesce(p_key, ''), 'UTF8')), 'hex');
  if k is null then raise exception 'Cet accès au comptoir n''est plus valable.'; end if;
  update public.club_bar_kiosks set used_at = now() where id = k and (used_at is null or used_at < now() - interval '5 minutes');
  return k;
end $$;

-- La soirée en cours commence à midi, heure de Paris.
create or replace function public.club_bar_evening() returns timestamptz
language sql stable set search_path = '' as $$
  select (date_trunc('day', (now() at time zone 'Europe/Paris') - interval '12 hours') + interval '12 hours') at time zone 'Europe/Paris'
$$;

-- ── Déclencheurs ────────────────────────────────────────────────────────────

-- La trésorerie se confie par un administrateur ; sa fiche est protégée, comme celle
-- d'un gestionnaire. Une fiche qui a une ardoise ne se supprime pas.
create or replace function public.club_members_treasurer() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not public.club_is_admin() then
    if tg_op <> 'INSERT' and old.treasurer then
      raise exception 'Seul un administrateur peut modifier la fiche de la trésorerie.';
    elsif tg_op <> 'DELETE' and new.treasurer then
      raise exception 'Seul un administrateur confie la trésorerie.';
    end if;
  end if;
  if tg_op = 'DELETE' then
    if exists (select 1 from public.club_bar_slates(old.id) s where s.taken <> s.paid or s.pending <> 0) then
      raise exception 'Cette fiche a une ardoise à la buvette : solde-la d''abord, ou passe-la en ancien adhérent.';
    end if;
    return old;
  end if;
  return new;
end $$;

drop trigger if exists club_members_treasurer on public.club_members;
create trigger club_members_treasurer before insert or update or delete on public.club_members
  for each row execute function public.club_members_treasurer();

create or replace function public.club_bar_touch() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.club_bar_settings set rev = rev + 1 where id;
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['club_bar_items', 'club_bar_lines', 'club_bar_payments', 'club_bar_reminders'] loop
    execute format('drop trigger if exists club_bar_touch on public.%I', t);
    execute format('create trigger club_bar_touch after insert or update or delete on public.%I for each statement execute function public.club_bar_touch()', t);
  end loop;
end $$;

-- ── Ardoises ────────────────────────────────────────────────────────────────

-- Les paiements, déclarés compris, éteignent les consos les plus anciennes d'abord :
-- « since » est la première qui n'est pas couverte.
create or replace function public.club_bar_slates(p_member uuid default null)
returns table (member_id uuid, name text, active boolean, account boolean, taken int, paid int, pending int,
               since timestamptz, last timestamptz, reminder jsonb)
language sql stable security definer set search_path = '' as $$
  with l as (
    select x.member_id, x.price, x.item_id, x.created_at,
           sum(greatest(x.price, 0)) over (partition by x.member_id order by x.created_at, x.id) as run
    from public.club_bar_lines x
    where x.cancelled_at is null and x.member_id is not null and (p_member is null or x.member_id = p_member)
  ), taken as (
    select l.member_id, sum(l.price) as total, coalesce(sum(-l.price) filter (where l.price < 0), 0) as credit,
           max(l.created_at) filter (where l.item_id is not null) as last
    from l group by l.member_id
  ), pays as (
    select p.member_id, coalesce(sum(p.amount) filter (where p.status = 'validated'), 0) as paid,
           coalesce(sum(p.amount) filter (where p.status = 'pending'), 0) as pending
    from public.club_bar_payments p
    where p.member_id is not null and (p_member is null or p.member_id = p_member)
    group by p.member_id
  ), s as (
    select m.id, m.name, m.active, m.user_id is not null as account,
           coalesce(t.total, 0)::int as taken, coalesce(y.paid, 0)::int as paid, coalesce(y.pending, 0)::int as pending,
           coalesce(t.credit, 0) as credit, t.last
    from public.club_members m
    left join taken t on t.member_id = m.id
    left join pays y on y.member_id = m.id
    where (p_member is null and (t.member_id is not null or y.member_id is not null)) or m.id = p_member
  )
  select s.id, s.name, s.active, s.account, s.taken, s.paid, s.pending,
    case when s.taken - s.paid - s.pending > 0 then
      (select min(l.created_at) from l where l.member_id = s.id and l.price > 0 and l.run > s.paid + s.pending + s.credit) end,
    s.last,
    case when s.taken > s.paid then
      (select jsonb_build_object('created_at', r.created_at, 'seen_at', r.seen_at) from public.club_bar_reminders r
       where r.member_id = s.id order by r.created_at desc, r.id limit 1) end
  from s
$$;

create or replace function public.club_bar_lines_json(p_member uuid, p_limit int) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x.j order by x.created_at desc), '[]'::jsonb) from (
    select l.created_at, jsonb_build_object('id', l.id, 'item_id', l.item_id, 'label', l.label, 'price', l.price, 'guest', l.guest,
      'created_at', l.created_at, 'cancelled_at', l.cancelled_at,
      'by', case when l.by_kiosk is not null then 'le comptoir' when l.by_member is distinct from l.member_id then coalesce(m.name, 'le comptoir') end) as j
    from public.club_bar_lines l left join public.club_members m on m.id = l.by_member
    where l.member_id = p_member order by l.created_at desc limit p_limit
  ) x
$$;

create or replace function public.club_bar_payments_json(p_member uuid, p_status text, p_limit int) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x.j order by x.created_at desc), '[]'::jsonb) from (
    select p.created_at, jsonb_build_object('id', p.id, 'member_id', p.member_id, 'name', m.name, 'amount', p.amount, 'method', p.method,
      'status', p.status, 'created_at', p.created_at, 'decided_at', p.decided_at, 'decided_by', d.name) as j
    from public.club_bar_payments p
    join public.club_members m on m.id = p.member_id
    left join public.club_members d on d.id = p.decided_by
    where (p_member is null or p.member_id = p_member) and (p_status is null or p.status = p_status)
    order by p.created_at desc limit p_limit
  ) x
$$;

create or replace function public.club_bar_items_json() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name, 'emoji', i.emoji, 'price', i.price, 'active', i.active, 'sort', i.sort) order by i.sort, i.created_at), '[]'::jsonb)
  from public.club_bar_items i
$$;

create or replace function public.club_bar_load() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me public.club_members := public.club_bar_me();
  v_manage boolean := public.club_bar_manager(me);
begin
  return jsonb_build_object(
    'items', public.club_bar_items_json(),
    'settings', (select jsonb_build_object('alert', s.alert, 'days', s.days, 'payInfo', s.pay_info) from public.club_bar_settings s),
    'manage', v_manage,
    'validate', public.club_bar_validator(me),
    'slate', (select to_jsonb(s) from public.club_bar_slates(me.id) s),
    'lines', public.club_bar_lines_json(me.id, 60),
    'payments', public.club_bar_payments_json(me.id, null, 30),
    'team', case when v_manage then jsonb_build_object(
      'slates', (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from public.club_bar_slates() s),
      'pending', public.club_bar_payments_json(null, 'pending', 200)) end
  );
end $$;

create or replace function public.club_bar_detail(p_member uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.club_bar_need_manager();
  return jsonb_build_object('lines', public.club_bar_lines_json(p_member, 60), 'payments', public.club_bar_payments_json(p_member, null, 30));
end $$;

-- Ventes par produit. Les corrections et les consos annulées ne sont pas des ventes.
create or replace function public.club_bar_report(p_from timestamptz) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.club_bar_need_manager();
  return coalesce((
    select jsonb_agg(jsonb_build_object('label', x.name, 'count', x.n, 'amount', x.amount, 'guests', x.guests) order by x.amount desc, x.name)
    from (
      select i.name, count(*) as n, sum(l.price) as amount, count(*) filter (where l.guest) as guests
      from public.club_bar_lines l join public.club_bar_items i on i.id = l.item_id
      where l.cancelled_at is null and l.created_at >= p_from
      group by i.id, i.name
    ) x
  ), '[]'::jsonb);
end $$;

-- ── Consommer ───────────────────────────────────────────────────────────────

create or replace function public.club_bar_counter(p_key text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if p_key is null then perform public.club_bar_need_manager(); else perform public.club_bar_kiosk(p_key); end if;
  return jsonb_build_object(
    'items', public.club_bar_items_json(),
    'people', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name)), '[]'::jsonb) from public.club_members m where m.active),
    'tally', (select coalesce(jsonb_agg(jsonb_build_object('member_id', x.member_id, 'item_id', x.item_id, 'n', x.n)), '[]'::jsonb) from (
      select l.member_id, l.item_id, count(*) as n from public.club_bar_lines l
      where l.cancelled_at is null and l.item_id is not null and l.member_id is not null and l.created_at >= public.club_bar_evening()
      group by l.member_id, l.item_id) x)
  );
end $$;

-- p_id vient de l'appareil : renvoyer la même conso après une coupure ne la double pas.
create or replace function public.club_bar_take(
  p_id uuid, p_member uuid, p_item uuid, p_guest boolean default false, p_at timestamptz default null, p_key text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.club_members;
  k uuid;
  i public.club_bar_items;
begin
  if p_key is not null then k := public.club_bar_kiosk(p_key);
  else
    me := public.club_bar_me();
    if me.id <> p_member and not public.club_bar_manager(me) then raise exception 'Tu ne peux noter que tes propres consommations.'; end if;
  end if;
  if exists (select 1 from public.club_bar_lines l where l.id = p_id) then return; end if;
  if not exists (select 1 from public.club_members m where m.id = p_member and m.active) then raise exception 'Cet adhérent n''existe plus.'; end if;
  select * into i from public.club_bar_items x where x.id = p_item;
  if not found then raise exception 'Introuvable : recharge la page.'; end if;
  if not i.active then raise exception 'Ce produit n''est plus proposé.'; end if;
  insert into public.club_bar_lines (id, member_id, item_id, label, price, guest, by_member, by_kiosk, created_at)
  values (p_id, p_member, i.id, i.name, i.price, coalesce(p_guest, false), me.id, k,
          least(greatest(coalesce(p_at, now()), now() - interval '3 days'), now()))
  on conflict (id) do nothing;
end $$;

create or replace function public.club_bar_undo(p_line uuid, p_key text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.club_members;
  k uuid;
  l public.club_bar_lines;
begin
  if p_key is not null then k := public.club_bar_kiosk(p_key); else me := public.club_bar_me(); end if;
  select * into l from public.club_bar_lines x where x.id = p_line for update;
  if not found or (k is not null and l.by_kiosk is distinct from k) then raise exception 'Introuvable : recharge la page.'; end if;
  if k is null and l.member_id is distinct from me.id and not public.club_bar_manager(me) then
    raise exception 'Tu ne peux annuler que tes propres consommations.';
  end if;
  -- Une correction : trésorerie et administrateurs, jamais la sienne.
  if l.item_id is null then
    perform public.club_bar_need_validator();
    perform public.club_bar_not_mine(l.member_id, me);
  -- Sur sa propre ardoise et au comptoir, dix minutes, y compris pour l'équipe.
  elsif (k is not null or l.member_id = me.id) and l.created_at < now() - interval '10 minutes' then
    raise exception 'Passé 10 minutes, demande à quelqu''un d''autre de l''équipe.';
  end if;
  update public.club_bar_lines set cancelled_at = now(), cancelled_by = me.id where id = p_line and cancelled_at is null;
end $$;

-- ── Payer ───────────────────────────────────────────────────────────────────

create or replace function public.club_bar_declare(p_amount int, p_method text) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.club_members := public.club_bar_me();
begin
  if p_amount is null or p_amount not between 1 and 100000 then raise exception 'Montant invalide.'; end if;
  insert into public.club_bar_payments (member_id, amount, method, declared_by) values (me.id, p_amount, p_method, me.id);
end $$;

create or replace function public.club_bar_withdraw(p_payment uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.club_members := public.club_bar_me();
begin
  delete from public.club_bar_payments p where p.id = p_payment and p.member_id = me.id and p.status = 'pending';
  if not found then raise exception 'Ce paiement ne peut plus être retiré.'; end if;
end $$;

create or replace function public.club_bar_decide(p_payment uuid, p_ok boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.club_members := public.club_bar_need_validator();
  p public.club_bar_payments;
begin
  select * into p from public.club_bar_payments x where x.id = p_payment for update;
  if not found then raise exception 'Introuvable : recharge la page.'; end if;
  if p.status <> 'pending' then raise exception 'Ce paiement est déjà traité.'; end if;
  if p_ok then perform public.club_bar_not_mine(p.member_id, me); end if;
  update public.club_bar_payments
  set status = case when p_ok then 'validated' else 'refused' end, decided_by = me.id, decided_at = now()
  where id = p_payment;
end $$;

create or replace function public.club_bar_receive(p_member uuid, p_amount int, p_method text) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.club_members := public.club_bar_need_validator();
begin
  if p_amount is null or p_amount not between 1 and 100000 then raise exception 'Montant invalide.'; end if;
  perform public.club_bar_not_mine(p_member, me);
  if not exists (select 1 from public.club_members m where m.id = p_member) then raise exception 'Cet adhérent n''existe plus.'; end if;
  insert into public.club_bar_payments (member_id, amount, method, status, declared_by, decided_by, decided_at)
  values (p_member, p_amount, p_method, 'validated', me.id, me.id, now());
end $$;

-- Reprise du tableau papier, erreur, geste : + ajoute à l'ardoise, - en retire.
create or replace function public.club_bar_adjust(p_member uuid, p_amount int, p_label text) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.club_members := public.club_bar_need_validator();
begin
  if p_amount is null or p_amount = 0 or p_amount not between -100000 and 100000 then raise exception 'Montant invalide.'; end if;
  if coalesce(btrim(p_label), '') = '' then raise exception 'Indique le motif.'; end if;
  if p_amount < 0 then perform public.club_bar_not_mine(p_member, me); end if;
  if not exists (select 1 from public.club_members m where m.id = p_member) then raise exception 'Cet adhérent n''existe plus.'; end if;
  insert into public.club_bar_lines (id, member_id, label, price, by_member)
  values (gen_random_uuid(), p_member, left(btrim(p_label), 60), p_amount, me.id);
end $$;

-- ── Relancer ────────────────────────────────────────────────────────────────

-- Rien à payer, pas de compte, ou un rappel pas encore vu : on n'insiste pas.
create or replace function public.club_bar_remind(p_members jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare
  me public.club_members := public.club_bar_need_manager();
  n int;
begin
  insert into public.club_bar_reminders (member_id, amount, by_member)
  select s.member_id, s.taken - s.paid - s.pending, me.id
  from (select distinct x.value::uuid as id from jsonb_array_elements_text(p_members) x) w
  cross join lateral public.club_bar_slates(w.id) s
  where s.active and s.account and s.taken - s.paid - s.pending > 0
    and (s.reminder is null or s.reminder ->> 'seen_at' is not null);
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.club_bar_seen() returns void
language plpgsql security definer set search_path = '' as $$
declare me public.club_members := public.club_bar_me();
begin
  update public.club_bar_reminders set seen_at = now() where member_id = me.id and seen_at is null;
end $$;

-- ── Réglages ────────────────────────────────────────────────────────────────

create or replace function public.club_bar_save_item(p_id uuid, p_name text, p_emoji text, p_price int, p_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.club_bar_need_manager();
  if coalesce(btrim(p_name), '') = '' then raise exception 'Indique le nom du produit.'; end if;
  if p_price is null or p_price not between 0 and 10000 then raise exception 'Prix invalide.'; end if;
  if p_id is null then
    insert into public.club_bar_items (name, emoji, price, active, sort)
    select left(btrim(p_name), 30), left(btrim(coalesce(p_emoji, '')), 8), p_price, coalesce(p_active, true), coalesce(max(i.sort), 0) + 1 from public.club_bar_items i;
  else
    update public.club_bar_items set name = left(btrim(p_name), 30), emoji = left(btrim(coalesce(p_emoji, '')), 8), price = p_price, active = coalesce(p_active, true)
    where id = p_id;
    if not found then raise exception 'Introuvable : recharge la page.'; end if;
  end if;
end $$;

create or replace function public.club_bar_move_item(p_id uuid, p_by int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.club_bar_need_manager();
  with o as (select i.id, row_number() over (order by i.sort, i.created_at) as n from public.club_bar_items i),
       a as (select o.n from o where o.id = p_id),
       b as (select o.n from o where o.n = (select a.n from a) + sign(p_by))
  update public.club_bar_items i set sort = case
      when o.n = (select a.n from a) then coalesce((select b.n from b), o.n)
      when o.n = (select b.n from b) then (select a.n from a)
      else o.n end
  from o where o.id = i.id;
end $$;

create or replace function public.club_bar_save_settings(p_alert int, p_days int, p_pay_info text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.club_bar_need_manager();
  if p_alert is null or p_alert not between 0 and 100000 or p_days is null or p_days not between 1 and 365 then raise exception 'Réglage invalide.'; end if;
  update public.club_bar_settings set alert = p_alert, days = p_days, pay_info = left(btrim(coalesce(p_pay_info, '')), 200), rev = rev + 1 where id;
end $$;

-- ── Tablettes du comptoir ───────────────────────────────────────────────────

create or replace function public.club_bar_need_staff() returns public.club_members
language plpgsql stable security definer set search_path = '' as $$
declare m public.club_members := public.club_bar_me();
begin
  if m.role not in ('director', 'admin') then raise exception 'Action réservée aux gestionnaires.'; end if;
  return m;
end $$;

create or replace function public.club_bar_kiosks() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.club_bar_need_staff();
  return coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'name', k.name, 'created_at', k.created_at, 'used_at', k.used_at) order by k.created_at)
    from public.club_bar_kiosks k where k.revoked_at is null), '[]'::jsonb);
end $$;

-- La clé n'est montrée qu'ici, une seule fois.
create or replace function public.club_bar_create_kiosk(p_name text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me public.club_members := public.club_bar_need_staff();
  k text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if coalesce(btrim(p_name), '') = '' then raise exception 'Donne un nom à cette tablette.'; end if;
  insert into public.club_bar_kiosks (name, key_hash, created_by)
  values (left(btrim(p_name), 40), encode(sha256(convert_to(k, 'UTF8')), 'hex'), me.id);
  return k;
end $$;

create or replace function public.club_bar_revoke_kiosk(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.club_bar_need_staff();
  update public.club_bar_kiosks set revoked_at = now() where id = p_id and revoked_at is null;
end $$;

-- ── Droits d'exécution : rien par défaut, puis le strict nécessaire ─────────
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and (p.proname like 'club\_bar\_%' or p.proname = 'club_members_treasurer') loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

grant execute on function public.club_bar_load(), public.club_bar_detail(uuid), public.club_bar_report(timestamptz),
  public.club_bar_declare(int, text), public.club_bar_withdraw(uuid), public.club_bar_decide(uuid, boolean),
  public.club_bar_receive(uuid, int, text), public.club_bar_adjust(uuid, int, text),
  public.club_bar_remind(jsonb), public.club_bar_seen(),
  public.club_bar_save_item(uuid, text, text, int, boolean), public.club_bar_move_item(uuid, int),
  public.club_bar_save_settings(int, int, text),
  public.club_bar_kiosks(), public.club_bar_create_kiosk(text), public.club_bar_revoke_kiosk(uuid) to authenticated;
-- La tablette n'a pas de compte : sa clé est vérifiée à chaque appel.
grant execute on function public.club_bar_counter(text), public.club_bar_take(uuid, uuid, uuid, boolean, timestamptz, text),
  public.club_bar_undo(uuid, text) to anon, authenticated;

-- ── Temps réel ──────────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'club_bar_settings') then
    alter publication supabase_realtime add table public.club_bar_settings;
  end if;
end $$;

commit;

notify pgrst, 'reload schema';

-- Bilan affiché à la fin.
select
  (select count(*) from pg_tables where schemaname = 'public' and tablename like 'club\_bar\_%') as tables_buvette,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'club\_bar\_%') as fonctions,
  (select count(*) from public.club_members where treasurer) as tresorerie;
