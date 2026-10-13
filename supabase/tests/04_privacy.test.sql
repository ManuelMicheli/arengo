-- M1 · 1.4 — Privacy del voto e degli autori:
-- anon non legge voti; authenticated non legge voti altrui né voter_pseudo; admin non modifica/cancella voti;
-- private non esposto; author_id non leggibile da anon/authenticated.
begin;
create extension if not exists pgtap with schema extensions;

select plan(47);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'votante@test.local'),
  ('77777777-7777-7777-7777-777777777777', 'altro@test.local'),
  ('66666666-6666-6666-6666-666666666666', 'admin@test.local');
insert into public.profiles (id, handle, rules_version_accepted, consent_art9_at, adult_declared_at) values
  ('11111111-1111-1111-1111-111111111111', 'votante', 'v1', now(), now()),
  ('77777777-7777-7777-7777-777777777777', 'altro', 'v1', now(), now()),
  ('66666666-6666-6666-6666-666666666666', 'admin_ok', 'v1', now(), now());

insert into public.topics (id, slug, title, selection_criterion)
  values ('a0000000-0000-0000-0000-000000000001', 'casa', 'Casa', 'test');
insert into public.problems (id, topic_id, title, body, affected, status, author_id)
  values ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'P', 'B', 'A', 'active',
          '11111111-1111-1111-1111-111111111111');
insert into public.proposals (id, problem_id, what, how, cost_and_funding, risks, author_id)
  values ('a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'w', 'h', 'c', 'r',
          '11111111-1111-1111-1111-111111111111');
insert into public.piazza_messages (id, topic_id, body, author_id)
  values ('a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'msg', '11111111-1111-1111-1111-111111111111');
insert into public.arguments (id, proposal_id, side, body, author_id)
  values ('a0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000003', 'pro', 'arg', '11111111-1111-1111-1111-111111111111');

-- Voti reali del votante (via RPC)
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  perform public.cast_vote('proposal', 'a0000000-0000-0000-0000-000000000003', 1);
  perform public.cast_vote('piazza', 'a0000000-0000-0000-0000-000000000004', 1);
  perform public.support_problem('a0000000-0000-0000-0000-000000000002');
  perform public.rate_argument('a0000000-0000-0000-0000-000000000006', true);
end
$$;
reset role;

-- ---- Nessuna vista pubblica espone pseudo o autori ----
select is(
  (select count(*)::integer from information_schema.columns c
   join information_schema.views v on v.table_schema = c.table_schema and v.table_name = c.table_name
   where c.table_schema = 'public'
     and c.column_name in ('author_id', 'voter_pseudo', 'rater_pseudo', 'added_by', 'proposed_by', 'reviewed_by', 'changed_by')),
  0,
  'nessuna vista di public espone colonne di autore o pseudo'
);

-- ---- anon ----
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok(format('select * from public.%I', t), '42501', null, 'anon non legge ' || t)
from unnest(array['proposal_votes', 'piazza_votes', 'problem_supports', 'argument_ratings', 'problem_reformulation_votes']) as t;
select throws_ok(format('select author_id from public.%I', t), '42501', null, 'anon non legge author_id di ' || t)
from unnest(array['problems', 'proposals', 'arguments', 'problem_reformulations', 'piazza_messages', 'bar_messages']) as t;
select throws_ok($$select added_by from public.sources$$, '42501', null, 'anon non legge added_by di sources');
select throws_ok($$select proposed_by from public.problem_facts$$, '42501', null, 'anon non legge proposed_by di problem_facts');
select throws_ok($$select * from public.profiles$$, '42501', null, 'anon non legge profiles');
select throws_ok($$select private.pseudo('11111111-1111-1111-1111-111111111111')$$, '42501', null, 'anon non accede a private.pseudo');
select throws_ok($$select public.my_vote('proposal', 'a0000000-0000-0000-0000-000000000003')$$, '42501', null, 'anon non esegue my_vote');

-- ---- authenticated (altro utente) ----
reset role;
select set_config('request.jwt.claims', '{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(format('select * from public.%I', t), '42501', null, 'authenticated non legge ' || t)
from unnest(array['proposal_votes', 'piazza_votes', 'problem_supports', 'argument_ratings', 'problem_reformulation_votes']) as t;
select throws_ok($$select voter_pseudo from public.proposal_votes$$, '42501', null, 'authenticated non legge voter_pseudo');
select throws_ok(format('select author_id from public.%I', t), '42501', null, 'authenticated non legge author_id di ' || t)
from unnest(array['problems', 'proposals', 'arguments', 'problem_reformulations', 'piazza_messages', 'bar_messages']) as t;
select throws_ok($$select private.pseudo('11111111-1111-1111-1111-111111111111')$$, '42501', null, 'authenticated non accede a private.pseudo');
select throws_ok($$select private.assert_can_vote()$$, '42501', null, 'authenticated non accede a private.assert_can_vote');
select is((select count(*)::integer from public.profiles), 1, 'authenticated vede solo il proprio profilo');
select is((select id from public.profiles), '77777777-7777-7777-7777-777777777777'::uuid, 'il profilo visibile è il proprio');
select is(public.my_vote('proposal', 'a0000000-0000-0000-0000-000000000003'), null::smallint, 'my_vote non rivela voti altrui');
select throws_ok($$insert into public.proposal_votes (proposal_id, voter_pseudo, value)
  values ('a0000000-0000-0000-0000-000000000003', 'falso', 1)$$, '42501', null, 'authenticated non inserisce voti diretti');

-- ---- admin ----
select set_config('request.jwt.claims',
  '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated","app_metadata":{"role":"admin"}}', true);
select throws_ok(format('update public.%I set created_at = now()', t), '42501', null, 'admin non fa UPDATE su ' || t)
from unnest(array['proposal_votes', 'piazza_votes', 'problem_supports', 'argument_ratings', 'problem_reformulation_votes']) as t;
select throws_ok(format('delete from public.%I', t), '42501', null, 'admin non fa DELETE su ' || t)
from unnest(array['proposal_votes', 'piazza_votes', 'problem_supports', 'argument_ratings', 'problem_reformulation_votes']) as t;
select throws_ok($$select * from public.proposal_votes$$, '42501', null, 'admin non legge i voti');

-- ---- I voti sono ancora tutti lì ----
reset role;
select is(
  (select (select count(*) from public.proposal_votes) + (select count(*) from public.piazza_votes)
        + (select count(*) from public.problem_supports) + (select count(*) from public.argument_ratings))::integer,
  4,
  'nessun voto modificato o cancellato dai tentativi'
);

select * from finish();
rollback;
