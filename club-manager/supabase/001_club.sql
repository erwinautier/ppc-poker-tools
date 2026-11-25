-- ════════════════════════════════════════════════════════════════════════════
--  PPC · Championnats et tournois : schéma, droits et fonctions
--
--  À exécuter UNE FOIS dans l'éditeur SQL du projet Supabase de la suite
--  (le même que le Range Editor et le Trainer : les comptes sont partagés).
--  Le script peut être relancé sans risque : il ne supprime aucune donnée.
--
--  Ensuite, déclarer le premier administrateur (voir SETUP.md) :
--    select club_bootstrap_admin('adresse-du-compte', 'Nom affiché');
--
--  Toutes les tables sont préfixées « club_ » : rien ne touche aux ranges,
--  aux statistiques du trainer ni à la table « profiles ».
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── Tables ──────────────────────────────────────────────────────────────────

-- Un adhérent existe avec ou sans compte : user_id se remplit au rattachement.
create table if not exists public.club_members (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid unique references auth.users (id) on delete set null,
  name       text not null check (char_length(btrim(name)) between 1 and 60),
  role       text not null default 'member' check (role in ('member', 'director', 'admin')),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.club_join_requests (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 60),
  email      text,
  created_at timestamptz not null default now()
);

create table if not exists public.club_structures (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (char_length(btrim(name)) between 1 and 80),
  description    text not null default '',
  starting_stack int  not null default 20000 check (starting_stack > 0),
  levels         jsonb not null default '[]' check (jsonb_typeof(levels) = 'array'),
  chips          jsonb not null default '[]' check (jsonb_typeof(chips) = 'array'),
  created_at     timestamptz not null default now()
);

create table if not exists public.club_championships (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  season      text not null default '',
  description text not null default '',
  status      text not null default 'active' check (status in ('active', 'archived')),
  visibility  text not null default 'members' check (visibility in ('members', 'public')),
  scoring     jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

-- La structure est COPIÉE dans le tournoi (levels) : modifier un modèle ne
-- change jamais un tournoi déjà créé.
-- Horloge : (clock_level, clock_elapsed_ms) au moment clock_anchor ; tous les
-- écrans en déduisent le temps restant, sans écriture à chaque niveau.
create table if not exists public.club_tournaments (
  id               uuid primary key default gen_random_uuid(),
  championship_id  uuid references public.club_championships (id) on delete set null,
  name             text not null check (char_length(btrim(name)) between 1 and 80),
  description      text not null default '',
  venue            text not null default '',
  starts_at        timestamptz not null,
  status           text not null default 'draft'
                   check (status in ('draft', 'open', 'closed', 'running', 'finished', 'cancelled')),
  visibility       text not null default 'members' check (visibility in ('members', 'public')),
  max_players      int check (max_players is null or max_players > 1),
  seats_per_table  int not null default 8 check (seats_per_table between 2 and 10),
  starting_stack   int not null default 20000 check (starting_stack > 0),
  structure_name   text not null default '',
  levels           jsonb not null default '[]' check (jsonb_typeof(levels) = 'array'),
  chips            jsonb not null default '[]' check (jsonb_typeof(chips) = 'array'),
  settings         jsonb not null default '{}',
  clock_level      int not null default 0 check (clock_level >= 0),
  clock_elapsed_ms bigint not null default 0,
  clock_anchor     timestamptz,
  finished_at      timestamptz,
  rev              bigint not null default 0,
  created_at       timestamptz not null default now()
);

create table if not exists public.club_entries (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null references public.club_tournaments (id) on delete cascade,
  member_id      uuid references public.club_members (id) on delete set null,
  name           text not null check (char_length(btrim(name)) between 1 and 60),
  status         text not null default 'registered' check (status in ('registered', 'waitlist', 'cancelled')),
  registered_at  timestamptz not null default now(),
  checked_in     boolean not null default false,
  rebuys         int not null default 0 check (rebuys >= 0),
  addons         int not null default 0 check (addons >= 0),
  table_no       int check (table_no is null or table_no > 0),
  seat_no        int check (seat_no is null or seat_no > 0),
  bounty_start   numeric,
  points_adjust  numeric not null default 0,
  final_position int check (final_position is null or final_position > 0),
  final_kos      numeric,
  final_bounty   numeric,
  unique (tournament_id, member_id),
  unique (tournament_id, id)
);

-- Suivi des règlements, à part : réservé aux organisateurs.
create table if not exists public.club_payments (
  entry_id      uuid primary key references public.club_entries (id) on delete cascade,
  tournament_id uuid not null references public.club_tournaments (id) on delete cascade,
  created_at    timestamptz not null default now()
);

-- Journal des éliminations : positions, KO et primes s'en déduisent.
create table if not exists public.club_knockouts (
  id            uuid primary key default gen_random_uuid(),
  seq           bigint generated always as identity,
  tournament_id uuid not null references public.club_tournaments (id) on delete cascade,
  victim_id     uuid not null,
  killer_ids    uuid[] not null default '{}',
  rebuy         boolean not null default false,
  level         int,
  created_at    timestamptz not null default now(),
  foreign key (tournament_id, victim_id)
    references public.club_entries (tournament_id, id) on delete cascade
);

create index if not exists club_tournaments_starts_at on public.club_tournaments (starts_at desc);
create index if not exists club_tournaments_champ     on public.club_tournaments (championship_id);
create index if not exists club_entries_tournament    on public.club_entries (tournament_id);
create index if not exists club_entries_member        on public.club_entries (member_id);
create index if not exists club_knockouts_tournament  on public.club_knockouts (tournament_id, seq);
create unique index if not exists club_knockouts_out  on public.club_knockouts (victim_id) where not rebuy;

-- ── Rôles ───────────────────────────────────────────────────────────────────
--  member   : adhérent rattaché, consulte et s'inscrit
--  director : organise (tournois, horloge, inscriptions, adhérents simples)
--  admin    : en plus, gère les rôles

create or replace function public.club_role() returns text
language sql stable security definer set search_path = '' as $$
  select m.role from public.club_members m where m.user_id = auth.uid() and m.active
$$;

create or replace function public.club_is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.club_role() is not null
$$;

create or replace function public.club_is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.club_role() in ('director', 'admin'), false)
$$;

create or replace function public.club_is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.club_role() = 'admin', false)
$$;

-- ── Déclencheurs ────────────────────────────────────────────────────────────

-- Un organisateur ne peut ni s'élever, ni toucher aux autres organisateurs ;
-- le club garde toujours au moins un administrateur.
create or replace function public.club_members_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not public.club_is_admin() then
    if tg_op = 'INSERT' and new.role <> 'member' then
      raise exception 'Seul un administrateur peut attribuer ce rôle.';
    elsif tg_op = 'UPDATE' and (old.role <> 'member' or new.role <> 'member') then
      raise exception 'Seul un administrateur peut modifier un organisateur.';
    elsif tg_op = 'DELETE' and old.role <> 'member' then
      raise exception 'Seul un administrateur peut supprimer un organisateur.';
    end if;
  end if;

  if tg_op in ('UPDATE', 'DELETE') and auth.uid() is not null
     and old.role = 'admin' and old.active and old.user_id is not null then
    if tg_op = 'DELETE' or new.role <> 'admin' or not new.active or new.user_id is null then
      if not exists (
        select 1 from public.club_members m
        where m.id <> old.id and m.role = 'admin' and m.active and m.user_id is not null
      ) then
        raise exception 'Le club doit garder au moins un administrateur.';
      end if;
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists club_members_guard on public.club_members;
create trigger club_members_guard before insert or update or delete on public.club_members
  for each row execute function public.club_members_guard();

-- Le nom affiché d'un adhérent est recopié dans ses inscriptions.
create or replace function public.club_members_rename() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.club_entries set name = new.name where member_id = new.id and name <> new.name;
  return null;
end $$;

drop trigger if exists club_members_rename on public.club_members;
create trigger club_members_rename after update of name on public.club_members
  for each row when (old.name is distinct from new.name)
  execute function public.club_members_rename();

-- Liste d'attente : la plus ancienne inscription prend la place libérée.
create or replace function public.club_promote(p_tournament uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t public.club_tournaments;
  free int;
begin
  select * into t from public.club_tournaments where id = p_tournament for update;
  if not found or t.status not in ('draft', 'open', 'closed') then return; end if;
  if t.max_players is null then
    update public.club_entries set status = 'registered'
    where tournament_id = p_tournament and status = 'waitlist';
    return;
  end if;
  select t.max_players - count(*) into free
  from public.club_entries where tournament_id = p_tournament and status = 'registered';
  if free <= 0 then return; end if;
  update public.club_entries set status = 'registered'
  where id in (
    select e.id from public.club_entries e
    where e.tournament_id = p_tournament and e.status = 'waitlist'
    order by e.registered_at, e.id
    limit free
  );
end $$;

-- Toute modification d'un tournoi (inscriptions, éliminations) incrémente
-- « rev » : les écrans connectés n'écoutent que la table des tournois.
create or replace function public.club_touch() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  ids uuid[];
  i uuid;
begin
  if tg_op = 'INSERT' then
    select array_agg(distinct tournament_id) into ids from changed_new;
  elsif tg_op = 'DELETE' then
    select array_agg(distinct tournament_id) into ids from changed_old;
  else
    select array_agg(distinct tournament_id) into ids
    from (select tournament_id from changed_new union select tournament_id from changed_old) x;
  end if;
  if ids is null then return null; end if;

  if tg_table_name = 'club_entries' and tg_op <> 'INSERT' and pg_trigger_depth() < 2 then
    foreach i in array ids loop perform public.club_promote(i); end loop;
  end if;
  update public.club_tournaments set rev = rev + 1 where id = any (ids);
  return null;
end $$;

drop trigger if exists club_entries_touch_i on public.club_entries;
create trigger club_entries_touch_i after insert on public.club_entries
  referencing new table as changed_new for each statement execute function public.club_touch();
drop trigger if exists club_entries_touch_u on public.club_entries;
create trigger club_entries_touch_u after update on public.club_entries
  referencing new table as changed_new old table as changed_old for each statement execute function public.club_touch();
drop trigger if exists club_entries_touch_d on public.club_entries;
create trigger club_entries_touch_d after delete on public.club_entries
  referencing old table as changed_old for each statement execute function public.club_touch();

drop trigger if exists club_knockouts_touch_i on public.club_knockouts;
create trigger club_knockouts_touch_i after insert on public.club_knockouts
  referencing new table as changed_new for each statement execute function public.club_touch();
drop trigger if exists club_knockouts_touch_d on public.club_knockouts;
create trigger club_knockouts_touch_d after delete on public.club_knockouts
  referencing old table as changed_old for each statement execute function public.club_touch();

-- Augmenter le nombre de places fait entrer la liste d'attente.
create or replace function public.club_tournaments_capacity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.club_promote(new.id);
  return null;
end $$;

drop trigger if exists club_tournaments_capacity on public.club_tournaments;
create trigger club_tournaments_capacity after update of max_players on public.club_tournaments
  for each row when (old.max_players is distinct from new.max_players)
  execute function public.club_tournaments_capacity();

-- Une élimination suivie d'une recave compte une recave (et l'annuler la retire).
create or replace function public.club_knockouts_rebuy() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.rebuy then
      update public.club_entries set rebuys = rebuys + 1 where id = new.victim_id;
    end if;
  elsif old.rebuy then
    update public.club_entries set rebuys = greatest(0, rebuys - 1) where id = old.victim_id;
  end if;
  return null;
end $$;

drop trigger if exists club_knockouts_rebuy on public.club_knockouts;
create trigger club_knockouts_rebuy after insert or delete on public.club_knockouts
  for each row execute function public.club_knockouts_rebuy();

-- ── Sécurité (RLS) ──────────────────────────────────────────────────────────

alter table public.club_members       enable row level security;
alter table public.club_join_requests enable row level security;
alter table public.club_structures    enable row level security;
alter table public.club_championships enable row level security;
alter table public.club_tournaments   enable row level security;
alter table public.club_entries       enable row level security;
alter table public.club_payments      enable row level security;
alter table public.club_knockouts     enable row level security;

do $$
declare p record;
begin
  for p in select policyname, tablename from pg_policies
           where schemaname = 'public' and tablename like 'club\_%' loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

create policy club_members_read on public.club_members for select
  using ((select public.club_is_member()));
create policy club_members_staff on public.club_members for all to authenticated
  using ((select public.club_is_staff())) with check ((select public.club_is_staff()));

create policy club_join_own on public.club_join_requests for select to authenticated
  using (user_id = (select auth.uid()) or (select public.club_is_staff()));
create policy club_join_cancel on public.club_join_requests for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.club_is_staff()));

create policy club_structures_read on public.club_structures for select
  using ((select public.club_is_member()));
create policy club_structures_staff on public.club_structures for all to authenticated
  using ((select public.club_is_staff())) with check ((select public.club_is_staff()));

create policy club_championships_read on public.club_championships for select
  using (visibility = 'public' or (select public.club_is_member()));
create policy club_championships_staff on public.club_championships for all to authenticated
  using ((select public.club_is_staff())) with check ((select public.club_is_staff()));

create policy club_tournaments_read on public.club_tournaments for select
  using (status <> 'draft' and (visibility = 'public' or (select public.club_is_member())));
create policy club_tournaments_staff on public.club_tournaments for all to authenticated
  using ((select public.club_is_staff())) with check ((select public.club_is_staff()));

-- Inscriptions et éliminations suivent la visibilité de leur tournoi (la
-- sous-requête est elle-même filtrée par la règle ci-dessus).
create policy club_entries_read on public.club_entries for select
  using (exists (select 1 from public.club_tournaments t where t.id = tournament_id));
create policy club_entries_staff on public.club_entries for all to authenticated
  using ((select public.club_is_staff())) with check ((select public.club_is_staff()));

create policy club_knockouts_read on public.club_knockouts for select
  using (exists (select 1 from public.club_tournaments t where t.id = tournament_id));
create policy club_knockouts_staff on public.club_knockouts for all to authenticated
  using ((select public.club_is_staff())) with check ((select public.club_is_staff()));

create policy club_payments_staff on public.club_payments for all to authenticated
  using ((select public.club_is_staff())) with check ((select public.club_is_staff()));

revoke all on public.club_members, public.club_join_requests, public.club_structures,
  public.club_championships, public.club_tournaments, public.club_entries,
  public.club_payments, public.club_knockouts from anon, authenticated;
grant select on public.club_championships, public.club_tournaments, public.club_entries,
  public.club_knockouts, public.club_members, public.club_structures to anon;
grant select, insert, update, delete on public.club_members, public.club_structures,
  public.club_championships, public.club_tournaments, public.club_entries,
  public.club_payments, public.club_knockouts to authenticated;
grant select, delete on public.club_join_requests to authenticated;

-- ── Fonctions appelées par l'application ────────────────────────────────────

-- Heure du serveur : toutes les horloges s'y calent.
create or replace function public.club_now() returns double precision
language sql volatile set search_path = '' as $$
  select extract(epoch from clock_timestamp()) * 1000
$$;

create or replace function public.club_request_join(p_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_email text;
begin
  if auth.uid() is null then raise exception 'Connexion requise.'; end if;
  if exists (select 1 from public.club_members where user_id = auth.uid()) then
    raise exception 'Ce compte est déjà rattaché à un adhérent.';
  end if;
  select email into v_email from auth.users where id = auth.uid();
  insert into public.club_join_requests (user_id, name, email)
  values (auth.uid(), btrim(p_name), v_email)
  on conflict (user_id) do update set name = excluded.name, email = excluded.email;
end $$;

-- p_member nul : crée un nouvel adhérent. Sinon : rattache le compte à la fiche existante.
create or replace function public.club_approve_request(p_user uuid, p_member uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  r public.club_join_requests;
  m uuid;
begin
  if not public.club_is_staff() then raise exception 'Réservé aux organisateurs.'; end if;
  select * into r from public.club_join_requests where user_id = p_user;
  if not found then raise exception 'Cette demande n''existe plus.'; end if;
  if p_member is null then
    insert into public.club_members (user_id, name) values (p_user, r.name) returning id into m;
  else
    update public.club_members set user_id = p_user, active = true
    where id = p_member and user_id is null returning id into m;
    if m is null then raise exception 'Cette fiche est déjà rattachée à un compte.'; end if;
  end if;
  delete from public.club_join_requests where user_id = p_user;
  return m;
end $$;

create or replace function public.club_register(p_tournament uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  m public.club_members;
  t public.club_tournaments;
  s text;
  n int;
begin
  select * into m from public.club_members where user_id = auth.uid() and active;
  if not found then raise exception 'Ton compte n''est pas encore rattaché à un adhérent.'; end if;
  select * into t from public.club_tournaments where id = p_tournament for update;
  if not found or t.status <> 'open' then raise exception 'Les inscriptions ne sont pas ouvertes.'; end if;

  select status into s from public.club_entries where tournament_id = p_tournament and member_id = m.id;
  if s in ('registered', 'waitlist') then return s; end if;

  select count(*) into n from public.club_entries where tournament_id = p_tournament and status = 'registered';
  s := case when t.max_players is null or n < t.max_players then 'registered' else 'waitlist' end;
  insert into public.club_entries (tournament_id, member_id, name, status)
  values (p_tournament, m.id, m.name, s)
  on conflict (tournament_id, member_id) do update
    set status = excluded.status, registered_at = clock_timestamp(),
        checked_in = false, table_no = null, seat_no = null;
  return s;
end $$;

create or replace function public.club_unregister(p_tournament uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  m public.club_members;
  t public.club_tournaments;
begin
  select * into m from public.club_members where user_id = auth.uid() and active;
  if not found then raise exception 'Ton compte n''est pas encore rattaché à un adhérent.'; end if;
  select * into t from public.club_tournaments where id = p_tournament for update;
  if not found or t.status not in ('open', 'closed') then
    raise exception 'Le tournoi a commencé : préviens l''organisateur.';
  end if;
  update public.club_entries
  set status = 'cancelled', checked_in = false, table_no = null, seat_no = null
  where tournament_id = p_tournament and member_id = m.id;
end $$;

-- Horloge : l'instant de référence est posé par le serveur.
create or replace function public.club_set_clock(
  p_tournament uuid, p_level int, p_elapsed_ms bigint, p_running boolean
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.club_is_staff() then raise exception 'Réservé aux organisateurs.'; end if;
  update public.club_tournaments set
    clock_level = greatest(0, p_level),
    clock_elapsed_ms = p_elapsed_ms,
    clock_anchor = case when p_running then clock_timestamp() end,
    status = case when p_running and status in ('draft', 'open', 'closed') then 'running' else status end
  where id = p_tournament and status not in ('finished', 'cancelled');
end $$;

create or replace function public.club_save_seats(p_tournament uuid, p_seats jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.club_is_staff() then raise exception 'Réservé aux organisateurs.'; end if;
  update public.club_entries e set table_no = r.table_no, seat_no = r.seat_no
  from jsonb_to_recordset(p_seats) as r (entry_id uuid, table_no int, seat_no int)
  where e.id = r.entry_id and e.tournament_id = p_tournament;
end $$;

-- Fige le classement. Les joueurs absents de p_results n'ont pas de résultat.
create or replace function public.club_finish(p_tournament uuid, p_results jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.club_is_staff() then raise exception 'Réservé aux organisateurs.'; end if;
  update public.club_entries e
  set final_position = r."position", final_kos = r.kos, final_bounty = r.bounty
  from public.club_entries x
  left join jsonb_to_recordset(p_results) as r (entry_id uuid, "position" int, kos numeric, bounty numeric)
    on r.entry_id = x.id
  where e.id = x.id and x.tournament_id = p_tournament;
  update public.club_tournaments set
    status = 'finished',
    finished_at = coalesce(finished_at, now()),
    clock_elapsed_ms = clock_elapsed_ms + case when clock_anchor is null then 0
      else (extract(epoch from clock_timestamp() - clock_anchor) * 1000)::bigint end,
    clock_anchor = null
  where id = p_tournament;
end $$;

create or replace function public.club_reopen(p_tournament uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.club_is_staff() then raise exception 'Réservé aux organisateurs.'; end if;
  update public.club_entries set final_position = null, final_kos = null, final_bounty = null
  where tournament_id = p_tournament;
  update public.club_tournaments set status = 'running', finished_at = null
  where id = p_tournament and status = 'finished';
end $$;

-- Premier administrateur : depuis l'éditeur SQL uniquement.
create or replace function public.club_bootstrap_admin(p_email text, p_name text) returns text
language plpgsql security definer set search_path = '' as $$
declare u uuid;
begin
  select id into u from auth.users where lower(email) = lower(btrim(p_email));
  if u is null then
    return 'Aucun compte avec cette adresse : crée d''abord le compte dans la suite.';
  end if;
  insert into public.club_members (user_id, name, role) values (u, btrim(p_name), 'admin')
  on conflict (user_id) do update set role = 'admin', active = true;
  delete from public.club_join_requests where user_id = u;
  return 'Administrateur enregistré.';
end $$;

-- Droits d'exécution : rien par défaut, puis le strict nécessaire.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'club\_%' loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

grant execute on function public.club_now(), public.club_role(), public.club_is_member(),
  public.club_is_staff(), public.club_is_admin() to anon, authenticated;
grant execute on function public.club_request_join(text), public.club_approve_request(uuid, uuid),
  public.club_register(uuid), public.club_unregister(uuid),
  public.club_set_clock(uuid, int, bigint, boolean), public.club_save_seats(uuid, jsonb),
  public.club_finish(uuid, jsonb), public.club_reopen(uuid) to authenticated;

-- ── Temps réel ──────────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and tablename = 'club_tournaments') then
    alter publication supabase_realtime add table public.club_tournaments;
  end if;
end $$;

commit;
