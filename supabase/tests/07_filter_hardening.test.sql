-- M2 · hardening: lessico solo via RPC admin con audit pubblico senza termine, frasi in sintassi ristretta,
-- assert_can_write (onboarding, stato, pausa), nuove chiavi di config.
begin;
create extension if not exists pgtap with schema extensions;

select plan(29);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'utente@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'nuovo@test.local'),
  ('66666666-6666-6666-6666-666666666666', 'admin@test.local');
insert into public.profiles (id, handle, rules_version_accepted, consent_art9_at, adult_declared_at) values
  ('11111111-1111-1111-1111-111111111111', 'utente_ok', 'v1', now(), now()),
  ('22222222-2222-2222-2222-222222222222', 'utente_nuovo', null, null, now()),
  ('66666666-6666-6666-6666-666666666666', 'admin_ok', 'v1', now(), now());

-- ---- Config ----
select is((select value from public.platform_config where key = 'filter_strike_window_hours'), '24'::jsonb, 'filter_strike_window_hours = 24');
select is((select value from public.platform_config where key = 'filter_letter_join_min_run'), '3'::jsonb, 'filter_letter_join_min_run = 3');
select is((select value from public.platform_config where key = 'filter_target_window_words'), '4'::jsonb, 'filter_target_window_words = 4');
select matches((select description from public.platform_config where key = 'filter_l3_blocks_pause'), 'livello 3 o 4',
  'descrizione della soglia aggiornata (L3 o L4)');

-- ---- Formato del lessico (DB CHECK) ----
select throws_ok($$insert into public.lexicon_terms (term, level) values ('(?:\w+ ?)+x', 3)$$, '23514', null,
  'regex rifiutata all''inserimento (ReDoS)');
select throws_ok($$insert into public.lexicon_terms (term, level) values ('Maiuscole', 3)$$, '23514', null, 'maiuscole rifiutate');
select throws_ok($$insert into public.lexicon_terms (term, level) values ('* *', 3)$$, '23514', null, 'solo jolly rifiutato');
select throws_ok($$insert into public.lexicon_terms (term, level) values ('due  spazi', 3)$$, '23514', null, 'spazi doppi rifiutati');
select lives_ok($$insert into public.lexicon_terms (term, level) values ('minaccia * finta', 4)$$, 'frase con jolly accettata');
select columns_are('public'::name, 'lexicon_terms'::name, array['id', 'term', 'level', 'notes', 'created_at']::name[],
  'is_pattern rimosso');

-- ---- RPC admin del lessico ----
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.admin_lexicon_upsert('parolaccia1', 2, 'test')$$, 'P0001', 'not_admin', 'non admin: upsert negato');
select throws_ok($$select public.admin_lexicon_delete('minaccia * finta', 'test')$$, 'P0001', 'not_admin', 'non admin: delete negato');

select set_config('request.jwt.claims',
  '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated","app_metadata":{"role":"admin"}}', true);
select throws_ok($$select public.admin_lexicon_upsert('parolaccia1', 2, '  ')$$, 'P0001', 'reason_required', 'motivazione obbligatoria');
select throws_ok($$select public.admin_lexicon_upsert('(?:\w+ ?)+x', 3, 'test')$$, 'P0001', 'invalid_term', 'regex rifiutata dalla RPC');
select throws_ok($$select public.admin_lexicon_upsert('parolaccia1', 5, 'test')$$, 'P0001', 'invalid_value', 'livello 5 rifiutato');
select lives_ok($$select public.admin_lexicon_upsert('parolaccia1', 2, 'aggiunta di prova')$$, 'admin aggiunge un termine');
select lives_ok($$select public.admin_lexicon_upsert('parolaccia1', 3, 'livello alzato')$$, 'admin cambia livello');
select lives_ok($$select public.admin_lexicon_delete('parolaccia1', 'rimozione di prova')$$, 'admin rimuove un termine');
select throws_ok($$select public.admin_lexicon_delete('parolaccia1', 'di nuovo')$$, 'P0001', 'unknown_term', 'termine assente');

-- ---- Registro pubblico senza termine ----
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select results_eq(
  $$select action, level::integer, reason from public.lexicon_changelog order by id$$,
  $$values ('insert', 2, 'aggiunta di prova'), ('update', 3, 'livello alzato'), ('delete', 3, 'rimozione di prova')$$,
  'anon legge il registro: azione, livello, motivazione'
);
select hasnt_column('public', 'lexicon_changelog'::name, 'term'::name, 'il registro non contiene il termine');
select throws_ok($$select changed_by from public.lexicon_changelog$$, '42501', null, 'anon non legge changed_by');

reset role;
select throws_ok($$update public.lexicon_changelog set reason = 'x'$$, 'P0001', 'lexicon_changelog_append_only', 'registro: UPDATE bloccato');
select throws_ok($$delete from public.lexicon_changelog$$, 'P0001', 'lexicon_changelog_append_only', 'registro: DELETE bloccato');

-- ---- assert_can_write ----
set local role service_role;
do $$
begin
  perform public.record_filter_block('11111111-1111-1111-1111-111111111111', 3, 'piazza');
  perform public.record_filter_block('11111111-1111-1111-1111-111111111111', 3, 'piazza');
  perform public.record_filter_block('11111111-1111-1111-1111-111111111111', 3, 'piazza');
end
$$;
reset role;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select throws_ok($$select private.assert_can_write('piazza')$$, 'P0001', 'writing_paused', 'utente in pausa → writing_paused');
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select throws_ok($$select private.assert_can_write('piazza')$$, 'P0001', 'onboarding_incomplete', 'onboarding incompleto → errore');
select set_config('request.jwt.claims', '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}', true);
select is(private.assert_can_write('proposal'), '66666666-6666-6666-6666-666666666666'::uuid, 'utente abilitato → id');
select throws_ok($$select private.assert_can_write('altro')$$, 'P0001', 'invalid_value', 'tipo di contenuto ignoto');
set local role authenticated;
select throws_ok($$select private.assert_can_write('piazza')$$, '42501', null, 'authenticated non chiama assert_can_write direttamente');

reset role;
select * from finish();
rollback;
