-- ════════════════════════════════════════════════════════════════════════════
--  PPC · Le Club : tournois heads-up
--
--  À exécuter UNE FOIS dans l'éditeur SQL, après 001_club.sql.
--  Le script peut être relancé sans risque : il ne supprime aucune donnée.
--
--  Un tournoi heads-up se joue par tours de matchs en tête-à-tête (élimination
--  directe ou ronde suisse). Chaque match est une ligne ; un joueur sans
--  adversaire est exempté du tour. Les tours se tirent, se retirent et
--  s'annulent par club_hu_round, qui refuse tout tirage si le tableau a changé
--  entre-temps (deux gestionnaires au même moment). Seul le vainqueur d'un match
--  se modifie ensuite, et seulement dans le dernier tour.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── Table ───────────────────────────────────────────────────────────────────

create table if not exists public.club_hu_matches (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.club_tournaments (id) on delete cascade,
  round         int not null check (round > 0),
  playoff       boolean not null default false,
  a             uuid not null,
  b             uuid,
  winner        uuid,
  created_at    timestamptz not null default now(),
  foreign key (tournament_id, a) references public.club_entries (tournament_id, id) on delete cascade,
  foreign key (tournament_id, b) references public.club_entries (tournament_id, id) on delete cascade,
  constraint club_hu_matches_players check (b is null or b <> a),
  constraint club_hu_matches_winner check (winner is null or (b is not null and winner in (a, b)))
);

create index if not exists club_hu_matches_tournament on public.club_hu_matches (tournament_id, round);

-- ── Garde-fous ──────────────────────────────────────────────────────────────

create or replace function public.club_hu_matches_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.tournament_id <> old.tournament_id or new.round <> old.round or new.a <> old.a
     or new.b is distinct from old.b or new.playoff <> old.playoff then
    raise exception 'Seul le vainqueur d''un match se modifie.';
  end if;
  if exists (select 1 from public.club_tournaments where id = new.tournament_id and status in ('finished', 'cancelled')) then
    raise exception 'Tournoi terminé : rouvre-le pour corriger un match.';
  end if;
  if exists (select 1 from public.club_hu_matches where tournament_id = new.tournament_id and round > new.round) then
    raise exception 'Le tour suivant est déjà tiré : annule-le pour corriger ce match.';
  end if;
  return new;
end $$;

drop trigger if exists club_hu_matches_guard on public.club_hu_matches;
create trigger club_hu_matches_guard before update on public.club_hu_matches
  for each row execute function public.club_hu_matches_guard();

-- Comme les inscriptions et les éliminations : les écrans connectés se rechargent.
drop trigger if exists club_hu_matches_touch_i on public.club_hu_matches;
create trigger club_hu_matches_touch_i after insert on public.club_hu_matches
  referencing new table as changed_new for each statement execute function public.club_touch();
drop trigger if exists club_hu_matches_touch_u on public.club_hu_matches;
create trigger club_hu_matches_touch_u after update on public.club_hu_matches
  referencing new table as changed_new old table as changed_old for each statement execute function public.club_touch();
drop trigger if exists club_hu_matches_touch_d on public.club_hu_matches;
create trigger club_hu_matches_touch_d after delete on public.club_hu_matches
  referencing old table as changed_old for each statement execute function public.club_touch();

-- ── Tirer, retirer au sort ou annuler un tour ───────────────────────────────
--  p_pairs nul      : annule le tour p_round, qui doit être le dernier ;
--  p_replace vrai   : retire au sort le dernier tour, tant qu'aucun résultat n'est saisi ;
--  sinon            : tire le tour suivant, une fois le précédent joué.
--  p_pairs : [{ "a": entrée, "b": entrée ou null pour une exemption }].
create or replace function public.club_hu_round(
  p_tournament uuid, p_round int, p_pairs jsonb, p_replace boolean, p_playoff boolean
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  st text;
  last int;
begin
  if not public.club_is_staff() then raise exception 'Action réservée aux gestionnaires.'; end if;
  select status into st from public.club_tournaments where id = p_tournament for update;
  if st is null then raise exception 'Tournoi introuvable.'; end if;
  if st in ('finished', 'cancelled') then raise exception 'Tournoi terminé : rouvre-le pour changer les tours.'; end if;
  select coalesce(max(round), 0) into last from public.club_hu_matches where tournament_id = p_tournament;

  if p_pairs is null then
    if p_round <> last then raise exception 'Le tableau a changé : recharge la page.'; end if;
    delete from public.club_hu_matches where tournament_id = p_tournament and round = p_round;
    return;
  end if;

  if jsonb_typeof(p_pairs) <> 'array' or jsonb_array_length(p_pairs) = 0 then
    raise exception 'Aucun match à tirer.';
  end if;
  if p_replace then
    if p_round <> last then raise exception 'Le tableau a changé : recharge la page.'; end if;
    if exists (select 1 from public.club_hu_matches where tournament_id = p_tournament and round = p_round and winner is not null) then
      raise exception 'Des résultats sont saisis : ce tour ne se retire plus au sort.';
    end if;
    delete from public.club_hu_matches where tournament_id = p_tournament and round = p_round;
  elsif p_round <> last + 1 then
    raise exception 'Ce tour a déjà été tiré : recharge la page.';
  elsif exists (select 1 from public.club_hu_matches where tournament_id = p_tournament and round = last and b is not null and winner is null) then
    raise exception 'Le tour en cours n''est pas fini.';
  end if;

  insert into public.club_hu_matches (tournament_id, round, playoff, a, b)
  select p_tournament, p_round, coalesce(p_playoff, false), r.a, r.b
  from jsonb_to_recordset(p_pairs) as r (a uuid, b uuid);

  if exists (
    select p from (
      select a as p from public.club_hu_matches where tournament_id = p_tournament and round = p_round
      union all
      select b from public.club_hu_matches where tournament_id = p_tournament and round = p_round and b is not null
    ) x group by p having count(*) > 1
  ) then
    raise exception 'Un joueur figure deux fois dans ce tour.';
  end if;

  -- Premier tirage : le tournoi passe en direct.
  update public.club_tournaments set status = 'running'
  where id = p_tournament and status in ('draft', 'open', 'closed');
end $$;

-- ── Sécurité (RLS) ──────────────────────────────────────────────────────────
-- Lecture : comme les éliminations, selon la visibilité du tournoi.
-- Écriture : le vainqueur seul, par l'équipe ; les tours passent par club_hu_round.

alter table public.club_hu_matches enable row level security;

drop policy if exists club_hu_matches_read on public.club_hu_matches;
create policy club_hu_matches_read on public.club_hu_matches for select
  using (exists (select 1 from public.club_tournaments t where t.id = tournament_id));
drop policy if exists club_hu_matches_staff on public.club_hu_matches;
create policy club_hu_matches_staff on public.club_hu_matches for update to authenticated
  using ((select public.club_is_staff())) with check ((select public.club_is_staff()));

revoke all on public.club_hu_matches from anon, authenticated;
grant select on public.club_hu_matches to anon, authenticated;
grant update (winner) on public.club_hu_matches to authenticated;

revoke all on function public.club_hu_round(uuid, int, jsonb, boolean, boolean),
  public.club_hu_matches_guard() from public, anon, authenticated;
grant execute on function public.club_hu_round(uuid, int, jsonb, boolean, boolean) to authenticated;

commit;

notify pgrst, 'reload schema';

-- Bilan affiché à la fin.
select
  (select count(*) from pg_tables where schemaname = 'public' and tablename = 'club_hu_matches') as table_heads_up,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'club_hu_round') as fonction_tirage;
