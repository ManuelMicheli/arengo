-- M3 · auth, onboarding, privacy: onboarding e cancellazione solo dal server (service role) con l'utente
-- della sessione verificata, export dei propri dati, sospensioni, guardia sul segreto di test dei pseudo.

-- ---------------------------------------------------------------------------
-- 1. Config
-- ---------------------------------------------------------------------------
insert into public.platform_config (key, value, description) values
  ('otp_rate_limits', '{"per_ip": 5, "per_phone": 3, "window_minutes": 15}',
   'Richieste di codice OTP consentite per IP e per numero nella finestra (minuti)'),
  ('current_rules_version', '"2026-10-v1"',
   'Versione delle regole e della Scala da accettare in onboarding');

-- ---------------------------------------------------------------------------
-- 2. Onboarding: chiamata dalla Server Action dopo guardContent sull'handle. Solo service role,
-- così nessuno salta il filtro chiamando l'RPC dal client. Errori: invalid_value, consent_required,
-- rules_version_mismatch, handle_taken, onboarding_already_complete, account_deleted.
-- ---------------------------------------------------------------------------
create or replace function public.complete_onboarding(
  user_id uuid, handle text, rules_version text, adult boolean, consent_art9 boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_rules text;
begin
  if complete_onboarding.user_id is null or complete_onboarding.handle is null
     or complete_onboarding.handle !~ '^[A-Za-z0-9_]{3,20}$' then
    raise exception 'invalid_value';
  end if;
  if complete_onboarding.adult is distinct from true or complete_onboarding.consent_art9 is distinct from true then
    raise exception 'consent_required';
  end if;
  select pc.value #>> '{}' into v_rules from public.platform_config pc where pc.key = 'current_rules_version';
  if complete_onboarding.rules_version is distinct from v_rules then
    raise exception 'rules_version_mismatch';
  end if;

  select * into v_profile from public.profiles p where p.id = complete_onboarding.user_id for update;
  if found then
    if v_profile.deleted_at is not null then
      raise exception 'account_deleted';
    end if;
    if v_profile.adult_declared_at is not null and v_profile.rules_version_accepted is not null
       and v_profile.consent_art9_at is not null and v_profile.handle is not null then
      raise exception 'onboarding_already_complete';
    end if;
  end if;

  if exists (select 1 from public.profiles p
             where lower(p.handle) = lower(complete_onboarding.handle) and p.id <> complete_onboarding.user_id) then
    raise exception 'handle_taken';
  end if;

  insert into public.profiles as p (id, handle, rules_version_accepted, consent_art9_at, adult_declared_at)
  values (complete_onboarding.user_id, complete_onboarding.handle, v_rules, now(), now())
  on conflict (id) do update set
    handle = excluded.handle,
    rules_version_accepted = excluded.rules_version_accepted,
    consent_art9_at = excluded.consent_art9_at,
    adult_declared_at = excluded.adult_declared_at;
exception
  when unique_violation then
    raise exception 'handle_taken';
end;
$$;
revoke execute on function public.complete_onboarding(uuid, text, text, boolean, boolean) from public, anon, authenticated;
grant execute on function public.complete_onboarding(uuid, text, text, boolean, boolean) to service_role;

-- Stato dell'onboarding per il redirect UX (proxy) e la pagina: solo l'utente corrente.
create or replace function public.my_onboarding_status()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then 'anonymous'
    when p.id is null then 'incomplete'
    when p.deleted_at is not null then 'deleted'
    when p.handle is null or p.adult_declared_at is null or p.rules_version_accepted is null
         or p.consent_art9_at is null then 'incomplete'
    else 'complete'
  end
  from (select 1) x
  left join public.profiles p on p.id = (select auth.uid());
$$;
revoke execute on function public.my_onboarding_status() from public, anon, authenticated;
grant execute on function public.my_onboarding_status() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Export (art. 20): profilo, contenuti propri, voti propri via pseudo. Solo dati dell'utente corrente.
-- ---------------------------------------------------------------------------
create or replace function public.export_my_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_pseudo text;
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
  v_pseudo := private.pseudo(v_uid);

  return jsonb_build_object(
    'exported_at', now(),
    -- Strike del filtro attivi: solo il numero (la tabella contiene solo utente e ora, mai testo).
    'filter_strikes_24h', (select count(*) from private.filter_strikes s where s.user_id = v_uid),
    'profile', jsonb_build_object(
      'handle', v_profile.handle, 'status', v_profile.status, 'suspended_until', v_profile.suspended_until,
      'rules_version_accepted', v_profile.rules_version_accepted, 'consent_art9_at', v_profile.consent_art9_at,
      'adult_declared_at', v_profile.adult_declared_at, 'created_at', v_profile.created_at),
    'problems', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'body', t.body,
        'affected', t.affected, 'status', t.status, 'created_at', t.created_at) order by t.created_at)
      from public.problems t where t.author_id = v_uid), '[]'),
    'reformulations', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'problem_id', t.problem_id,
        'title', t.title, 'body', t.body, 'status', t.status, 'created_at', t.created_at) order by t.created_at)
      from public.problem_reformulations t where t.author_id = v_uid), '[]'),
    'facts', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'problem_id', t.problem_id,
        'statement', t.statement, 'status', t.status, 'created_at', t.created_at) order by t.created_at)
      from public.problem_facts t where t.proposed_by = v_uid), '[]'),
    'sources', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'url', t.url, 'title', t.title,
        'kind', t.kind, 'created_at', t.created_at) order by t.created_at)
      from public.sources t where t.added_by = v_uid), '[]'),
    'proposals', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'problem_id', t.problem_id,
        'what', t.what, 'how', t.how, 'cost_and_funding', t.cost_and_funding, 'risks', t.risks,
        'foreign_example', t.foreign_example, 'status', t.status, 'created_at', t.created_at) order by t.created_at)
      from public.proposals t where t.author_id = v_uid), '[]'),
    'arguments', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'proposal_id', t.proposal_id,
        'side', t.side, 'body', t.body, 'status', t.status, 'created_at', t.created_at) order by t.created_at)
      from public.arguments t where t.author_id = v_uid), '[]'),
    'piazza_messages', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'topic_id', t.topic_id,
        'parent_id', t.parent_id, 'body', t.body, 'status', t.status, 'created_at', t.created_at) order by t.created_at)
      from public.piazza_messages t where t.author_id = v_uid), '[]'),
    'bar_messages', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'topic_id', t.topic_id,
        'parent_id', t.parent_id, 'body', t.body, 'created_at', t.created_at) order by t.created_at)
      from public.bar_messages t where t.author_id = v_uid), '[]'),
    'votes', jsonb_build_object(
      'problem_supports', coalesce((select jsonb_agg(jsonb_build_object('problem_id', v.problem_id,
          'created_at', v.created_at)) from public.problem_supports v where v.voter_pseudo = v_pseudo), '[]'),
      'reformulation_votes', coalesce((select jsonb_agg(jsonb_build_object('reformulation_id', v.reformulation_id,
          'value', v.value, 'updated_at', v.updated_at)) from public.problem_reformulation_votes v
        where v.voter_pseudo = v_pseudo), '[]'),
      'proposal_votes', coalesce((select jsonb_agg(jsonb_build_object('proposal_id', v.proposal_id,
          'value', v.value, 'updated_at', v.updated_at)) from public.proposal_votes v
        where v.voter_pseudo = v_pseudo), '[]'),
      'piazza_votes', coalesce((select jsonb_agg(jsonb_build_object('message_id', v.message_id,
          'value', v.value, 'updated_at', v.updated_at)) from public.piazza_votes v
        where v.voter_pseudo = v_pseudo), '[]'),
      'argument_ratings', coalesce((select jsonb_agg(jsonb_build_object('argument_id', v.argument_id,
          'useful', v.useful, 'created_at', v.created_at)) from public.argument_ratings v
        where v.rater_pseudo = v_pseudo), '[]'))
  );
end;
$$;
revoke execute on function public.export_my_data() from public, anon, authenticated;
grant execute on function public.export_my_data() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Cancellazione: solo service role con l'utente della sessione verificata; poi la Server Action
-- elimina auth.users (cascade su profilo e strike). Voti, sostegni, rating e Bar sempre eliminati.
-- account_deletion_mode = 'anonymize': contenuti pubblici restano senza autore.
-- account_deletion_mode = 'delete': testo di Piazza e argomenti sostituito e stato 'removed' (le risposte e i
-- rating altrui restano); problemi, riformulazioni, schede, fonti e proposte sempre anonimizzati, perché
-- altri utenti li hanno votati e ci hanno costruito sopra.
-- La reputazione (M6) andrà cancellata qui.
-- ---------------------------------------------------------------------------
create or replace function public.delete_account(user_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := delete_account.user_id;
  v_pseudo text;
  v_mode text;
begin
  if v_uid is null then
    raise exception 'invalid_value';
  end if;
  select pc.value #>> '{}' into v_mode from public.platform_config pc where pc.key = 'account_deletion_mode';
  if v_mode is null or v_mode not in ('anonymize', 'delete') then
    raise exception 'config_invalid';
  end if;
  v_pseudo := private.pseudo(v_uid);

  delete from public.problem_supports v where v.voter_pseudo = v_pseudo;
  delete from public.problem_reformulation_votes v where v.voter_pseudo = v_pseudo;
  delete from public.proposal_votes v where v.voter_pseudo = v_pseudo;
  delete from public.piazza_votes v where v.voter_pseudo = v_pseudo;
  delete from public.argument_ratings v where v.rater_pseudo = v_pseudo;
  delete from private.filter_strikes s where s.user_id = v_uid;

  -- Bar: eliminato; i messaggi con risposte altrui perdono testo e autore (le risposte restano).
  delete from public.bar_messages b
  where b.author_id = v_uid
    and not exists (select 1 from public.bar_messages r where r.parent_id = b.id and r.author_id is distinct from v_uid);
  update public.bar_messages b set body = 'Messaggio eliminato.', author_id = null, status = 'removed'
  where b.author_id = v_uid;

  if v_mode = 'delete' then
    update public.piazza_messages t set body = 'Messaggio eliminato.', status = 'removed' where t.author_id = v_uid;
    update public.arguments t set body = 'Argomento eliminato.', status = 'removed' where t.author_id = v_uid;
  end if;

  update public.problems t set author_id = null where t.author_id = v_uid;
  update public.problem_reformulations t set author_id = null where t.author_id = v_uid;
  update public.problem_facts t set proposed_by = null where t.proposed_by = v_uid;
  update public.problem_facts t set reviewed_by = null where t.reviewed_by = v_uid;
  update public.sources t set added_by = null where t.added_by = v_uid;
  update public.proposals t set author_id = null where t.author_id = v_uid;
  update public.arguments t set author_id = null where t.author_id = v_uid;
  update public.piazza_messages t set author_id = null where t.author_id = v_uid;

  update public.profiles p set handle = null, deleted_at = now() where p.id = v_uid;
end;
$$;
revoke execute on function public.delete_account(uuid) from public, anon, authenticated;
grant execute on function public.delete_account(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 5. Sospensione a tempo (le giurie la useranno da M7). La scadenza è automatica: assert_can_vote tratta
-- come attivo un utente con suspended_until nel passato.
-- ---------------------------------------------------------------------------
create or replace function public.suspend_user(user_id uuid, until timestamptz)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if suspend_user.user_id is null or suspend_user.until is null then
    raise exception 'invalid_value';
  end if;
  update public.profiles p set status = 'suspended', suspended_until = suspend_user.until
  where p.id = suspend_user.user_id and p.deleted_at is null and p.status <> 'banned';
  if not found then
    raise exception 'unknown_user';
  end if;
end;
$$;
revoke execute on function public.suspend_user(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.suspend_user(uuid, timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- 6. Guardia: true se il segreto dei pseudo è quello di test di supabase/seed.sql. App e motore rifiutano
-- di partire in produzione se è true. Qui c'è solo l'hash del valore di test (sha256 hex).
-- ---------------------------------------------------------------------------
create or replace function public.pseudo_secret_is_test()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  select ds.decrypted_secret into v_secret from vault.decrypted_secrets ds where ds.name = 'vote_pseudo_secret';
  if v_secret is null or v_secret = '' then
    raise exception 'pseudo_secret_missing';
  end if;
  return encode(extensions.digest(v_secret, 'sha256'), 'hex')
    = 'b330a9ee722b0297b6d4b23ff53685ab84181f34773ea3cc04b32d1c238b2f71';
end;
$$;
revoke execute on function public.pseudo_secret_is_test() from public, anon, authenticated;
grant execute on function public.pseudo_secret_is_test() to service_role;
