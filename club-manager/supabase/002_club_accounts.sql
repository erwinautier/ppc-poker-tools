-- ════════════════════════════════════════════════════════════════════════════
--  PPC · Le Club : tout compte validé est un adhérent
--
--  À exécuter UNE FOIS dans l'éditeur SQL, après 001_club.sql.
--
--   1. Les comptes qui existent aujourd'hui deviennent adhérents, sans validation.
--   2. Un compte créé ensuite attend qu'un gestionnaire ou un administrateur le
--      valide : il devient alors adhérent.
--   3. Un compte en attente ou refusé n'enregistre rien dans le Range Editor ni dans
--      le Trainer. Chacun garde la lecture de ses propres données ; rien n'est supprimé.
--
--  Le script peut être relancé : la reprise des comptes n'a lieu que la première
--  fois. Si tu relances un jour 001_club.sql, relance aussi celui-ci ensuite.
--  Il lit « profiles » et les comptes, sans jamais y écrire.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── Tables internes : aucun accès direct, tout passe par les fonctions ──────

create table if not exists public.club_refused_accounts (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.club_settings (
  key   text primary key,
  since timestamptz not null default now()
);
alter table public.club_refused_accounts enable row level security;
alter table public.club_settings enable row level security;
revoke all on public.club_refused_accounts, public.club_settings from anon, authenticated;

-- ── État d'un compte ────────────────────────────────────────────────────────

-- Compte validé : il a une fiche d'adhérent (un ancien adhérent garde les outils).
create or replace function public.club_account_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.club_members m where m.user_id = auth.uid())
$$;

-- none (déconnecté), ok, pending (à valider) ou refused.
create or replace function public.club_account_status() returns text
language sql stable security definer set search_path = '' as $$
  select case
    when auth.uid() is null then 'none'
    when public.club_account_ok() then 'ok'
    when exists (select 1 from public.club_refused_accounts r where r.user_id = auth.uid()) then 'refused'
    else 'pending'
  end
$$;

-- ── Gestion des comptes ─────────────────────────────────────────────────────

-- Tous les comptes, avec leur fiche s'ils en ont une. Les adresses des adhérents ne
-- sont montrées qu'aux administrateurs ; celles des comptes à valider, à toute l'équipe.
create or replace function public.club_accounts() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_admin boolean := public.club_is_admin();
begin
  if not public.club_is_staff() then raise exception 'Action réservée aux gestionnaires.'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', u.id,
      'username', nullif(left(btrim(p.username), 60), ''),
      'asked', r.name,
      'email', case when v_admin or m.id is null then u.email end,
      'confirmed', u.email_confirmed_at is not null,
      'created_at', u.created_at,
      'member_id', m.id,
      'refused', x.user_id is not null
    ) order by u.created_at desc, u.id)
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join public.club_members m on m.user_id = u.id
    left join public.club_join_requests r on r.user_id = u.id
    left join public.club_refused_accounts x on x.user_id = u.id
  ), '[]'::jsonb);
end $$;

-- Nombre de comptes à valider (0 pour qui ne gère pas le club).
create or replace function public.club_pending_count() returns int
language sql stable security definer set search_path = '' as $$
  select case when public.club_is_staff() then (
    select count(*)::int from auth.users u
    where u.email_confirmed_at is not null
      and not exists (select 1 from public.club_members m where m.user_id = u.id)
      and not exists (select 1 from public.club_refused_accounts x where x.user_id = u.id)
  ) else 0 end
$$;

-- p_member nul : nouvelle fiche (au nom p_name, sinon au nom indiqué, sinon au pseudo).
-- Seul un administrateur donne un rôle (club_members_guard) ; le rôle que la fiche
-- porte déjà n'est jamais remplacé.
create or replace function public.club_validate_account(
  p_user uuid, p_member uuid default null, p_name text default null, p_role text default 'member'
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_confirmed boolean;
  v_name text;
  m uuid;
begin
  if not public.club_is_staff() then raise exception 'Action réservée aux gestionnaires.'; end if;
  select u.email_confirmed_at is not null,
         left(coalesce(nullif(btrim(p_name), ''), nullif(btrim(r.name), ''), nullif(btrim(p.username), '')), 60)
    into v_confirmed, v_name
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join public.club_join_requests r on r.user_id = u.id
    where u.id = p_user;
  if not found then raise exception 'Ce compte n''existe plus.'; end if;
  if not v_confirmed then raise exception 'L''adresse de ce compte n''est pas encore confirmée.'; end if;
  if exists (select 1 from public.club_members x where x.user_id = p_user) then
    raise exception 'Ce compte est déjà rattaché à un adhérent.';
  end if;
  if p_member is null then
    if v_name is null then raise exception 'Indique le nom de la nouvelle fiche.'; end if;
    insert into public.club_members (user_id, name, role) values (p_user, v_name, p_role) returning id into m;
  else
    update public.club_members x
    set user_id = p_user, active = true, role = case when x.role = 'member' then p_role else x.role end
    where x.id = p_member and x.user_id is null returning x.id into m;
    if m is null then raise exception 'Cette fiche est déjà rattachée à un compte.'; end if;
  end if;
  delete from public.club_join_requests r where r.user_id = p_user;
  delete from public.club_refused_accounts x where x.user_id = p_user;
  return m;
end $$;

-- Refuser un compte sans fiche, ou revenir sur ce refus.
create or replace function public.club_refuse_account(p_user uuid, p_refuse boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.club_is_staff() then raise exception 'Action réservée aux gestionnaires.'; end if;
  if not p_refuse then
    delete from public.club_refused_accounts x where x.user_id = p_user;
    return;
  end if;
  if exists (select 1 from public.club_members x where x.user_id = p_user) then
    raise exception 'Ce compte est déjà rattaché à un adhérent.';
  end if;
  insert into public.club_refused_accounts (user_id) values (p_user) on conflict do nothing;
  delete from public.club_join_requests r where r.user_id = p_user;
end $$;

-- Nom comparable : sans accents, majuscules ni ponctuation.
create or replace function public.club_name_key(p text) returns text
language sql immutable set search_path = '' as $$
  select btrim(regexp_replace(translate(lower(coalesce(p, '')),
    'àâäáãåçéèêëíìîïñóòôöõúùûüýÿ', 'aaaaaaceeeeiiiinooooouuuuyy'), '[^a-z0-9]+', ' ', 'g'))
$$;

-- ── Reprise des comptes existants, une seule fois ───────────────────────────
-- Une fiche libre au même nom, sans homonyme, est reliée ; sinon une fiche est créée.
do $$
begin
  insert into public.club_settings (key) values ('accounts_adopted') on conflict (key) do nothing;
  if not found then return; end if;

  with todo as (
    select x.*, public.club_name_key(x.name) as k,
           count(*) over (partition by public.club_name_key(x.name)) as same_name
    from (
      select u.id, left(coalesce(nullif(btrim(r.name), ''), nullif(btrim(p.username), ''), 'Sans pseudo'), 60) as name
      from auth.users u
      left join public.profiles p on p.id = u.id
      left join public.club_join_requests r on r.user_id = u.id
      where u.email_confirmed_at is not null
        and not exists (select 1 from public.club_members m where m.user_id = u.id)
    ) x
  ), linked as (
    update public.club_members m set user_id = t.id
    from todo t
    where m.user_id is null and m.active and m.role = 'member'
      and t.k <> '' and t.same_name = 1 and public.club_name_key(m.name) = t.k
      and (select count(*) from public.club_members y where public.club_name_key(y.name) = t.k) = 1
    returning m.user_id
  )
  insert into public.club_members (user_id, name)
  select t.id, t.name from todo t where t.id not in (select l.user_id from linked l);

  delete from public.club_join_requests r
  where exists (select 1 from public.club_members m where m.user_id = r.user_id);
end $$;

-- ── Les outils attendent la validation ──────────────────────────────────────
-- Règles « restrictives » : elles s'ajoutent aux règles existantes sans y toucher.
-- L'enregistrement seul est concerné. Surtout pas la lecture : le Trainer efface les
-- ranges du navigateur quand il n'en trouve aucune en ligne.
-- Pour revenir en arrière, sur chaque table :
--   drop policy club_validated_insert on public.<table>;
--   drop policy club_validated_update on public.<table>;
do $$
declare t text;
begin
  foreach t in array array['range_collections', 'trainer_stats'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('drop policy if exists club_validated_insert on public.%I', t);
    execute format('drop policy if exists club_validated_update on public.%I', t);
    execute format('create policy club_validated_insert on public.%I as restrictive for insert to authenticated '
      'with check ((select public.club_account_ok()))', t);
    execute format('create policy club_validated_update on public.%I as restrictive for update to authenticated '
      'using ((select public.club_account_ok())) with check ((select public.club_account_ok()))', t);
  end loop;
end $$;

-- ── Droits d'exécution ──────────────────────────────────────────────────────
revoke all on function public.club_account_ok(), public.club_account_status(), public.club_accounts(),
  public.club_pending_count(), public.club_validate_account(uuid, uuid, text, text),
  public.club_refuse_account(uuid, boolean), public.club_name_key(text) from public, anon, authenticated;
grant execute on function public.club_account_ok(), public.club_account_status(), public.club_accounts(),
  public.club_pending_count(), public.club_validate_account(uuid, uuid, text, text),
  public.club_refuse_account(uuid, boolean) to authenticated;

commit;

-- L'application voit les nouvelles fonctions tout de suite.
notify pgrst, 'reload schema';

-- Bilan affiché à la fin.
select
  (select count(*) from public.club_members where user_id is not null) as adherents_avec_compte,
  (select count(*) from public.club_members where user_id is null)     as fiches_sans_compte,
  (select count(*) from auth.users u where not exists (select 1 from public.club_members m where m.user_id = u.id)) as comptes_non_valides,
  (select count(distinct tablename) from pg_policies where policyname = 'club_validated_insert') as outils_proteges;
