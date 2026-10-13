-- M1 · hardening da review (fresh-reviewer + qa-security). Le migrazioni 100000-100200 restano invariate.

-- ---------------------------------------------------------------------------
-- D/E. Stato `removed` per contenuti moderabili; schede pubbliche solo se approvate.
-- ---------------------------------------------------------------------------
alter table public.problems drop constraint problems_status_check,
  add constraint problems_status_check check (status in ('pending', 'active', 'merged', 'archived', 'removed'));
alter table public.proposals drop constraint proposals_status_check,
  add constraint proposals_status_check check (status in ('open', 'archived', 'removed'));
alter table public.problem_reformulations drop constraint problem_reformulations_status_check,
  add constraint problem_reformulations_status_check check (status in ('open', 'accepted', 'rejected', 'removed'));
alter table public.problem_facts drop constraint problem_facts_status_check,
  add constraint problem_facts_status_check check (status in ('proposed', 'approved', 'rejected', 'removed'));

drop policy problems_read on public.problems;
create policy problems_read on public.problems for select to anon, authenticated using (status <> 'removed');
drop policy proposals_read on public.proposals;
create policy proposals_read on public.proposals for select to anon, authenticated using (status <> 'removed');
drop policy problem_reformulations_read on public.problem_reformulations;
create policy problem_reformulations_read on public.problem_reformulations for select to anon, authenticated
  using (status <> 'removed');
drop policy problem_facts_read on public.problem_facts;
create policy problem_facts_read on public.problem_facts for select to anon, authenticated using (status = 'approved');

-- ---------------------------------------------------------------------------
-- G. Indici mancanti
-- ---------------------------------------------------------------------------
create index config_changelog_changed_by_idx on public.config_changelog (changed_by);
create index bar_messages_status_idx on public.bar_messages (status);

-- ---------------------------------------------------------------------------
-- H. Descrizioni della config (prima dei trigger: non sono modifiche di valore)
-- ---------------------------------------------------------------------------
update public.platform_config c set description = d.description
from (values
  ('problem_support_threshold', 'Sostegni necessari perché un problema diventi attivo'),
  ('reformulation_min_votes', 'Voti minimi perché una riformulazione possa sostituire il testo attuale'),
  ('piazza_max_chars', 'Lunghezza massima di un messaggio in Piazza (caratteri)'),
  ('bar_max_chars', 'Lunghezza massima di un messaggio al Bar (caratteri)'),
  ('bar_retention_days', 'Giorni dopo i quali i messaggi del Bar si cancellano'),
  ('min_account_age_days_for_engine', 'Età minima dell''account (giorni) perché i suoi voti entrino nel motore'),
  ('min_votes_participant', 'Voti minimi di un partecipante per entrare nel calcolo del motore'),
  ('min_votes_item', 'Voti minimi su un elemento per calcolarne il consenso e mostrarne i conteggi'),
  ('min_votes_per_cluster', 'Voti minimi di un gruppo su un elemento per stimarne l''approvazione'),
  ('min_participants_for_clustering', 'Partecipanti minimi per formare i gruppi d''opinione'),
  ('k_min', 'Numero minimo di gruppi d''opinione provati dal motore'),
  ('k_max', 'Numero massimo di gruppi d''opinione provati dal motore'),
  ('bridging_threshold', 'Approvazione minima in ogni gruppo per una proposta ponte (0-1)'),
  ('bridging_stable_runs', 'Run consecutive in cui una proposta deve restare ponte per essere stabile'),
  ('divisive_gap', 'Differenza di approvazione tra gruppi oltre la quale un elemento è divisivo (0-1)'),
  ('majority_threshold', 'Approvazione totale minima per un elemento maggioritario (0-1)'),
  ('promotion_min_bridging', 'Consenso trasversale minimo per promuovere un messaggio di Piazza a proposta (0-1)'),
  ('promotion_min_votes', 'Voti minimi per promuovere un messaggio di Piazza a proposta'),
  ('piazza_new_window_hours', 'Ore in cui un messaggio di Piazza resta nella lista "Nuovi"'),
  ('rate_limits', 'Contenuti massimi al giorno per utente, per tipo'),
  ('slowmode_window_min', 'Finestra (minuti) su cui si misura l''attività di un thread per lo slow mode'),
  ('slowmode_trigger_msgs', 'Messaggi nella finestra che attivano lo slow mode'),
  ('slowmode_user_interval_min', 'Minuti tra due messaggi dello stesso utente in slow mode'),
  ('jury_size', 'Membri di una giuria'),
  ('jury_min_buckets', 'Gruppi d''opinione diversi minimi in una giuria'),
  ('jury_deadline_hours', 'Ore a disposizione della giuria per decidere'),
  ('jury_min_votes', 'Voti minimi perché la decisione della giuria sia valida'),
  ('jury_max_redraws', 'Nuove estrazioni massime prima di passare all''admin'),
  ('jury_no_sanction_days', 'Giorni senza sanzioni richiesti per fare il giurato'),
  ('auto_collapse_reports', 'Segnalazioni che chiudono un contenuto in attesa di giuria'),
  ('l4_sla_hours', 'Ore entro cui l''admin gestisce una segnalazione di livello 4'),
  ('sanction_decay_days', 'Giorni senza violazioni dopo i quali lo storico sanzioni decade'),
  ('filter_l3_blocks_pause', 'Blocchi di livello 3 del filtro in 24 ore che attivano una pausa di scrittura'),
  ('filter_pause_minutes', 'Durata in minuti della pausa di scrittura dopo troppi blocchi'),
  ('curators_count', 'Curatori estratti per mandato'),
  ('curator_term_months', 'Durata in mesi del mandato dei curatori'),
  ('curator_min_account_days', 'Età minima dell''account (giorni) per candidarsi curatore'),
  ('curator_reputation_percentile', 'Percentile minimo di reputazione per candidarsi curatore'),
  ('curator_no_sanction_days', 'Giorni senza sanzioni richiesti per candidarsi curatore'),
  ('curator_merge_approvals', 'Approvazioni di curatori necessarie per unire due problemi'),
  ('juror_min_account_days', 'Età minima dell''account (giorni) per fare il giurato'),
  ('reputation_half_life_days', 'Giorni in cui la reputazione si dimezza'),
  ('agenda_top_arguments', 'Argomenti pro e contro mostrati per proposta nell''Agenda'),
  ('account_deletion_mode', 'Cosa succede ai contenuti pubblici quando un account si cancella (anonymize o delete)')
) as d(key, description)
where c.key = d.key;

-- ---------------------------------------------------------------------------
-- B. config_changelog append-only; modifiche dirette a platform_config comunque registrate.
-- ---------------------------------------------------------------------------
create or replace function private.config_changelog_append_only()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Unica eccezione: ON DELETE SET NULL della FK changed_by quando si cancella un utente.
  if tg_op = 'UPDATE'
     and old.changed_by is not null and new.changed_by is null
     and new.id = old.id and new.key = old.key
     and new.old_value is not distinct from old.old_value and new.new_value = old.new_value
     and new.reason = old.reason and new.changed_at = old.changed_at then
    return new;
  end if;
  raise exception 'config_changelog_append_only';
end;
$$;
revoke execute on function private.config_changelog_append_only() from public, anon, authenticated;

create trigger config_changelog_no_update_delete
  before update or delete on public.config_changelog
  for each row execute function private.config_changelog_append_only();
create trigger config_changelog_no_truncate
  before truncate on public.config_changelog
  for each statement execute function private.config_changelog_append_only();

create or replace function private.platform_config_log_direct_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.value is distinct from old.value
     and coalesce(current_setting('arengo.config_via_rpc', true), '') <> 'on' then
    insert into public.config_changelog (key, old_value, new_value, reason, changed_by)
    values (new.key, old.value, new.value, 'modifica diretta senza funzione', auth.uid());
  end if;
  return null;
end;
$$;
revoke execute on function private.platform_config_log_direct_update() from public, anon, authenticated;

create trigger platform_config_log_direct_update
  after update on public.platform_config
  for each row execute function private.platform_config_log_direct_update();

-- ---------------------------------------------------------------------------
-- C. admin_set_config valida il valore e segnala al trigger che il changelog lo scrive lei.
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_config(key text, value jsonb, reason text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_num numeric;
  v_other numeric;
  v_entry record;
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;
  if admin_set_config.reason is null or length(btrim(admin_set_config.reason)) = 0 then
    raise exception 'reason_required';
  end if;
  if admin_set_config.value is null then
    raise exception 'invalid_config_value';
  end if;
  select c.value into v_old from public.platform_config c where c.key = admin_set_config.key for update;
  if not found then
    raise exception 'unknown_key';
  end if;
  if jsonb_typeof(admin_set_config.value) <> jsonb_typeof(v_old) then
    raise exception 'invalid_config_value';
  end if;

  if jsonb_typeof(admin_set_config.value) = 'number' then
    v_num := (admin_set_config.value #>> '{}')::numeric;
    if v_num < 0 then
      raise exception 'invalid_config_value';
    end if;
    if admin_set_config.key in ('bridging_threshold', 'divisive_gap', 'majority_threshold', 'promotion_min_bridging') then
      if v_num > 1 then
        raise exception 'invalid_config_value';
      end if;
    elsif v_num <> trunc(v_num) then
      raise exception 'invalid_config_value';
    end if;
    if admin_set_config.key = 'k_min' then
      select (c.value #>> '{}')::numeric into v_other from public.platform_config c where c.key = 'k_max';
      if v_num > v_other then
        raise exception 'invalid_config_value';
      end if;
    elsif admin_set_config.key = 'k_max' then
      select (c.value #>> '{}')::numeric into v_other from public.platform_config c where c.key = 'k_min';
      if v_num < v_other then
        raise exception 'invalid_config_value';
      end if;
    end if;
  elsif jsonb_typeof(admin_set_config.value) = 'object' then
    for v_entry in select * from jsonb_each(admin_set_config.value) loop
      if jsonb_typeof(v_entry.value) <> 'number'
         or (v_entry.value #>> '{}')::numeric < 0
         or (v_entry.value #>> '{}')::numeric <> trunc((v_entry.value #>> '{}')::numeric) then
        raise exception 'invalid_config_value';
      end if;
    end loop;
  end if;
  if admin_set_config.key = 'account_deletion_mode'
     and admin_set_config.value #>> '{}' not in ('anonymize', 'delete') then
    raise exception 'invalid_config_value';
  end if;

  perform pg_catalog.set_config('arengo.config_via_rpc', 'on', true);
  update public.platform_config c
  set value = admin_set_config.value, updated_at = now()
  where c.key = admin_set_config.key;
  perform pg_catalog.set_config('arengo.config_via_rpc', 'off', true);

  insert into public.config_changelog (key, old_value, new_value, reason, changed_by)
  values (admin_set_config.key, v_old, admin_set_config.value, btrim(admin_set_config.reason), auth.uid());
end;
$$;
revoke execute on function public.admin_set_config(text, jsonb, text) from public, anon, authenticated;
grant execute on function public.admin_set_config(text, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- F. Profilo cancellato → account_deleted.
-- ---------------------------------------------------------------------------
create or replace function private.assert_can_vote()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_profile from public.profiles p where p.id = v_uid;
  if not found then
    raise exception 'onboarding_incomplete';
  end if;
  if v_profile.deleted_at is not null then
    raise exception 'account_deleted';
  end if;
  if v_profile.adult_declared_at is null
     or v_profile.rules_version_accepted is null
     or v_profile.consent_art9_at is null then
    raise exception 'onboarding_incomplete';
  end if;
  if v_profile.status = 'banned'
     or (v_profile.status = 'suspended'
         and (v_profile.suspended_until is null or v_profile.suspended_until > now())) then
    raise exception 'account_not_active';
  end if;
  return v_uid;
end;
$$;
revoke execute on function private.assert_can_vote() from public, anon, authenticated;

-- cast_vote: value null → invalid_value (prima finiva in 23502 sul NOT NULL).
create or replace function public.cast_vote(item_type text, item_id uuid, value integer)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_pseudo text;
begin
  if cast_vote.value is null then
    raise exception 'invalid_value';
  end if;
  v_pseudo := private.pseudo(private.assert_can_vote());

  case cast_vote.item_type
    when 'proposal' then
      if cast_vote.value not in (-1, 0, 1) then
        raise exception 'invalid_value';
      end if;
      perform 1 from public.proposals pr where pr.id = cast_vote.item_id and pr.status = 'open';
      if not found then
        raise exception 'item_not_votable';
      end if;
      insert into public.proposal_votes (proposal_id, voter_pseudo, value)
      values (cast_vote.item_id, v_pseudo, cast_vote.value)
      on conflict on constraint proposal_votes_pkey
      do update set value = excluded.value, updated_at = now();

    when 'piazza' then
      if cast_vote.value not in (-1, 0, 1) then
        raise exception 'invalid_value';
      end if;
      perform 1 from public.piazza_messages m where m.id = cast_vote.item_id and m.status <> 'removed';
      if not found then
        raise exception 'item_not_votable';
      end if;
      insert into public.piazza_votes (message_id, voter_pseudo, value)
      values (cast_vote.item_id, v_pseudo, cast_vote.value)
      on conflict on constraint piazza_votes_pkey
      do update set value = excluded.value, updated_at = now();

    when 'reformulation' then
      if cast_vote.value not in (-1, 1) then
        raise exception 'invalid_value';
      end if;
      perform 1 from public.problem_reformulations r where r.id = cast_vote.item_id and r.status = 'open';
      if not found then
        raise exception 'item_not_votable';
      end if;
      insert into public.problem_reformulation_votes (reformulation_id, voter_pseudo, value)
      values (cast_vote.item_id, v_pseudo, cast_vote.value)
      on conflict on constraint problem_reformulation_votes_pkey
      do update set value = excluded.value, updated_at = now();

    else
      raise exception 'invalid_item_type';
  end case;
end;
$$;
revoke execute on function public.cast_vote(text, uuid, integer) from public, anon, authenticated;
grant execute on function public.cast_vote(text, uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- J. Timestamp dei voti troncati al giorno (UTC): meno correlazione con i log, il motore non li usa.
-- ---------------------------------------------------------------------------
create or replace function private.truncate_vote_timestamps()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := to_jsonb(new);
  v_patch jsonb := '{}'::jsonb;
  v_col text;
begin
  foreach v_col in array array['voted_at', 'created_at', 'updated_at'] loop
    if v_row ? v_col and v_row ->> v_col is not null then
      v_patch := v_patch || jsonb_build_object(v_col, date_trunc('day', (v_row ->> v_col)::timestamptz, 'UTC'));
    end if;
  end loop;
  return jsonb_populate_record(new, v_patch);
end;
$$;
revoke execute on function private.truncate_vote_timestamps() from public, anon, authenticated;

create trigger proposal_votes_truncate_ts before insert or update on public.proposal_votes
  for each row execute function private.truncate_vote_timestamps();
create trigger piazza_votes_truncate_ts before insert or update on public.piazza_votes
  for each row execute function private.truncate_vote_timestamps();
create trigger problem_supports_truncate_ts before insert or update on public.problem_supports
  for each row execute function private.truncate_vote_timestamps();
create trigger argument_ratings_truncate_ts before insert or update on public.argument_ratings
  for each row execute function private.truncate_vote_timestamps();
create trigger problem_reformulation_votes_truncate_ts before insert or update on public.problem_reformulation_votes
  for each row execute function private.truncate_vote_timestamps();

-- ---------------------------------------------------------------------------
-- A. Conteggi solo sopra min_votes_item (attacco differenziale); I. Piazza senza risposte a rimossi.
-- Nuove colonne in coda (create or replace view). Chiave mancante in config → conteggi nascosti.
-- ---------------------------------------------------------------------------
create or replace view public.proposal_tallies with (security_invoker = false, security_barrier = true) as
with t as (
  select v.proposal_id,
    count(*) filter (where v.value = 1)::integer as agree,
    count(*) filter (where v.value = -1)::integer as disagree,
    count(*) filter (where v.value = 0)::integer as pass,
    count(*)::integer as total
  from public.proposal_votes v
  join public.proposals pr on pr.id = v.proposal_id and pr.status <> 'removed'
  group by v.proposal_id
), th as (
  select coalesce(t.total < (select (c.value #>> '{}')::integer from public.platform_config c where c.key = 'min_votes_item'), true)
    as below, t.*
  from t
)
select th.proposal_id,
  case when not th.below then th.agree end as agree,
  case when not th.below then th.disagree end as disagree,
  case when not th.below then th.pass end as pass,
  case when not th.below then th.total end as total,
  th.below as below_threshold
from th;

create or replace view public.piazza_tallies with (security_invoker = false, security_barrier = true) as
with t as (
  select v.message_id,
    count(*) filter (where v.value = 1)::integer as agree,
    count(*) filter (where v.value = -1)::integer as disagree,
    count(*) filter (where v.value = 0)::integer as pass,
    count(*)::integer as total
  from public.piazza_votes v
  join public.piazza_messages m on m.id = v.message_id and m.status <> 'removed'
  group by v.message_id
), th as (
  select coalesce(t.total < (select (c.value #>> '{}')::integer from public.platform_config c where c.key = 'min_votes_item'), true)
    as below, t.*
  from t
)
select th.message_id,
  case when not th.below then th.agree end as agree,
  case when not th.below then th.disagree end as disagree,
  case when not th.below then th.pass end as pass,
  case when not th.below then th.total end as total,
  th.below as below_threshold
from th;

create or replace view public.argument_utility with (security_invoker = false, security_barrier = true) as
with t as (
  select r.argument_id,
    count(*) filter (where r.useful)::integer as useful,
    count(*) filter (where not r.useful)::integer as not_useful,
    count(*)::integer as total
  from public.argument_ratings r
  join public.arguments a on a.id = r.argument_id and a.status <> 'removed'
  group by r.argument_id
), th as (
  select coalesce(t.total < (select (c.value #>> '{}')::integer from public.platform_config c where c.key = 'min_votes_item'), true)
    as below, t.*
  from t
)
select th.argument_id,
  case when not th.below then th.useful end as useful,
  case when not th.below then th.not_useful end as not_useful,
  case when not th.below then th.total end as total,
  th.below as below_threshold
from th;

create or replace view public.piazza_public with (security_invoker = false, security_barrier = true) as
select m.id, m.topic_id, m.problem_id, m.parent_id, m.depth, m.body, m.status, m.bridging_score, m.created_at,
  case when pf.deleted_at is null then pf.handle end as handle
from public.piazza_messages m
left join public.piazza_messages parent on parent.id = m.parent_id
left join public.profiles pf on pf.id = m.author_id
where m.status <> 'removed'
  and (m.parent_id is null or parent.status <> 'removed');

-- Le viste ricreate mantengono i grant; si riaffermano per chiarezza.
revoke all on public.proposal_tallies, public.piazza_tallies, public.argument_utility, public.piazza_public
  from anon, authenticated;
grant select on public.proposal_tallies, public.piazza_tallies, public.argument_utility, public.piazza_public
  to anon, authenticated;
