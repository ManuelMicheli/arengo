-- M2 · 2.1/2.3 — Lessico solo admin, strike privati e senza testo, statistiche aggregate, pausa da config.
begin;
create extension if not exists pgtap with schema extensions;

select plan(30);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'utente@test.local'),
  ('77777777-7777-7777-7777-777777777777', 'altro@test.local'),
  ('66666666-6666-6666-6666-666666666666', 'admin@test.local');

-- Termine fittizio (mai insulti reali nei test)
insert into public.lexicon_terms (term, level) values ('parolaccia1', 2);

-- ---- Nessun testo salvato: colonne esatte ----
select columns_are('public'::name, 'filter_block_stats'::name, array['day', 'level', 'content_type', 'count']::name[],
  'filter_block_stats: solo giorno, livello, tipo, conteggio');
select columns_are('private'::name, 'filter_strikes'::name, array['id', 'user_id', 'blocked_at']::name[],
  'filter_strikes: solo utente e ora');
select is((select count(*)::integer from public.lexicon_terms), 1, 'seed del lessico vuoto (solo il termine di test)');

-- ---- anon ----
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok($$select * from public.lexicon_terms$$, '42501', null, 'anon non legge il lessico');
select throws_ok($$select * from private.filter_strikes$$, '42501', null, 'anon non legge gli strike');
select lives_ok($$select * from public.filter_block_stats$$, 'anon legge le statistiche aggregate');
select throws_ok($$select public.record_filter_block(2, 'piazza')$$, '42501', null, 'anon non registra blocchi');
select throws_ok($$select public.my_writing_pause()$$, '42501', null, 'anon non esegue my_writing_pause');

-- ---- authenticated non admin ----
reset role;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::integer from public.lexicon_terms), 0, 'authenticated non admin non vede il lessico');
select throws_ok($$insert into public.lexicon_terms (term, level) values ('x', 2)$$, '42501', null,
  'authenticated non admin non scrive il lessico');
select throws_ok($$select * from private.filter_strikes$$, '42501', null, 'authenticated non legge gli strike');
select throws_ok($$select private.writing_paused_until('11111111-1111-1111-1111-111111111111')$$, '42501', null,
  'authenticated non accede a private.writing_paused_until');
select throws_ok($$select public.record_filter_block(1, 'piazza')$$, 'P0001', 'invalid_value', 'livello 1 rifiutato');
select throws_ok($$select public.record_filter_block(2, 'altro')$$, 'P0001', 'invalid_value', 'tipo di contenuto ignoto rifiutato');

select is(public.record_filter_block(2, 'piazza'), null::timestamptz, 'blocco L2: nessuna pausa');
select is(public.record_filter_block(3, 'piazza'), null::timestamptz, '1° blocco L3: nessuna pausa');
select is(public.record_filter_block(3, 'argument'), null::timestamptz, '2° blocco L3: nessuna pausa');
select ok(public.record_filter_block(3, 'piazza') > now(), '3° blocco L3 (filter_l3_blocks_pause): pausa');
select ok(public.my_writing_pause() between now() + interval '9 minutes' and now() + interval '11 minutes',
  'pausa di filter_pause_minutes (10)');

-- L'altro utente non è in pausa
select set_config('request.jwt.claims', '{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated"}', true);
select is(public.my_writing_pause(), null::timestamptz, 'la pausa è per utente');
select is(public.record_filter_block(4, 'bar'), null::timestamptz, 'blocco L4: conta come strike, non ancora pausa');

-- ---- admin ----
select set_config('request.jwt.claims',
  '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated","app_metadata":{"role":"admin"}}', true);
select is((select count(*)::integer from public.lexicon_terms), 1, 'admin legge il lessico');
select lives_ok($$insert into public.lexicon_terms (term, level) values ('odiotermine', 3)$$, 'admin scrive il lessico');

-- ---- Controlli come postgres ----
reset role;
select is(
  (select sum(count)::integer from public.filter_block_stats
   where day = (now() at time zone 'Europe/Rome')::date and content_type = 'piazza'),
  3, 'statistiche: 3 blocchi su piazza oggi');
select is((select count from public.filter_block_stats
           where day = (now() at time zone 'Europe/Rome')::date and level = 2 and content_type = 'piazza'),
  1, 'statistiche per livello');
select is((select count(*)::integer from private.filter_strikes where user_id = '11111111-1111-1111-1111-111111111111'),
  3, 'strike solo per livello ≥ 3');
select is((select count(*)::integer from private.filter_strikes where user_id = '77777777-7777-7777-7777-777777777777'),
  1, 'blocco L4 registrato come strike');

-- Soglia letta da platform_config
update public.platform_config set value = '5' where key = 'filter_l3_blocks_pause';
select is(private.writing_paused_until('11111111-1111-1111-1111-111111111111'), null::timestamptz,
  'soglia alzata in config → nessuna pausa con 3 strike');

-- Pulizia oltre 24 ore
insert into private.filter_strikes (user_id, blocked_at)
  values ('77777777-7777-7777-7777-777777777777', now() - interval '25 hours');
select is(private.cleanup_filter_strikes(), 1, 'cleanup elimina gli strike oltre 24 ore');
select is((select count(*)::integer from private.filter_strikes where blocked_at < now() - interval '24 hours'), 0,
  'nessuno strike oltre 24 ore');

select * from finish();
rollback;
