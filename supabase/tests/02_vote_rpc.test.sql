-- M1 · 1.2 — RPC di voto: voto doppio aggiorna, onboarding/status controllati, pseudo stabile.
begin;
create extension if not exists pgtap with schema extensions;

select plan(28);

-- Utenti di test
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ok@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'nuovo@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'sospeso@test.local'),
  ('44444444-4444-4444-4444-444444444444', 'scaduto@test.local'),
  ('55555555-5555-5555-5555-555555555555', 'bannato@test.local');

insert into public.profiles (id, handle, status, suspended_until, rules_version_accepted, consent_art9_at, adult_declared_at) values
  ('11111111-1111-1111-1111-111111111111', 'utente_ok', 'active', null, 'v1', now(), now()),
  ('22222222-2222-2222-2222-222222222222', 'utente_nuovo', 'active', null, null, null, now()),
  ('33333333-3333-3333-3333-333333333333', 'utente_sospeso', 'suspended', now() + interval '1 day', 'v1', now(), now()),
  ('44444444-4444-4444-4444-444444444444', 'utente_scaduto', 'suspended', now() - interval '1 day', 'v1', now(), now()),
  ('55555555-5555-5555-5555-555555555555', 'utente_bannato', 'banned', null, 'v1', now(), now());

-- Contenuti di test
insert into public.topics (id, slug, title, selection_criterion)
  values ('a0000000-0000-0000-0000-000000000001', 'casa', 'Casa', 'test');
insert into public.problems (id, topic_id, title, body, affected, status)
  values ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'P', 'B', 'A', 'active');
insert into public.proposals (id, problem_id, what, how, cost_and_funding, risks)
  values ('a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'w', 'h', 'c', 'r');
insert into public.piazza_messages (id, topic_id, body)
  values ('a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'msg');
insert into public.problem_reformulations (id, problem_id, title, body)
  values ('a0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', 'T2', 'B2');
insert into public.arguments (id, proposal_id, side, body)
  values ('a0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000003', 'pro', 'arg');

-- ---- Utente attivo e onboardato ----
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select lives_ok($$select public.cast_vote('proposal', 'a0000000-0000-0000-0000-000000000003', 1)$$, 'primo voto su proposta');
select lives_ok($$select public.cast_vote('proposal', 'a0000000-0000-0000-0000-000000000003', -1)$$, 'secondo voto sulla stessa proposta');
select is(public.my_vote('proposal', 'a0000000-0000-0000-0000-000000000003'), (-1)::smallint, 'my_vote restituisce l''ultimo voto');
select lives_ok($$select public.cast_vote('piazza', 'a0000000-0000-0000-0000-000000000004', 0)$$, 'voto passo su Piazza');
select throws_ok($$select public.cast_vote('reformulation', 'a0000000-0000-0000-0000-000000000005', 0)$$,
  'P0001', 'invalid_value', 'riformulazione non accetta il passo');
select lives_ok($$select public.cast_vote('reformulation', 'a0000000-0000-0000-0000-000000000005', 1)$$, 'voto su riformulazione');
select lives_ok($$select public.support_problem('a0000000-0000-0000-0000-000000000002')$$, 'primo sostegno');
select lives_ok($$select public.support_problem('a0000000-0000-0000-0000-000000000002')$$, 'sostegno ripetuto idempotente');
select is(public.my_vote('problem', 'a0000000-0000-0000-0000-000000000002'), 1::smallint, 'my_vote vede il proprio sostegno');
select lives_ok($$select public.rate_argument('a0000000-0000-0000-0000-000000000006', true)$$, 'rating utile');
select lives_ok($$select public.rate_argument('a0000000-0000-0000-0000-000000000006', false)$$, 'rating aggiornato a non utile');
select is(public.my_vote('argument', 'a0000000-0000-0000-0000-000000000006'), (-1)::smallint, 'my_vote vede il rating aggiornato');
select throws_ok($$select public.cast_vote('proposal', 'a0000000-0000-0000-0000-000000000003', 2)$$,
  'P0001', 'invalid_value', 'valore fuori range rifiutato');
select throws_ok($$select public.cast_vote('altro', 'a0000000-0000-0000-0000-000000000003', 1)$$,
  'P0001', 'invalid_item_type', 'tipo item sconosciuto rifiutato');
select throws_ok($$select public.cast_vote('proposal', gen_random_uuid(), 1)$$,
  'P0001', 'item_not_votable', 'proposta inesistente rifiutata');

-- ---- Controlli sullo stato salvato (come postgres) ----
reset role;
select is((select count(*)::integer from public.proposal_votes where proposal_id = 'a0000000-0000-0000-0000-000000000003'),
  1, 'voto doppio: una sola riga');
select is((select value from public.proposal_votes where proposal_id = 'a0000000-0000-0000-0000-000000000003'),
  (-1)::smallint, 'voto doppio: valore aggiornato');
select is((select count(*)::integer from public.problem_supports where problem_id = 'a0000000-0000-0000-0000-000000000002'),
  1, 'sostegno doppio: una sola riga');
select is((select count(*)::integer from public.argument_ratings where argument_id = 'a0000000-0000-0000-0000-000000000006'),
  1, 'rating doppio: una sola riga');
select is((select voter_pseudo from public.proposal_votes where proposal_id = 'a0000000-0000-0000-0000-000000000003'),
  private.pseudo('11111111-1111-1111-1111-111111111111'), 'voter_pseudo = private.pseudo(user_id)');
select ok(private.pseudo('11111111-1111-1111-1111-111111111111') ~ '^[0-9a-f]{64}$', 'pseudo è HMAC-SHA256 esadecimale');
select isnt(private.pseudo('11111111-1111-1111-1111-111111111111'), private.pseudo('22222222-2222-2222-2222-222222222222'),
  'utenti diversi → pseudo diversi');

-- ---- Utenti non abilitati ----
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.cast_vote('proposal', 'a0000000-0000-0000-0000-000000000003', 1)$$,
  'P0001', 'onboarding_incomplete', 'onboarding incompleto → errore');

select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select throws_ok($$select public.support_problem('a0000000-0000-0000-0000-000000000002')$$,
  'P0001', 'account_not_active', 'sospeso → errore');

select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select lives_ok($$select public.cast_vote('proposal', 'a0000000-0000-0000-0000-000000000003', 1)$$,
  'sospensione scaduta → voto consentito');

select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
select throws_ok($$select public.rate_argument('a0000000-0000-0000-0000-000000000006', true)$$,
  'P0001', 'account_not_active', 'bannato → errore');

select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok($$select public.cast_vote('proposal', 'a0000000-0000-0000-0000-000000000003', 1)$$,
  'P0001', 'not_authenticated', 'JWT senza sub → errore');

reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok($$select public.cast_vote('proposal', 'a0000000-0000-0000-0000-000000000003', 1)$$,
  '42501', null, 'anon non può eseguire cast_vote');

reset role;
select * from finish();
rollback;
