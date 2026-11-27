-- ════════════════════════════════════════════════════════════════════════════
--  PPC · Carnet de mains : les mains soumises au vote du club
--
--  À exécuter UNE FOIS dans l'éditeur SQL, après 001_club.sql.
--  Le script peut être relancé sans risque : il ne supprime aucune donnée.
--
--  Le carnet lui-même reste sur le téléphone de chacun. Ici ne vivent que les
--  mains qu'un adhérent publie pour demander « Et toi, tu fais quoi ? », et les
--  votes des autres adhérents. Pas de commentaire libre : une réponse parmi
--  celles proposées, et au plus deux raisons parmi une liste fixe.
--
--  Tout passe par les fonctions carnet_* (aucun accès direct aux tables) :
--   - on ne voit les résultats d'une main qu'après avoir voté (ou si c'est la sienne) ;
--   - les votes sont anonymes : seuls les totaux sortent de la base ;
--   - l'équipe du club (gestionnaires, administrateurs) peut retirer une main.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── Tables ──────────────────────────────────────────────────────────────────

create table if not exists public.carnet_hands (
  id          uuid primary key default gen_random_uuid(),
  author      uuid not null references auth.users (id) on delete cascade,
  -- Prénom de la fiche d'adhérent, si l'auteur a choisi de l'afficher.
  author_name text,
  hand        jsonb not null,
  options     jsonb not null,
  hidden      boolean not null default false,
  created_at  timestamptz not null default now(),
  constraint carnet_hands_size check (octet_length(hand::text) <= 20000 and octet_length(options::text) <= 2000),
  constraint carnet_hands_options check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 6),
  constraint carnet_hands_name check (author_name is null or char_length(author_name) <= 40)
);
create index if not exists carnet_hands_created on public.carnet_hands (created_at desc);
create index if not exists carnet_hands_author on public.carnet_hands (author, created_at desc);

create table if not exists public.carnet_votes (
  hand_id    uuid not null references public.carnet_hands (id) on delete cascade,
  voter      uuid not null references auth.users (id) on delete cascade,
  choice     smallint not null check (choice between 0 and 5),
  reasons    smallint[] not null default '{}'
             check (cardinality(reasons) <= 2 and reasons <@ '{0,1,2,3,4,5,6,7}'::smallint[]),
  created_at timestamptz not null default now(),
  primary key (hand_id, voter)
);

alter table public.carnet_hands enable row level security;
alter table public.carnet_votes enable row level security;
revoke all on public.carnet_hands, public.carnet_votes from anon, authenticated;

-- ── Fonctions ───────────────────────────────────────────────────────────────

create or replace function public.carnet_member_check() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.club_is_member() then
    raise exception 'Réservé aux adhérents du club.';
  end if;
end $$;

-- Totaux d'une main : votes par réponse, raisons par réponse. Jamais appelée directement.
create or replace function public.carnet_results(p_hand uuid, p_n int) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'total', (select count(*) from public.carnet_votes v where v.hand_id = p_hand),
    'counts', (select jsonb_agg((select count(*) from public.carnet_votes v where v.hand_id = p_hand and v.choice = c) order by c)
               from generate_series(0, p_n - 1) c),
    'reasons', (select jsonb_agg((
                  select jsonb_agg((select count(*) from public.carnet_votes v
                                    where v.hand_id = p_hand and v.choice = c and r = any (v.reasons)) order by r)
                  from generate_series(0, 7) r) order by c)
                from generate_series(0, p_n - 1) c)
  )
$$;

-- Publie une main ; renvoie son identifiant. La note personnelle n'est jamais gardée.
create or replace function public.carnet_publish(p_hand jsonb, p_options jsonb, p_show_name boolean default false) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_name text;
begin
  perform public.carnet_member_check();
  if p_hand is null or jsonb_typeof(p_hand) <> 'object'
     or jsonb_typeof(p_hand -> 'seats') is distinct from 'array'
     or jsonb_typeof(p_hand -> 'actions') is distinct from 'array' then
    raise exception 'Main illisible.';
  end if;
  select jsonb_object_agg(e.key, e.value) into p_hand from jsonb_each(p_hand) e
   where e.key in ('v', 'date', 'ctx', 'seats', 'hero', 'actions', 'board', 'decision', 'winners', 'tags', 'complete');
  if p_options is null or jsonb_typeof(p_options) <> 'array' or jsonb_array_length(p_options) not between 2 and 6
     or exists (select 1 from jsonb_array_elements(p_options) o
                where jsonb_typeof(o) <> 'object' or coalesce(o ->> 'k', '') not in ('fold', 'check', 'call', 'bet', 'raise')) then
    raise exception 'Réponses du vote illisibles.';
  end if;
  if (select count(*) from public.carnet_hands h where h.author = auth.uid() and h.created_at > now() - interval '1 day') >= 20 then
    raise exception 'Vingt mains publiées en un jour : la suite demain.';
  end if;
  if coalesce(p_show_name, false) then
    select nullif(split_part(trim(m.name), ' ', 1), '') into v_name
      from public.club_members m where m.user_id = auth.uid() and m.active;
  end if;
  insert into public.carnet_hands (author, author_name, hand, options)
  values (auth.uid(), left(v_name, 40), p_hand, p_options)
  returning id into v_id;
  return v_id;
end $$;

-- Vote (ou change son vote) : une réponse proposée, deux raisons au plus.
create or replace function public.carnet_vote(p_hand uuid, p_choice int, p_reasons int[] default '{}') returns void
language plpgsql security definer set search_path = '' as $$
declare
  h public.carnet_hands;
begin
  perform public.carnet_member_check();
  select * into h from public.carnet_hands where id = p_hand;
  if h.id is null or h.hidden then
    raise exception 'Main introuvable.';
  end if;
  if h.author = auth.uid() then
    raise exception 'C''est ta main : tu vois les votes sans voter.';
  end if;
  if p_choice is null or p_choice < 0 or p_choice >= jsonb_array_length(h.options) then
    raise exception 'Réponse inconnue.';
  end if;
  p_reasons := coalesce(p_reasons, '{}');
  if cardinality(p_reasons) > 2
     or exists (select 1 from unnest(p_reasons) r where r is null or r not between 0 and 7)
     or cardinality(p_reasons) <> (select count(distinct r) from unnest(p_reasons) r) then
    raise exception 'Deux raisons au plus, parmi celles proposées.';
  end if;
  insert into public.carnet_votes (hand_id, voter, choice, reasons)
  values (p_hand, auth.uid(), p_choice, p_reasons::smallint[])
  on conflict (hand_id, voter) do update set choice = excluded.choice, reasons = excluded.reasons, created_at = now();
end $$;

-- Les mains du club (ou une seule), les plus récentes d'abord. Résultats : après son vote,
-- pour l'auteur et pour l'équipe. Une main retirée ne reste visible que de son auteur et de l'équipe.
create or replace function public.carnet_feed(p_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_staff boolean;
begin
  if not public.club_is_member() then
    return jsonb_build_object('member', false, 'staff', false, 'hands', '[]'::jsonb);
  end if;
  v_staff := public.club_is_staff();
  return jsonb_build_object('member', true, 'staff', v_staff, 'hands', coalesce((
    select jsonb_agg(x.item order by x.created_at desc) from (
      select h.created_at, jsonb_build_object(
        'id', h.id,
        'author_name', h.author_name,
        'mine', h.author = auth.uid(),
        'hand', h.hand,
        'options', h.options,
        'hidden', h.hidden,
        'created_at', h.created_at,
        'votes', (select count(*) from public.carnet_votes v where v.hand_id = h.id),
        'my_vote', mv.choice,
        'my_reasons', coalesce(to_jsonb(mv.reasons), '[]'::jsonb),
        'results', case when h.author = auth.uid() or mv.choice is not null or v_staff
                        then public.carnet_results(h.id, jsonb_array_length(h.options)) end
      ) as item
      from public.carnet_hands h
      left join public.carnet_votes mv on mv.hand_id = h.id and mv.voter = auth.uid()
      where (p_id is null or h.id = p_id) and (not h.hidden or h.author = auth.uid() or v_staff)
      order by h.created_at desc
      limit 100
    ) x), '[]'::jsonb));
end $$;

-- Retire sa main (ou, pour l'équipe, n'importe laquelle) : ses votes partent avec elle.
create or replace function public.carnet_delete(p_hand uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.carnet_hands where id = p_hand and (author = auth.uid() or public.club_is_staff());
  if not found then
    raise exception 'Main introuvable, ou publiée par quelqu''un d''autre.';
  end if;
end $$;

-- L'équipe masque une main (ou la remet) sans la supprimer.
create or replace function public.carnet_hide(p_hand uuid, p_hidden boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.club_is_staff() then
    raise exception 'Réservé aux gestionnaires.';
  end if;
  update public.carnet_hands set hidden = coalesce(p_hidden, true) where id = p_hand;
  if not found then
    raise exception 'Main introuvable.';
  end if;
end $$;

revoke all on function public.carnet_member_check(), public.carnet_results(uuid, int),
  public.carnet_publish(jsonb, jsonb, boolean), public.carnet_vote(uuid, int, int[]), public.carnet_feed(uuid),
  public.carnet_delete(uuid), public.carnet_hide(uuid, boolean) from public, anon, authenticated;
grant execute on function public.carnet_publish(jsonb, jsonb, boolean), public.carnet_vote(uuid, int, int[]),
  public.carnet_feed(uuid), public.carnet_delete(uuid), public.carnet_hide(uuid, boolean) to authenticated;

commit;

notify pgrst, 'reload schema';

-- Bilan affiché à la fin.
select
  (select count(*) from pg_tables where schemaname = 'public' and tablename in ('carnet_hands', 'carnet_votes')) as tables_carnet,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('carnet_publish', 'carnet_vote', 'carnet_feed', 'carnet_delete', 'carnet_hide')) as fonctions_carnet;
