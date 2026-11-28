-- ════════════════════════════════════════════════════════════════════════════
--  PPC · Carnet de mains : plusieurs questions dans une même main
--
--  À exécuter UNE FOIS dans l'éditeur SQL, après 005_carnet.sql.
--  Le script peut être relancé sans risque : il ne supprime aucune donnée.
--
--  Une main soumise au vote peut maintenant poser jusqu'à quatre questions
--  « Et toi, tu fais quoi ? » (au flop, puis à la turn…). On y répond dans
--  l'ordre, et chaque question a ses propres totaux.
--
--  Les mains déjà publiées deviennent des mains à une question, avec leurs votes.
--  Une fois ce script passé, ne relance plus 005_carnet.sql : il s'arrêterait sur
--  une erreur sans rien changer (ce script-ci, lui, se relance sans souci).
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── Tables ──────────────────────────────────────────────────────────────────

-- options : une liste de réponses par question (avant : une seule liste).
alter table public.carnet_hands drop constraint if exists carnet_hands_options;
alter table public.carnet_hands drop constraint if exists carnet_hands_size;
update public.carnet_hands set options = jsonb_build_array(options)
 where jsonb_typeof(options -> 0) = 'object';
update public.carnet_hands
   set hand = (hand - 'decision') || jsonb_build_object('decisions', jsonb_build_array(hand -> 'decision'))
 where jsonb_typeof(hand -> 'decision') = 'number';
alter table public.carnet_hands add constraint carnet_hands_options
  check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 1 and 4);
alter table public.carnet_hands add constraint carnet_hands_size
  check (octet_length(hand::text) <= 20000 and octet_length(options::text) <= 6000);

-- Un vote par question : les votes existants sont ceux de la première.
alter table public.carnet_votes add column if not exists step smallint not null default 0;
alter table public.carnet_votes drop constraint if exists carnet_votes_step;
alter table public.carnet_votes add constraint carnet_votes_step check (step between 0 and 3);
alter table public.carnet_votes drop constraint if exists carnet_votes_pkey;
alter table public.carnet_votes add constraint carnet_votes_pkey primary key (hand_id, voter, step);

-- ── Fonctions ───────────────────────────────────────────────────────────────

-- Les signatures changent : on retire les anciennes (les mains et les votes restent).
drop function if exists public.carnet_results(uuid, int);
drop function if exists public.carnet_publish(jsonb, jsonb, boolean);
drop function if exists public.carnet_vote(uuid, int, int[]);

-- Totaux d'une question : votes par réponse, raisons par réponse. Jamais appelée directement.
create or replace function public.carnet_results(p_hand uuid, p_step int, p_n int) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'total', (select count(*) from public.carnet_votes v where v.hand_id = p_hand and v.step = p_step),
    'counts', (select jsonb_agg((select count(*) from public.carnet_votes v
                                 where v.hand_id = p_hand and v.step = p_step and v.choice = c) order by c)
               from generate_series(0, p_n - 1) c),
    'reasons', (select jsonb_agg((
                  select jsonb_agg((select count(*) from public.carnet_votes v
                                    where v.hand_id = p_hand and v.step = p_step and v.choice = c and r = any (v.reasons)) order by r)
                  from generate_series(0, 7) r) order by c)
                from generate_series(0, p_n - 1) c)
  )
$$;

-- Publie une main et ses questions (une liste de réponses par question) ; renvoie son identifiant.
-- La note personnelle n'est jamais gardée.
create or replace function public.carnet_publish(p_hand jsonb, p_steps jsonb, p_show_name boolean default false) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_name text;
begin
  perform public.carnet_member_check();
  if p_hand is null or jsonb_typeof(p_hand) <> 'object'
     or jsonb_typeof(p_hand -> 'seats') is distinct from 'array'
     or jsonb_typeof(p_hand -> 'actions') is distinct from 'array'
     or jsonb_typeof(p_hand -> 'decisions') is distinct from 'array' then
    raise exception 'Main illisible.';
  end if;
  select jsonb_object_agg(e.key, e.value) into p_hand from jsonb_each(p_hand) e
   where e.key in ('v', 'date', 'ctx', 'seats', 'hero', 'actions', 'board', 'decisions', 'winners', 'tags', 'complete');
  if p_steps is null or jsonb_typeof(p_steps) <> 'array' or jsonb_array_length(p_steps) not between 1 and 4
     or jsonb_array_length(p_steps) <> jsonb_array_length(p_hand -> 'decisions')
     or exists (select 1 from jsonb_array_elements(p_steps) s
                where jsonb_typeof(s) <> 'array' or jsonb_array_length(s) not between 2 and 6
                   or exists (select 1 from jsonb_array_elements(s) o
                              where jsonb_typeof(o) <> 'object' or coalesce(o ->> 'k', '') not in ('fold', 'check', 'call', 'bet', 'raise'))) then
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
  values (auth.uid(), left(v_name, 40), p_hand, p_steps)
  returning id into v_id;
  return v_id;
end $$;

-- Vote (ou change son vote) sur une question : une réponse proposée, deux raisons au plus.
create or replace function public.carnet_vote(p_hand uuid, p_step int, p_choice int, p_reasons int[] default '{}') returns void
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
  if p_step is null or p_step < 0 or p_step >= jsonb_array_length(h.options) then
    raise exception 'Question inconnue.';
  end if;
  if p_choice is null or p_choice < 0 or p_choice >= jsonb_array_length(h.options -> p_step) then
    raise exception 'Réponse inconnue.';
  end if;
  p_reasons := coalesce(p_reasons, '{}');
  if cardinality(p_reasons) > 2
     or exists (select 1 from unnest(p_reasons) r where r is null or r not between 0 and 7)
     or cardinality(p_reasons) <> (select count(distinct r) from unnest(p_reasons) r) then
    raise exception 'Deux raisons au plus, parmi celles proposées.';
  end if;
  insert into public.carnet_votes (hand_id, voter, step, choice, reasons)
  values (p_hand, auth.uid(), p_step, p_choice, p_reasons::smallint[])
  on conflict (hand_id, voter, step) do update set choice = excluded.choice, reasons = excluded.reasons, created_at = now();
end $$;

-- Les mains du club (ou une seule), les plus récentes d'abord. Pour chaque question : mon vote,
-- et les totaux après y avoir répondu (toujours pour l'auteur et l'équipe).
-- Une main retirée ne reste visible que de son auteur et de l'équipe.
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
        'votes', (select count(distinct v.voter) from public.carnet_votes v where v.hand_id = h.id),
        'my_votes', (
          select jsonb_agg((
            select jsonb_build_object('choice', mv.choice, 'reasons', to_jsonb(mv.reasons))
              from public.carnet_votes mv where mv.hand_id = h.id and mv.voter = auth.uid() and mv.step = s) order by s)
            from generate_series(0, jsonb_array_length(h.options) - 1) s),
        'results', (
          select jsonb_agg(case
              when h.author = auth.uid() or v_staff
                or exists (select 1 from public.carnet_votes mv where mv.hand_id = h.id and mv.voter = auth.uid() and mv.step = s)
              then public.carnet_results(h.id, s, jsonb_array_length(h.options -> s)) end order by s)
            from generate_series(0, jsonb_array_length(h.options) - 1) s)
      ) as item
      from public.carnet_hands h
      where (p_id is null or h.id = p_id) and (not h.hidden or h.author = auth.uid() or v_staff)
      order by h.created_at desc
      limit 100
    ) x), '[]'::jsonb));
end $$;

revoke all on function public.carnet_results(uuid, int, int), public.carnet_publish(jsonb, jsonb, boolean),
  public.carnet_vote(uuid, int, int, int[]), public.carnet_feed(uuid) from public, anon, authenticated;
grant execute on function public.carnet_publish(jsonb, jsonb, boolean), public.carnet_vote(uuid, int, int, int[]),
  public.carnet_feed(uuid) to authenticated;

commit;

notify pgrst, 'reload schema';

-- Bilan affiché à la fin.
select
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('carnet_publish', 'carnet_vote', 'carnet_feed', 'carnet_delete', 'carnet_hide')) as fonctions_carnet,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'carnet_votes' and column_name = 'step') as votes_par_question;
