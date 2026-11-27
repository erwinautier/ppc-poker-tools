-- ════════════════════════════════════════════════════════════════════════════
--  PPC · Le Club : page publique « Rejoindre le club »
--
--  À exécuter UNE FOIS dans l'éditeur SQL, après 001_club.sql.
--  Le script peut être relancé sans risque : il ne supprime aucune donnée.
--  Si tu relances 001_club.sql, relance ce script juste après (001 retire les
--  règles d'accès de toutes les tables club_*).
--
--  Les questions fréquentes de la page /rejoindre tiennent dans une seule ligne
--  (id = 1), lisible par tous, visiteurs compris. Seuls les administrateurs du
--  club les modifient, par club_save_join_faq (Le Club, page Adhérents,
--  « Modifier la page Rejoindre le club »). Tant que la ligne n'existe pas, la page affiche ses questions par
--  défaut (rejoindre/faq.json).
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── Table ───────────────────────────────────────────────────────────────────

create table if not exists public.club_join_page (
  id          smallint primary key default 1 check (id = 1),
  faq         jsonb not null default '[]' check (jsonb_typeof(faq) = 'array'),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id) on delete set null
);

-- ── Enregistrement ──────────────────────────────────────────────────────────
-- p_faq : liste de { q, a } (question, réponse). Les textes sont débarrassés des
-- espaces en trop, les autres clés ignorées. Mêmes limites que l'écran de Le Club
-- (src/lib/joinPage.ts) : 30 questions, 200 caractères par question, 2 000 par
-- réponse. Une liste vide est permise : la page n'affiche alors plus la section.

create or replace function public.club_save_join_faq(p_faq jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  clean jsonb := '[]'::jsonb;
  item  jsonb;
  q     text;
  a     text;
begin
  if not public.club_is_admin() then
    raise exception 'Réservé aux administrateurs du club.';
  end if;
  if p_faq is null or jsonb_typeof(p_faq) <> 'array' then
    raise exception 'Liste de questions attendue.';
  end if;
  if jsonb_array_length(p_faq) > 30 then
    raise exception 'Trente questions au plus.';
  end if;
  for item in select value from jsonb_array_elements(p_faq) loop
    if jsonb_typeof(item) is distinct from 'object'
       or jsonb_typeof(item -> 'q') is distinct from 'string'
       or jsonb_typeof(item -> 'a') is distinct from 'string' then
      raise exception 'Chaque question doit avoir une réponse.';
    end if;
    q := btrim(item ->> 'q', E' \t\r\n');
    a := btrim(item ->> 'a', E' \t\r\n');
    if q = '' or a = '' then
      raise exception 'Chaque question doit avoir une réponse.';
    end if;
    if char_length(q) > 200 then
      raise exception 'Question trop longue : 200 caractères au plus.';
    end if;
    if char_length(a) > 2000 then
      raise exception 'Réponse trop longue : 2 000 caractères au plus.';
    end if;
    clean := clean || jsonb_build_array(jsonb_build_object('q', q, 'a', a));
  end loop;

  insert into public.club_join_page (id, faq, updated_at, updated_by)
  values (1, clean, now(), auth.uid())
  on conflict (id) do update
    set faq = excluded.faq, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
  return clean;
end $$;

-- ── Accès ───────────────────────────────────────────────────────────────────
-- Lecture pour tous (la page est publique) ; aucune écriture directe : tout passe
-- par club_save_join_faq.

alter table public.club_join_page enable row level security;

drop policy if exists club_join_page_read on public.club_join_page;
create policy club_join_page_read on public.club_join_page for select using (true);

revoke all on public.club_join_page from anon, authenticated;
grant select on public.club_join_page to anon, authenticated;

revoke all on function public.club_save_join_faq(jsonb) from public, anon, authenticated;
grant execute on function public.club_save_join_faq(jsonb) to authenticated;

commit;

notify pgrst, 'reload schema';

-- Bilan affiché à la fin.
select
  (select count(*) from pg_tables where schemaname = 'public' and tablename = 'club_join_page') as table_page_rejoindre,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'club_save_join_faq') as fonction_enregistrement;
