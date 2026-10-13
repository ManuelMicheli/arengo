-- Smoke test di M0: verifica che pgTAP giri nel job CI `db`.
begin;
create extension if not exists pgtap with schema extensions;

select plan(2);

select has_schema('public', 'lo schema public esiste');
select ok(current_setting('server_version_num')::int >= 170000, 'Postgres >= 17');

select * from finish();
rollback;
