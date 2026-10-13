-- M1 · 1.3 — Viste pubbliche senza autore, aggregati, platform_config e admin_set_config.
begin;
create extension if not exists pgtap with schema extensions;

select plan(30);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'utente@test.local'),
  ('66666666-6666-6666-6666-666666666666', 'admin@test.local');
insert into public.profiles (id, handle, rules_version_accepted, consent_art9_at, adult_declared_at) values
  ('11111111-1111-1111-1111-111111111111', 'utente_ok', 'v1', now(), now()),
  ('66666666-6666-6666-6666-666666666666', 'admin_ok', 'v1', now(), now());

insert into public.topics (id, slug, title, selection_criterion)
  values ('a0000000-0000-0000-0000-000000000001', 'casa', 'Casa', 'test');
insert into public.problems (id, topic_id, title, body, affected, status, author_id)
  values ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'P', 'B', 'A', 'active',
          '11111111-1111-1111-1111-111111111111');
insert into public.proposals (id, problem_id, what, how, cost_and_funding, risks, author_id)
  values ('a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'w', 'h', 'c', 'r',
          '11111111-1111-1111-1111-111111111111');
insert into public.piazza_messages (id, topic_id, body, author_id, status) values
  ('a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'visibile', '11111111-1111-1111-1111-111111111111', 'visible'),
  ('a0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'rimosso', '11111111-1111-1111-1111-111111111111', 'removed');
insert into public.bar_messages (id, topic_id, body, author_id, expires_at) values
  ('a0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'attivo', '11111111-1111-1111-1111-111111111111', now() + interval '1 day'),
  ('a0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001', 'scaduto', '11111111-1111-1111-1111-111111111111', now() - interval '1 day');
insert into public.proposals (id, problem_id, what, how, cost_and_funding, risks)
  values ('a0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000002', 'w2', 'h2', 'c2', 'r2');
-- Proposta 003: 4 voti (sotto min_votes_item = 5). Proposta 010: 5 voti.
insert into public.proposal_votes (proposal_id, voter_pseudo, value) values
  ('a0000000-0000-0000-0000-000000000003', 'p1', 1),
  ('a0000000-0000-0000-0000-000000000003', 'p2', 1),
  ('a0000000-0000-0000-0000-000000000003', 'p3', -1),
  ('a0000000-0000-0000-0000-000000000003', 'p4', 0),
  ('a0000000-0000-0000-0000-000000000010', 'p1', 1),
  ('a0000000-0000-0000-0000-000000000010', 'p2', 1),
  ('a0000000-0000-0000-0000-000000000010', 'p3', -1),
  ('a0000000-0000-0000-0000-000000000010', 'p4', 0),
  ('a0000000-0000-0000-0000-000000000010', 'p5', 1);

-- ---- Struttura delle viste ----
select hasnt_column('public', v::name, 'author_id'::name, v || ' senza author_id')
from unnest(array['problems_public', 'proposals_public', 'arguments_public', 'piazza_public', 'bar_public']) as v;
select hasnt_column('public', v::name, 'voter_pseudo'::name, v || ' senza voter_pseudo')
from unnest(array['proposal_tallies', 'piazza_tallies']) as v;
select hasnt_column('public', 'argument_utility'::name, 'rater_pseudo'::name, 'argument_utility senza rater_pseudo');
select has_column('public', 'piazza_public'::name, 'handle'::name, 'piazza_public espone l''handle');

-- ---- Lettura anonima ----
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is((select count(*)::integer from public.platform_config), 47, 'anon legge tutta la config (47 chiavi)');
select is((select value from public.platform_config where key = 'problem_support_threshold'), '25'::jsonb, 'soglia sostegni = 25');
select is((select count(*)::integer from public.problems_public), 1, 'anon legge problems_public');
select is((select count(*)::integer from public.proposals_public), 2, 'anon legge proposals_public');
select is((select below_threshold from public.proposal_tallies where proposal_id = 'a0000000-0000-0000-0000-000000000003'), true, 'tally sotto soglia: below_threshold');
select is((select total from public.proposal_tallies where proposal_id = 'a0000000-0000-0000-0000-000000000003'), null::integer, 'tally sotto soglia: conteggi nascosti');
select is((select agree from public.proposal_tallies where proposal_id = 'a0000000-0000-0000-0000-000000000010'), 3, 'tally sopra soglia: 3 d''accordo');
select is((select total from public.proposal_tallies where proposal_id = 'a0000000-0000-0000-0000-000000000010'), 5, 'tally sopra soglia: 5 totali');
select is((select count(*)::integer from public.piazza_public), 1, 'piazza_public nasconde i rimossi');
select is((select handle from public.piazza_public), 'utente_ok', 'piazza_public mostra l''handle');
select is((select count(*)::integer from public.bar_public), 1, 'bar_public nasconde gli scaduti');
select throws_ok($$update public.platform_config set value = '1' where key = 'k_min'$$, '42501', null, 'anon non modifica config');
select throws_ok($$select changed_by from public.config_changelog$$, '42501', null, 'anon non legge changed_by');
select throws_ok($$select public.admin_set_config('k_min', '3', 'x')$$, '42501', null, 'anon non esegue admin_set_config');

-- ---- Utente autenticato non admin ----
reset role;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.admin_set_config('k_min', '3', 'test')$$, 'P0001', 'not_admin', 'non admin → errore');

-- ---- Admin ----
select set_config('request.jwt.claims',
  '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated","app_metadata":{"role":"admin"}}', true);
select throws_ok($$select public.admin_set_config('k_min', '3', '   ')$$, 'P0001', 'reason_required', 'motivazione vuota → errore');
select throws_ok($$select public.admin_set_config('chiave_nuova', '3', 'test')$$, 'P0001', 'unknown_key', 'chiave sconosciuta → errore');
select throws_ok($$update public.platform_config set value = '3' where key = 'k_min'$$, '42501', null, 'admin non fa UPDATE diretto sulla config');
select lives_ok($$select public.admin_set_config('problem_support_threshold', '30', 'prova di modifica')$$, 'admin modifica con motivazione');

reset role;
select is((select value from public.platform_config where key = 'problem_support_threshold'), '30'::jsonb, 'valore aggiornato');
select results_eq(
  $$select key, old_value, new_value, reason, changed_by from public.config_changelog$$,
  $$values ('problem_support_threshold'::text, '25'::jsonb, '30'::jsonb, 'prova di modifica'::text,
            '66666666-6666-6666-6666-666666666666'::uuid)$$,
  'changelog con valori, motivazione e autore'
);

select * from finish();
rollback;
