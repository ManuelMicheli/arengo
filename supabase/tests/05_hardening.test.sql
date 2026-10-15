-- M1 · hardening: stati non votabili, profilo cancellato, isolamento my_vote, catalogo privilegi,
-- changelog append-only, validazione config, filtri di stato, timestamp troncati, default deny.
begin;
create extension if not exists pgtap with schema extensions;

select plan(52);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.local'),
  ('77777777-7777-7777-7777-777777777777', 'b@test.local'),
  ('88888888-8888-8888-8888-888888888888', 'cancellato@test.local'),
  ('66666666-6666-6666-6666-666666666666', 'admin@test.local');
insert into public.profiles (id, handle, rules_version_accepted, consent_art9_at, adult_declared_at, deleted_at) values
  ('11111111-1111-1111-1111-111111111111', 'utente_a', 'v1', now(), now(), null),
  ('77777777-7777-7777-7777-777777777777', 'utente_b', 'v1', now(), now(), null),
  ('88888888-8888-8888-8888-888888888888', 'utente_c', 'v1', now(), now(), now()),
  ('66666666-6666-6666-6666-666666666666', 'admin_ok', 'v1', now(), now(), null);

insert into public.topics (id, slug, title, selection_criterion)
  values ('a0000000-0000-0000-0000-000000000001', 'casa', 'Casa', 'test');
insert into public.problems (id, topic_id, title, body, affected, status) values
  ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'attivo', 'B', 'A', 'active'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'archiviato', 'B', 'A', 'archived'),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'rimosso', 'B', 'A', 'removed');
insert into public.proposals (id, problem_id, what, how, cost_and_funding, risks, status) values
  ('a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'aperta', 'h', 'c', 'r', 'open'),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'archiviata', 'h', 'c', 'r', 'archived'),
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'rimossa', 'h', 'c', 'r', 'removed');
insert into public.piazza_messages (id, topic_id, parent_id, depth, body, status) values
  ('a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', null, 0, 'padre rimosso', 'removed'),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 1, 'risposta', 'visible'),
  ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', null, 0, 'visibile', 'visible');
insert into public.problem_reformulations (id, problem_id, title, body, status) values
  ('a0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', 'accettata', 'B', 'accepted'),
  ('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', 'rimossa', 'B', 'removed');
insert into public.arguments (id, proposal_id, side, body, status) values
  ('a0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000003', 'pro', 'visibile', 'visible'),
  ('c0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000003', 'contro', 'rimosso', 'removed');
insert into public.sources (id, url, title, kind)
  values ('a0000000-0000-0000-0000-000000000007', 'https://www.istat.it', 'ISTAT', 'istituzionale');
-- Voto diretto su proposta rimossa: non deve comparire nei conteggi.
insert into public.proposal_votes (proposal_id, voter_pseudo, value) values ('c0000000-0000-0000-0000-000000000003', 'x', 1);
insert into public.problem_facts (problem_id, statement, source_id, status) values
  ('a0000000-0000-0000-0000-000000000002', 'approvato', 'a0000000-0000-0000-0000-000000000007', 'approved'),
  ('a0000000-0000-0000-0000-000000000002', 'proposto', 'a0000000-0000-0000-0000-000000000007', 'proposed'),
  ('a0000000-0000-0000-0000-000000000002', 'rifiutato', 'a0000000-0000-0000-0000-000000000007', 'rejected');

-- ---- Item non votabili e input invalidi (utente A) ----
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.cast_vote('piazza', 'a0000000-0000-0000-0000-000000000004', 1)$$,
  'P0001', 'item_not_votable', 'voto su messaggio Piazza rimosso rifiutato');
select throws_ok($$select public.cast_vote('proposal', 'b0000000-0000-0000-0000-000000000003', 1)$$,
  'P0001', 'item_not_votable', 'voto su proposta archiviata rifiutato');
select throws_ok($$select public.cast_vote('proposal', 'c0000000-0000-0000-0000-000000000003', 1)$$,
  'P0001', 'item_not_votable', 'voto su proposta rimossa rifiutato');
select throws_ok($$select public.cast_vote('reformulation', 'a0000000-0000-0000-0000-000000000005', 1)$$,
  'P0001', 'item_not_votable', 'voto su riformulazione chiusa rifiutato');
select throws_ok($$select public.support_problem('b0000000-0000-0000-0000-000000000002')$$,
  'P0001', 'item_not_votable', 'sostegno a problema archiviato rifiutato');
select throws_ok($$select public.support_problem('c0000000-0000-0000-0000-000000000002')$$,
  'P0001', 'item_not_votable', 'sostegno a problema rimosso rifiutato');
select throws_ok($$select public.cast_vote('proposal', 'a0000000-0000-0000-0000-000000000003', null)$$,
  'P0001', 'invalid_value', 'value null → invalid_value');

-- Voti di A per i test di isolamento e timestamp
do $$
begin
  perform public.cast_vote('proposal', 'a0000000-0000-0000-0000-000000000003', 1);
  perform public.support_problem('a0000000-0000-0000-0000-000000000002');
  perform public.rate_argument('a0000000-0000-0000-0000-000000000006', true);
end
$$;

-- ---- Isolamento my_vote (utente B) ----
select set_config('request.jwt.claims', '{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated"}', true);
select is(public.my_vote('problem', 'a0000000-0000-0000-0000-000000000002'), null::smallint, 'my_vote problem non vede il sostegno altrui');
select is(public.my_vote('argument', 'a0000000-0000-0000-0000-000000000006'), null::smallint, 'my_vote argument non vede il rating altrui');

-- ---- Profilo cancellato ----
select set_config('request.jwt.claims', '{"sub":"88888888-8888-8888-8888-888888888888","role":"authenticated"}', true);
select throws_ok($$select public.cast_vote('proposal', 'a0000000-0000-0000-0000-000000000003', 1)$$,
  'P0001', 'account_deleted', 'profilo cancellato → account_deleted');

-- ---- Ruolo admin solo da app_metadata ----
select set_config('request.jwt.claims',
  '{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated","user_metadata":{"role":"admin"},"app_metadata":{"role":"user"}}', true);
select throws_ok($$select public.admin_set_config('k_min', '3', 'test')$$, 'P0001', 'not_admin',
  'role admin in user_metadata (modificabile dall''utente) non basta');

-- ---- Validazione config (admin) ----
select set_config('request.jwt.claims',
  '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated","app_metadata":{"role":"admin"}}', true);
select throws_ok($$select public.admin_set_config('k_min', '"3"', 'tipo sbagliato')$$, 'P0001', 'invalid_config_value', 'tipo diverso rifiutato');
select throws_ok($$select public.admin_set_config('jury_size', '-1', 'negativo')$$, 'P0001', 'invalid_config_value', 'numero negativo rifiutato');
select throws_ok($$select public.admin_set_config('jury_size', '2.5', 'decimale')$$, 'P0001', 'invalid_config_value', 'decimale su chiave intera rifiutato');
select throws_ok($$select public.admin_set_config('bridging_threshold', '1.5', 'fuori range')$$, 'P0001', 'invalid_config_value', 'soglia > 1 rifiutata');
select throws_ok($$select public.admin_set_config('k_min', '6', 'k_min > k_max')$$, 'P0001', 'invalid_config_value', 'k_min > k_max rifiutato');
select throws_ok($$select public.admin_set_config('k_max', '1', 'k_max < k_min')$$, 'P0001', 'invalid_config_value', 'k_max < k_min rifiutato');
select throws_ok($$select public.admin_set_config('rate_limits', '{"piazza": -3}', 'limite negativo')$$, 'P0001', 'invalid_config_value', 'rate_limits negativo rifiutato');
select throws_ok($$select public.admin_set_config('account_deletion_mode', '"boh"', 'modo ignoto')$$, 'P0001', 'invalid_config_value', 'modalità cancellazione ignota rifiutata');
select throws_ok($$select public.admin_set_config('jury_size', null, 'null')$$, 'P0001', 'invalid_config_value', 'valore null rifiutato');
select lives_ok($$select public.admin_set_config('bridging_threshold', '0.7', 'valore valido')$$, 'valore valido accettato');

-- ---- Filtri di stato in lettura anonima ----
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is((select count(*)::integer from public.arguments_public), 1, 'arguments_public: anon legge, rimossi esclusi');
select is((select count(*)::integer from public.problems_public), 2, 'problems_public esclude i rimossi');
select is((select count(*)::integer from public.proposals_public), 2, 'proposals_public esclude le rimosse');
select is((select count(*)::integer from public.problem_reformulations), 1, 'riformulazioni rimosse escluse');
select is((select array_agg(statement order by statement) from public.problem_facts), array['approvato'], 'schede: solo approvate');
select is((select array_agg(body order by body) from public.piazza_public), array['visibile'], 'piazza_public: niente risposte a padri rimossi');
select is((select count(*)::integer from public.proposal_tallies where proposal_id = 'c0000000-0000-0000-0000-000000000003'), 0,
  'tallies escludono proposte rimosse');
select is((select below_threshold from public.proposal_tallies where proposal_id = 'a0000000-0000-0000-0000-000000000003'), true,
  'tallies: 1 voto è sotto soglia');

-- ---- Come postgres: dati salvati, catalogo, changelog ----
reset role;
select is((select voted_at from public.proposal_votes where proposal_id = 'a0000000-0000-0000-0000-000000000003'),
  date_trunc('day', now(), 'UTC'), 'voted_at troncato al giorno');
select is((select updated_at from public.proposal_votes where proposal_id = 'a0000000-0000-0000-0000-000000000003'),
  date_trunc('day', now(), 'UTC'), 'updated_at troncato al giorno');
select is((select created_at from public.problem_supports where problem_id = 'a0000000-0000-0000-0000-000000000002'),
  date_trunc('day', now(), 'UTC'), 'created_at dei sostegni troncato al giorno');

-- Nessun EXECUTE ad anon o PUBLIC sulle funzioni del progetto (escluse quelle delle estensioni)
select is(
  (select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private')
     and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
     and (p.proacl is null
          or exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0 and a.privilege_type = 'EXECUTE'))),
  0, 'nessuna funzione eseguibile da PUBLIC');
select is(
  (select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private')
     and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
     and has_function_privilege('anon', p.oid, 'execute')),
  0, 'nessuna funzione eseguibile da anon');
select is(
  (select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private') and p.prosecdef
     and not ('search_path=""' = any(coalesce(p.proconfig, '{}')))),
  0, 'ogni SECURITY DEFINER ha search_path vuoto');
select ok(has_function_privilege('authenticated', 'public.cast_vote(text, uuid, integer)', 'execute'), 'authenticated esegue cast_vote');
select ok(not has_function_privilege('authenticated', 'private.pseudo(uuid)', 'execute'), 'authenticated non esegue private.pseudo');

-- Nessun privilegio su tabelle di voto, nessuna colonna d'autore leggibile
select is(
  (select count(*)::integer
   from unnest(array['proposal_votes', 'piazza_votes', 'problem_supports', 'argument_ratings', 'problem_reformulation_votes']) t,
        unnest(array['anon', 'authenticated']) r,
        unnest(array['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger']) priv
   where has_table_privilege(r, 'public.' || t, priv)),
  0, 'anon/authenticated senza alcun privilegio sulle tabelle di voto');
select is(
  (select count(*)::integer
   from (values ('problems', 'author_id'), ('proposals', 'author_id'), ('arguments', 'author_id'),
                ('problem_reformulations', 'author_id'), ('piazza_messages', 'author_id'), ('bar_messages', 'author_id'),
                ('sources', 'added_by'), ('problem_facts', 'proposed_by'), ('problem_facts', 'reviewed_by'),
                ('config_changelog', 'changed_by')) as x(t, c),
        unnest(array['anon', 'authenticated']) r
   where has_column_privilege(r, 'public.' || x.t, x.c, 'select')),
  0, 'nessuna colonna d''autore leggibile da anon/authenticated');

-- Default deny: una tabella nuova non eredita grant
create table public.zz_tabella_nuova (id integer);
select ok(not has_table_privilege('anon', 'public.zz_tabella_nuova', 'select'), 'tabella nuova: anon senza select');
select ok(not has_table_privilege('authenticated', 'public.zz_tabella_nuova', 'select'), 'tabella nuova: authenticated senza select');
select ok(not has_table_privilege('authenticated', 'public.zz_tabella_nuova', 'insert'), 'tabella nuova: authenticated senza insert');

-- Changelog append-only e modifiche dirette registrate
select is((select count(*)::integer from public.config_changelog where changed_at >= now()), 1, 'changelog: una riga da admin_set_config');
select throws_ok($$update public.config_changelog set reason = 'riscritto'$$, 'P0001', 'config_changelog_append_only', 'changelog: UPDATE bloccato');
select throws_ok($$delete from public.config_changelog$$, 'P0001', 'config_changelog_append_only', 'changelog: DELETE bloccato');
select throws_ok($$truncate public.config_changelog$$, 'P0001', 'config_changelog_append_only', 'changelog: TRUNCATE bloccato');
update public.platform_config set value = '4' where key = 'jury_size';
select is((select reason from public.config_changelog where key = 'jury_size'), 'modifica diretta senza funzione',
  'UPDATE diretto su platform_config registrato nel changelog');
update public.platform_config set description = 'nuova descrizione' where key = 'jury_size';
select is((select count(*)::integer from public.config_changelog where key = 'jury_size'), 1,
  'cambio della sola descrizione non scrive il changelog');
delete from auth.users where id = '66666666-6666-6666-6666-666666666666';
select is((select changed_by from public.config_changelog where key = 'bridging_threshold'), null::uuid,
  'cancellare l''admin azzera changed_by senza violare l''append-only');

-- Descrizioni e indici
select is((select count(*)::integer from public.platform_config where description is null or btrim(description) = ''), 0,
  'ogni chiave di config ha una descrizione');
select has_index('public', 'config_changelog', 'config_changelog_changed_by_idx', 'indice su config_changelog.changed_by');
select has_index('public', 'bar_messages', 'bar_messages_status_idx', 'indice su bar_messages.status');

select * from finish();
rollback;
