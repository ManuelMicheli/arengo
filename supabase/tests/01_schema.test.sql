-- M1 · 1.1 — Schema: tabelle presenti, RLS attiva ovunque, nessun grant su private.
begin;
create extension if not exists pgtap with schema extensions;

select plan(25);

select has_schema('private', 'schema private esiste');

select has_table('public'::name, t::name, 'tabella public.' || t || ' esiste')
from unnest(array[
  'profiles', 'platform_config', 'config_changelog', 'topics', 'problems', 'problem_supports',
  'problem_reformulations', 'problem_reformulation_votes', 'sources', 'problem_facts', 'proposals',
  'proposal_votes', 'arguments', 'argument_ratings', 'piazza_messages', 'piazza_votes', 'bar_messages'
]) as t;

select is(
  (select count(*)::integer from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0,
  'RLS attiva su tutte le tabelle di public'
);

select ok(not has_schema_privilege('anon', 'private', 'usage'), 'anon non ha usage su private');
select ok(not has_schema_privilege('authenticated', 'private', 'usage'), 'authenticated non ha usage su private');

select is(
  (select count(*)::integer from information_schema.role_table_grants g
   where g.table_schema = 'private' and g.grantee in ('anon', 'authenticated', 'PUBLIC')),
  0,
  'nessun grant su tabelle di private ad anon/authenticated/PUBLIC'
);

select throws_ok(
  $$insert into public.piazza_messages (topic_id, parent_id, depth, body)
    values (gen_random_uuid(), null, 1, 'x')$$,
  '23514',
  null,
  'depth 1 senza parent rifiutato'
);

select throws_ok(
  $$insert into public.proposal_votes (proposal_id, voter_pseudo, value) values (gen_random_uuid(), 'p', 2)$$,
  '23514',
  null,
  'valore di voto fuori da -1/0/1 rifiutato'
);

select throws_ok(
  $$insert into public.problems (topic_id, title, body, affected) values (gen_random_uuid(), repeat('a', 121), 'b', 'c')$$,
  '23514',
  null,
  'titolo problema > 120 caratteri rifiutato'
);

select * from finish();
rollback;
