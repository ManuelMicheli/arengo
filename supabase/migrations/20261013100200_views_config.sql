-- M1 · 1.3 — Viste pubbliche, aggregati, admin_set_config, seed di platform_config.
--
-- Viste con security_invoker = true: problems_public, proposals_public, arguments_public.
--   Le RLS e i grant per colonna delle tabelle sottostanti valgono anche per la vista.
-- Viste con i permessi del proprietario (security_invoker = false, security_barrier):
--   piazza_public, bar_public → servono l'handle senza concedere lettura di profiles (niente profili pubblici)
--   e la tabella dei messaggi non è leggibile direttamente (contiene author_id).
--   proposal_tallies, piazza_tallies, argument_utility → aggregano tabelle di voto che nessun ruolo
--   applicativo può leggere; espongono solo conteggi, mai voter_pseudo.

create view public.problems_public with (security_invoker = true) as
select p.id, p.topic_id, p.title, p.body, p.affected, p.status, p.merged_into, p.created_at, p.activated_at
from public.problems p;

create view public.proposals_public with (security_invoker = true) as
select pr.id, pr.problem_id, pr.what, pr.how, pr.cost_and_funding, pr.risks, pr.foreign_example,
  pr.foreign_source_id, pr.origin, pr.origin_message_id, pr.status, pr.created_at
from public.proposals pr;

create view public.arguments_public with (security_invoker = true) as
select a.id, a.proposal_id, a.side, a.body, a.status, a.cross_utility, a.created_at
from public.arguments a;

create view public.piazza_public with (security_invoker = false, security_barrier = true) as
select m.id, m.topic_id, m.problem_id, m.parent_id, m.depth, m.body, m.status, m.bridging_score, m.created_at,
  case when pf.deleted_at is null then pf.handle end as handle
from public.piazza_messages m
left join public.profiles pf on pf.id = m.author_id
where m.status <> 'removed';

create view public.bar_public with (security_invoker = false, security_barrier = true) as
select b.id, b.topic_id, b.parent_id, b.depth, b.body, b.status, b.created_at, b.expires_at,
  case when pf.deleted_at is null then pf.handle end as handle
from public.bar_messages b
left join public.profiles pf on pf.id = b.author_id
where b.status <> 'removed' and b.expires_at > now();

create view public.proposal_tallies with (security_invoker = false, security_barrier = true) as
select v.proposal_id,
  count(*) filter (where v.value = 1)::integer as agree,
  count(*) filter (where v.value = -1)::integer as disagree,
  count(*) filter (where v.value = 0)::integer as pass,
  count(*)::integer as total
from public.proposal_votes v
group by v.proposal_id;

create view public.piazza_tallies with (security_invoker = false, security_barrier = true) as
select v.message_id,
  count(*) filter (where v.value = 1)::integer as agree,
  count(*) filter (where v.value = -1)::integer as disagree,
  count(*) filter (where v.value = 0)::integer as pass,
  count(*)::integer as total
from public.piazza_votes v
join public.piazza_messages m on m.id = v.message_id and m.status <> 'removed'
group by v.message_id;

create view public.argument_utility with (security_invoker = false, security_barrier = true) as
select r.argument_id,
  count(*) filter (where r.useful)::integer as useful,
  count(*) filter (where not r.useful)::integer as not_useful,
  count(*)::integer as total
from public.argument_ratings r
join public.arguments a on a.id = r.argument_id and a.status <> 'removed'
group by r.argument_id;

revoke all on public.problems_public, public.proposals_public, public.arguments_public,
  public.piazza_public, public.bar_public,
  public.proposal_tallies, public.piazza_tallies, public.argument_utility
  from anon, authenticated;
grant select on public.problems_public, public.proposals_public, public.arguments_public,
  public.piazza_public, public.bar_public,
  public.proposal_tallies, public.piazza_tallies, public.argument_utility
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Ruolo admin applicativo = app_metadata.role nel JWT (impostabile solo lato server).
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') = 'admin';
$$;
revoke execute on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;

-- Unica via di modifica di platform_config: solo admin, motivazione obbligatoria, changelog pubblico.
-- Non crea chiavi nuove: le chiavi nascono solo da migrazione.
create or replace function public.admin_set_config(key text, value jsonb, reason text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;
  if admin_set_config.reason is null or length(btrim(admin_set_config.reason)) = 0 then
    raise exception 'reason_required';
  end if;
  if admin_set_config.value is null then
    raise exception 'invalid_value';
  end if;
  select c.value into v_old from public.platform_config c where c.key = admin_set_config.key for update;
  if not found then
    raise exception 'unknown_key';
  end if;
  update public.platform_config c
  set value = admin_set_config.value, updated_at = now()
  where c.key = admin_set_config.key;
  insert into public.config_changelog (key, old_value, new_value, reason, changed_by)
  values (admin_set_config.key, v_old, admin_set_config.value, btrim(admin_set_config.reason), auth.uid());
end;
$$;
revoke execute on function public.admin_set_config(text, jsonb, text) from public, anon, authenticated;
grant execute on function public.admin_set_config(text, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Seed di platform_config (valori iniziali da docs/PLAN.md, spec M1). rate_limits: al giorno.
-- ---------------------------------------------------------------------------
insert into public.platform_config (key, value) values
  ('problem_support_threshold', '25'),
  ('reformulation_min_votes', '10'),
  ('piazza_max_chars', '500'),
  ('bar_max_chars', '1000'),
  ('bar_retention_days', '60'),
  ('min_account_age_days_for_engine', '7'),
  ('min_votes_participant', '7'),
  ('min_votes_item', '5'),
  ('min_votes_per_cluster', '3'),
  ('min_participants_for_clustering', '50'),
  ('k_min', '2'),
  ('k_max', '5'),
  ('bridging_threshold', '0.6'),
  ('bridging_stable_runs', '2'),
  ('divisive_gap', '0.4'),
  ('majority_threshold', '0.6'),
  ('promotion_min_bridging', '0.6'),
  ('promotion_min_votes', '15'),
  ('piazza_new_window_hours', '24'),
  ('rate_limits', '{"problems": 1, "proposals": 3, "arguments": 10, "piazza": 30, "bar": 60, "reports": 20}'),
  ('slowmode_window_min', '10'),
  ('slowmode_trigger_msgs', '20'),
  ('slowmode_user_interval_min', '5'),
  ('jury_size', '5'),
  ('jury_min_buckets', '3'),
  ('jury_deadline_hours', '48'),
  ('jury_min_votes', '3'),
  ('jury_max_redraws', '2'),
  ('jury_no_sanction_days', '90'),
  ('auto_collapse_reports', '5'),
  ('l4_sla_hours', '24'),
  ('sanction_decay_days', '180'),
  ('filter_l3_blocks_pause', '3'),
  ('filter_pause_minutes', '10'),
  ('curators_count', '7'),
  ('curator_term_months', '3'),
  ('curator_min_account_days', '60'),
  ('curator_reputation_percentile', '80'),
  ('curator_no_sanction_days', '180'),
  ('curator_merge_approvals', '2'),
  ('juror_min_account_days', '30'),
  ('reputation_half_life_days', '90'),
  ('agenda_top_arguments', '2'),
  ('account_deletion_mode', '"anonymize"');
