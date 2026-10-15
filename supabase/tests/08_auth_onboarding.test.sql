-- M3 · onboarding, sospensioni, export e cancellazione account, guardia sul segreto di test.
begin;
create extension if not exists pgtap with schema extensions;

select plan(38);

insert into auth.users (id, email) values
  ('31111111-1111-1111-1111-111111111111', 'nuovo@test.local'),
  ('32222222-2222-2222-2222-222222222222', 'altro@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'sospeso@test.local');
insert into public.profiles (id, handle, rules_version_accepted, consent_art9_at, adult_declared_at) values
  ('32222222-2222-2222-2222-222222222222', 'altro_utente', '2026-10-v1', now(), now()),
  ('33333333-3333-3333-3333-333333333333', 'da_sospendere', '2026-10-v1', now(), now());

insert into public.topics (id, slug, title, selection_criterion)
  values ('b0000000-0000-0000-0000-000000000001', 'lavoro', 'Lavoro', 'test');
insert into public.problems (id, topic_id, title, body, affected, status)
  values ('b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'P', 'B', 'A', 'active');
insert into public.proposals (id, problem_id, what, how, cost_and_funding, risks)
  values ('b0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002', 'w', 'h', 'c', 'r');

-- ---- Config ----
select is((select value from public.platform_config where key = 'otp_rate_limits'),
  '{"per_ip": 5, "per_phone": 3, "window_minutes": 15}'::jsonb, 'otp_rate_limits in config');
select is((select value #>> '{}' from public.platform_config where key = 'current_rules_version'), '2026-10-v1',
  'current_rules_version in config');

-- ---- Le RPC solo server non sono eseguibili dai client ----
select set_config('request.jwt.claims', '{"sub":"31111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.complete_onboarding('31111111-1111-1111-1111-111111111111', 'nuovo_utente', '2026-10-v1', true, true)$$,
  '42501', null, 'authenticated non chiama complete_onboarding');
select throws_ok($$select public.delete_account('32222222-2222-2222-2222-222222222222')$$, '42501', null,
  'authenticated non chiama delete_account');
select throws_ok($$select public.suspend_user('32222222-2222-2222-2222-222222222222', now() + interval '1 day')$$,
  '42501', null, 'authenticated non chiama suspend_user');
select throws_ok($$select public.pseudo_secret_is_test()$$, '42501', null, 'authenticated non chiama pseudo_secret_is_test');
select is(public.my_onboarding_status(), 'incomplete', 'senza profilo: onboarding incompleto');
select throws_ok($$select public.cast_vote('proposal', 'b0000000-0000-0000-0000-000000000003', 1)$$, 'P0001',
  'onboarding_incomplete', 'onboarding incompleto: voto negato');
select throws_ok($$select public.export_my_data()$$, 'P0001', 'onboarding_incomplete', 'export senza profilo negato');
reset role;

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok($$select public.complete_onboarding('31111111-1111-1111-1111-111111111111', 'nuovo_utente', '2026-10-v1', true, true)$$,
  '42501', null, 'anon non chiama complete_onboarding');
select throws_ok($$select public.export_my_data()$$, '42501', null, 'anon non chiama export_my_data');
reset role;

-- ---- complete_onboarding (service role) ----
set local role service_role;
select throws_ok($$select public.complete_onboarding('31111111-1111-1111-1111-111111111111', 'nuovo_utente', '2026-10-v1', true, false)$$,
  'P0001', 'consent_required', 'consenso art. 9 obbligatorio');
select throws_ok($$select public.complete_onboarding('31111111-1111-1111-1111-111111111111', 'nuovo_utente', '2026-10-v1', null, true)$$,
  'P0001', 'consent_required', 'maggiore età obbligatoria');
select throws_ok($$select public.complete_onboarding('31111111-1111-1111-1111-111111111111', 'nuovo_utente', 'vecchia', true, true)$$,
  'P0001', 'rules_version_mismatch', 'versione regole non corrente rifiutata');
select throws_ok($$select public.complete_onboarding('31111111-1111-1111-1111-111111111111', 'no spazi', '2026-10-v1', true, true)$$,
  'P0001', 'invalid_value', 'handle con formato non valido');
select throws_ok($$select public.complete_onboarding('31111111-1111-1111-1111-111111111111', 'ALTRO_UTENTE', '2026-10-v1', true, true)$$,
  'P0001', 'handle_taken', 'handle già usato (maiuscole ignorate)');
select lives_ok($$select public.complete_onboarding('31111111-1111-1111-1111-111111111111', 'nuovo_utente', '2026-10-v1', true, true)$$,
  'onboarding completato');
select throws_ok($$select public.complete_onboarding('31111111-1111-1111-1111-111111111111', 'altro_nome', '2026-10-v1', true, true)$$,
  'P0001', 'onboarding_already_complete', 'onboarding non ripetibile');
select is(public.pseudo_secret_is_test(), true, 'in CI il segreto è quello di test');
reset role;

select set_config('request.jwt.claims', '{"sub":"31111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select is(public.my_onboarding_status(), 'complete', 'onboarding completo');
select lives_ok($$select public.cast_vote('proposal', 'b0000000-0000-0000-0000-000000000003', 1)$$, 'dopo onboarding: voto consentito');
select lives_ok($$select public.support_problem('b0000000-0000-0000-0000-000000000002')$$, 'sostegno consentito');
reset role;

-- Contenuti dell'utente nuovo (scritti come in M4, qui direttamente) e un voto dell'altro utente.
insert into public.piazza_messages (id, topic_id, body, author_id) values
  ('b0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'mio messaggio', '31111111-1111-1111-1111-111111111111');
insert into public.arguments (id, proposal_id, side, body, author_id) values
  ('b0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000003', 'pro', 'mio argomento', '31111111-1111-1111-1111-111111111111');
insert into public.bar_messages (id, topic_id, body, author_id, expires_at) values
  ('b0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000001', 'chiacchiera', '31111111-1111-1111-1111-111111111111', now() + interval '1 day');
update public.problems set author_id = '31111111-1111-1111-1111-111111111111' where id = 'b0000000-0000-0000-0000-000000000002';

select set_config('request.jwt.claims', '{"sub":"32222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.cast_vote('proposal', 'b0000000-0000-0000-0000-000000000003', -1)$$, 'altro utente vota');

-- ---- Export: solo i propri dati ----
select set_config('request.jwt.claims', '{"sub":"31111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((public.export_my_data() #>> '{profile,handle}'), 'nuovo_utente', 'export: profilo proprio');
select is(jsonb_array_length(public.export_my_data() #> '{votes,proposal_votes}'), 1, 'export: solo il proprio voto');
select is((public.export_my_data() #>> '{votes,proposal_votes,0,value}'), '1', 'export: valore del proprio voto');
select is(jsonb_array_length(public.export_my_data() -> 'piazza_messages'), 1, 'export: propri messaggi');
select ok(public.export_my_data()::text not like '%32222222%', 'export: nessun id di altri utenti');
reset role;

-- ---- Cancellazione (mode di default: anonymize) ----
set local role service_role;
select lives_ok($$select public.delete_account('31111111-1111-1111-1111-111111111111')$$, 'account cancellato');
reset role;
select is((select count(*)::integer from public.proposal_votes where voter_pseudo = private.pseudo('31111111-1111-1111-1111-111111111111'))
  + (select count(*)::integer from public.problem_supports where voter_pseudo = private.pseudo('31111111-1111-1111-1111-111111111111'))
  + (select count(*)::integer from public.piazza_votes where voter_pseudo = private.pseudo('31111111-1111-1111-1111-111111111111'))
  + (select count(*)::integer from public.problem_reformulation_votes where voter_pseudo = private.pseudo('31111111-1111-1111-1111-111111111111'))
  + (select count(*)::integer from public.argument_ratings where rater_pseudo = private.pseudo('31111111-1111-1111-1111-111111111111')),
  0, 'dopo la cancellazione: zero righe con il suo pseudo');
select is((select count(*)::integer from public.proposal_votes), 1, 'il voto dell''altro utente resta');
select results_eq($$select body, author_id from public.piazza_messages where id = 'b0000000-0000-0000-0000-000000000004'$$,
  $$values ('mio messaggio'::text, null::uuid)$$, 'Piazza anonimizzata, testo invariato');
select is((select author_id from public.problems where id = 'b0000000-0000-0000-0000-000000000002'), null, 'problema anonimizzato');
select is((select count(*)::integer from public.bar_messages where id = 'b0000000-0000-0000-0000-000000000006'), 0, 'Bar eliminato');
select results_eq($$select handle, deleted_at is not null from public.profiles where id = '31111111-1111-1111-1111-111111111111'$$,
  $$values (null::text, true)$$, 'profilo marcato cancellato senza handle');

-- ---- Sospensione con scadenza automatica ----
set local role service_role;
select lives_ok($$select public.suspend_user('33333333-3333-3333-3333-333333333333', now() + interval '1 day')$$, 'sospensione');
reset role;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.cast_vote('proposal', 'b0000000-0000-0000-0000-000000000003', 1)$$, 'P0001',
  'account_not_active', 'utente sospeso: scrittura negata');
reset role;
update public.profiles set suspended_until = now() - interval '1 minute' where id = '33333333-3333-3333-3333-333333333333';
set local role authenticated;
select lives_ok($$select public.cast_vote('proposal', 'b0000000-0000-0000-0000-000000000003', 1)$$,
  'dopo suspended_until: scrittura consentita');
reset role;

select * from finish();
rollback;
