-- M4 · contenuti: scritture solo dal server, limiti giornalieri, attivazione a soglia, riformulazioni,
-- schede con fonte, proposte, argomenti, conteggi con soglia, ricerca, temi seguiti, mazzo del giorno.
begin;
create extension if not exists pgtap with schema extensions;

select plan(57);

insert into auth.users (id, email) values
  ('c1111111-1111-1111-1111-111111111111', 'c1@test.local'),
  ('c2222222-2222-2222-2222-222222222222', 'c2@test.local'),
  ('c3333333-3333-3333-3333-333333333333', 'c3@test.local'),
  ('c4444444-4444-4444-4444-444444444444', 'c4@test.local');
insert into public.profiles (id, handle, rules_version_accepted, consent_art9_at, adult_declared_at) values
  ('c1111111-1111-1111-1111-111111111111', 'autore_uno', '2026-10-v1', now(), now()),
  ('c2222222-2222-2222-2222-222222222222', 'autore_due', '2026-10-v1', now(), now()),
  ('c3333333-3333-3333-3333-333333333333', 'autore_tre', '2026-10-v1', now(), now()),
  ('c4444444-4444-4444-4444-444444444444', 'senza_onb', null, null, now());

insert into public.topics (id, slug, title, selection_criterion, is_active) values
  ('d0000000-0000-0000-0000-000000000001', 'casa-t', 'Casa', 'test', true),
  ('d0000000-0000-0000-0000-000000000002', 'chiuso-t', 'Chiuso', 'test', false);
insert into public.problems (id, topic_id, title, body, affected, status) values
  ('d0000000-0000-0000-0000-000000000011', 'd0000000-0000-0000-0000-000000000001', 'Titolo vecchio', 'Corpo vecchio', 'A', 'pending'),
  ('d0000000-0000-0000-0000-000000000012', 'd0000000-0000-0000-0000-000000000001', 'Trasporti', 'B', 'A', 'active'),
  ('d0000000-0000-0000-0000-000000000013', 'd0000000-0000-0000-0000-000000000001', 'Affitti delle case per studenti', 'B', 'A', 'active');
insert into public.problem_reformulations (id, problem_id, title, body) values
  ('d0000000-0000-0000-0000-000000000021', 'd0000000-0000-0000-0000-000000000011', 'Titolo nuovo', 'Corpo nuovo'),
  ('d0000000-0000-0000-0000-000000000022', 'd0000000-0000-0000-0000-000000000011', 'Altro titolo', 'Altro corpo');
insert into public.proposals (id, problem_id, what, how, cost_and_funding, risks) values
  ('d0000000-0000-0000-0000-000000000031', 'd0000000-0000-0000-0000-000000000012', 'w1', 'h', 'c', 'r'),
  ('d0000000-0000-0000-0000-000000000032', 'd0000000-0000-0000-0000-000000000012', 'w2', 'h', 'c', 'r');

-- ---- Config ----
select is((select value from public.platform_config where key = 'daily_deck_size'), '10'::jsonb, 'daily_deck_size = 10');
select is((select value -> 'reformulations' from public.platform_config where key = 'rate_limits'), '3'::jsonb,
  'rate_limits con le riformulazioni');
select ok(exists (select 1 from public.config_changelog where key = 'rate_limits' and reason like 'M4:%'),
  'modifica di rate_limits registrata con motivazione');

-- Soglie basse per il test (nella transazione, annullate dal rollback)
update public.platform_config set value = '2' where key in ('problem_support_threshold', 'reformulation_min_votes', 'min_votes_item');

-- ---- Le scritture di testi non sono eseguibili dai client ----
select set_config('request.jwt.claims', '{"sub":"c1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.create_problem('c1111111-1111-1111-1111-111111111111', 'd0000000-0000-0000-0000-000000000001', 't', 'b', 'a')$$,
  '42501', null, 'authenticated non chiama create_problem');
select throws_ok($$select public.create_proposal('c1111111-1111-1111-1111-111111111111', 'd0000000-0000-0000-0000-000000000012', 'w', 'h', 'c', 'r', null, null, null, null)$$,
  '42501', null, 'authenticated non chiama create_proposal');
select throws_ok($$select public.create_argument('c1111111-1111-1111-1111-111111111111', 'd0000000-0000-0000-0000-000000000031', 'pro', 'x')$$,
  '42501', null, 'authenticated non chiama create_argument');
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok($$select * from public.search_content('casa')$$, '42501', null, 'anon non chiama search_content');
reset role;

-- ---- Scritture dal server ----
set local role service_role;
select throws_ok($$select public.create_problem('c4444444-4444-4444-4444-444444444444', 'd0000000-0000-0000-0000-000000000001', 't', 'b', 'a')$$,
  'P0001', 'onboarding_incomplete', 'onboarding incompleto: scrittura negata');
select lives_ok($$select public.create_problem('c1111111-1111-1111-1111-111111111111', 'd0000000-0000-0000-0000-000000000001', 'Titolo', 'Corpo', 'Chi')$$,
  'problema creato');
select throws_ok($$select public.create_problem('c1111111-1111-1111-1111-111111111111', 'd0000000-0000-0000-0000-000000000001', 'Altro', 'Corpo', 'Chi')$$,
  'P0001', 'daily_limit_reached', 'limite giornaliero dei problemi');
select throws_ok($$select public.create_problem('c2222222-2222-2222-2222-222222222222', 'd0000000-0000-0000-0000-000000000002', 'T', 'B', 'A')$$,
  'P0001', 'unknown_topic', 'tema non attivo rifiutato');
select throws_ok($$select public.create_problem('c2222222-2222-2222-2222-222222222222', 'd0000000-0000-0000-0000-000000000001', '   ', 'B', 'A')$$,
  'P0001', 'invalid_value', 'titolo vuoto rifiutato');
select throws_ok($$select public.propose_fact('c2222222-2222-2222-2222-222222222222', 'd0000000-0000-0000-0000-000000000011', 'Un fatto', null, null, null, null)$$,
  'P0001', 'source_required', 'fatto senza fonte rifiutato');
select throws_ok($$select public.propose_fact('c2222222-2222-2222-2222-222222222222', 'd0000000-0000-0000-0000-000000000011', 'Un fatto', 'https://istat.it', 'Istat', null, 'blog')$$,
  'P0001', 'invalid_source', 'tipo di fonte non ammesso');
select lives_ok($$select public.propose_fact('c2222222-2222-2222-2222-222222222222', 'd0000000-0000-0000-0000-000000000011', 'Zebrafatto unico', 'https://istat.it', 'Istat', 'Istat', 'istituzionale')$$,
  'scheda proposta con fonte');
select throws_ok($$select public.create_proposal('c2222222-2222-2222-2222-222222222222', 'd0000000-0000-0000-0000-000000000011', 'w', 'h', 'c', 'r', null, null, null, null)$$,
  'P0001', 'problem_not_active', 'proposta su problema in raccolta rifiutata');
select throws_ok($$select public.create_proposal('c2222222-2222-2222-2222-222222222222', 'd0000000-0000-0000-0000-000000000012', 'w', 'h', 'c', 'r', 'In Francia', null, null, null)$$,
  'P0001', 'source_required', 'esempio estero senza fonte rifiutato');
select lives_ok($$select public.create_proposal('c2222222-2222-2222-2222-222222222222', 'd0000000-0000-0000-0000-000000000012', 'Cosa', 'Come', 'Costo', 'Rischi', null, null, null, null)$$,
  'proposta creata senza esempio estero');
select lives_ok($$select public.create_argument('c3333333-3333-3333-3333-333333333333', 'd0000000-0000-0000-0000-000000000031', 'pro', 'Un buon motivo')$$,
  'argomento creato');
select throws_ok($$select public.create_argument('c3333333-3333-3333-3333-333333333333', 'd0000000-0000-0000-0000-000000000031', 'forse', 'x')$$,
  'P0001', 'invalid_value', 'lato dell''argomento non valido');
select lives_ok($$select public.propose_reformulation('c3333333-3333-3333-3333-333333333333', 'd0000000-0000-0000-0000-000000000012', 'T', 'B')$$,
  'riformulazione proposta');
reset role;

select is((select count(*)::integer from public.problems where author_id = 'c1111111-1111-1111-1111-111111111111'), 1,
  'un solo problema dell''autore');
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is((select count(*)::integer from public.problem_facts where problem_id = 'd0000000-0000-0000-0000-000000000011'), 0,
  'scheda non approvata invisibile');
reset role;

-- ---- Sostegni e attivazione a soglia (soglia 2) ----
select set_config('request.jwt.claims', '{"sub":"c1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.support_problem('d0000000-0000-0000-0000-000000000011')$$, 'primo sostegno');
select is((select status from public.problems_public where id = 'd0000000-0000-0000-0000-000000000011'), 'pending',
  'sotto soglia resta in raccolta');
select lives_ok($$select public.support_problem('d0000000-0000-0000-0000-000000000012')$$, 'sostegno a un altro problema');
select set_config('request.jwt.claims', '{"sub":"c2222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select lives_ok($$select public.support_problem('d0000000-0000-0000-0000-000000000011')$$, 'secondo sostegno');
select results_eq($$select status, activated_at is not null from public.problems_public where id = 'd0000000-0000-0000-0000-000000000011'$$,
  $$values ('active'::text, true)$$, 'al sostegno N il problema diventa attivo');
select results_eq($$select supports, below_threshold from public.problem_support_tallies where problem_id = 'd0000000-0000-0000-0000-000000000011'$$,
  $$values (2, false)$$, 'conteggio sostegni a soglia');
select results_eq($$select supports, below_threshold from public.problem_support_tallies where problem_id = 'd0000000-0000-0000-0000-000000000012'$$,
  $$values (null::integer, true)$$, 'sotto soglia il conteggio è nascosto');

-- ---- Riformulazione accettata sopra soglia (soglia 2) ----
select set_config('request.jwt.claims', '{"sub":"c1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok($$select public.cast_vote('reformulation', 'd0000000-0000-0000-0000-000000000021', 1)$$, 'voto riformulazione 1');
select set_config('request.jwt.claims', '{"sub":"c2222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select lives_ok($$select public.cast_vote('reformulation', 'd0000000-0000-0000-0000-000000000021', 1)$$, 'voto riformulazione 2');
select results_eq($$select id::text, status from public.problem_reformulations where problem_id = 'd0000000-0000-0000-0000-000000000011' order by id$$,
  $$values ('d0000000-0000-0000-0000-000000000021', 'accepted'), ('d0000000-0000-0000-0000-000000000022', 'rejected')$$,
  'riformulazione accettata, l''altra chiusa');
select is((select title from public.problems_public where id = 'd0000000-0000-0000-0000-000000000011'), 'Titolo nuovo',
  'il problema prende il testo riformulato');
select results_eq($$select title, body from public.problem_revisions where problem_id = 'd0000000-0000-0000-0000-000000000011'$$,
  $$values ('Titolo vecchio'::text, 'Corpo vecchio'::text)$$, 'storico con il testo precedente');

-- ---- Voto unico per pseudo ----
select set_config('request.jwt.claims', '{"sub":"c1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok($$select public.cast_vote('proposal', 'd0000000-0000-0000-0000-000000000031', 1)$$, 'voto');
select lives_ok($$select public.cast_vote('proposal', 'd0000000-0000-0000-0000-000000000031', -1)$$, 'voto cambiato');
reset role;
select is((select count(*)::integer from public.proposal_votes where proposal_id = 'd0000000-0000-0000-0000-000000000031'), 1,
  'una sola riga di voto per pseudo');

-- ---- Nessun autore né pseudo nelle viste e tabelle nuove ----
select columns_are('public'::name, 'problem_support_tallies'::name, array['problem_id', 'supports', 'below_threshold']::name[],
  'tallies dei sostegni senza pseudo');
select columns_are('public'::name, 'reformulation_tallies'::name,
  array['reformulation_id', 'prefer_new', 'prefer_current', 'total', 'below_threshold']::name[], 'tallies delle riformulazioni senza pseudo');
select columns_are('public'::name, 'problem_revisions'::name,
  array['id', 'problem_id', 'reformulation_id', 'title', 'body', 'replaced_at']::name[], 'storico senza autore');

-- ---- Ricerca (italiano) ----
set local role service_role;
select ok(exists (select 1 from public.search_content('casa') where kind = 'problem' and id = 'd0000000-0000-0000-0000-000000000013'),
  '"casa" trova "case" per stemming');
select is((select count(*)::integer from public.search_content('zebrafatto')), 0, 'schede non approvate escluse dalla ricerca');
reset role;

-- ---- Temi seguiti: solo il proprietario ----
select set_config('request.jwt.claims', '{"sub":"c1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.follow_topic('d0000000-0000-0000-0000-000000000001', true)$$, 'segue un tema');
select set_config('request.jwt.claims', '{"sub":"c2222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select count(*)::integer from public.topic_follows), 0, 'non vede i temi seguiti da altri');
select throws_ok($$insert into public.topic_follows (user_id, topic_id) values ('c1111111-1111-1111-1111-111111111111', 'd0000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'nessun insert diretto, nemmeno per altri utenti');
select set_config('request.jwt.claims', '{"sub":"c4444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select throws_ok($$select public.follow_topic('d0000000-0000-0000-0000-000000000001', true)$$, 'P0001', 'onboarding_incomplete',
  'senza onboarding non segue temi');

-- ---- Mazzo del giorno ----
select set_config('request.jwt.claims', '{"sub":"c1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select ok(not exists (select 1 from public.daily_deck() where proposal_id = 'd0000000-0000-0000-0000-000000000031'),
  'il mazzo esclude le proposte già votate');
select ok(exists (select 1 from public.daily_deck() where proposal_id = 'd0000000-0000-0000-0000-000000000032'),
  'il mazzo include le proposte non votate dei temi seguiti');
select is((public.export_my_data() #>> '{topic_follows,0,topic}'), 'casa-t', 'export con i temi seguiti');
reset role;

-- ---- Cancellazione: anche i temi seguiti ----
set local role service_role;
select lives_ok($$select public.delete_account('c1111111-1111-1111-1111-111111111111')$$, 'account cancellato');
reset role;
select is((select count(*)::integer from public.topic_follows where user_id = 'c1111111-1111-1111-1111-111111111111'), 0,
  'temi seguiti eliminati');
select set_config('request.jwt.claims', '{"sub":"c1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.follow_topic('d0000000-0000-0000-0000-000000000001', true)$$, 'P0001', 'account_deleted',
  'account cancellato con sessione ancora valida: non può seguire temi');
reset role;

-- ---- Fonti: visibili solo con una scheda approvata ----
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is((select count(*)::integer from public.sources where url = 'https://istat.it'), 0, 'fonte di una scheda in attesa invisibile');
reset role;
update public.problem_facts set status = 'approved' where statement = 'Zebrafatto unico';
set local role anon;
select is((select count(*)::integer from public.sources where url = 'https://istat.it'), 1, 'fonte visibile dopo l''approvazione');
reset role;

-- ---- Storico: sparisce con il problema rimosso ----
update public.problems set status = 'removed' where id = 'd0000000-0000-0000-0000-000000000011';
set local role anon;
select is((select count(*)::integer from public.problem_revisions where problem_id = 'd0000000-0000-0000-0000-000000000011'), 0,
  'versioni precedenti di un problema rimosso invisibili');
reset role;

-- ---- Pausa di scrittura del filtro ----
insert into private.filter_strikes (user_id) select 'c3333333-3333-3333-3333-333333333333' from generate_series(1, 3);
set local role service_role;
select throws_ok($$select public.create_argument('c3333333-3333-3333-3333-333333333333', 'd0000000-0000-0000-0000-000000000031', 'contro', 'x')$$,
  'P0001', 'writing_paused', 'in pausa: scrittura negata');
reset role;

select * from finish();
rollback;
