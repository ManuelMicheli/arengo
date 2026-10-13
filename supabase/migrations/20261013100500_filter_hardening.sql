-- M2 · hardening da review. La 100400 resta invariata.

-- ---------------------------------------------------------------------------
-- 1. Nuove chiavi di config del filtro
-- ---------------------------------------------------------------------------
insert into public.platform_config (key, value, description) values
  ('filter_strike_window_hours', '24', 'Ore su cui si contano i blocchi gravi per la pausa di scrittura (poi si cancellano)'),
  ('filter_letter_join_min_run', '3', 'Lettere singole consecutive, con lo stesso separatore, che il filtro riunisce in una parola'),
  ('filter_target_window_words', '4', 'Parole massime tra una formula rivolta a una persona e un termine di livello 2');

update public.platform_config
set description = 'Blocchi di livello 3 o 4 nella finestra che attivano la pausa di scrittura; ogni nuovo blocco oltre la soglia fa ripartire la pausa'
where key = 'filter_l3_blocks_pause';

-- ---------------------------------------------------------------------------
-- 3/7. Lessico: frasi in sintassi ristretta (niente regex) e scritture solo via RPC admin con audit.
-- Formato: parole [a-z0-9] separate da uno spazio; `*` = esattamente una parola qualsiasi.
-- ---------------------------------------------------------------------------
drop policy lexicon_terms_admin on public.lexicon_terms;
revoke all on public.lexicon_terms from authenticated;
alter table public.lexicon_terms drop column is_pattern;
alter table public.lexicon_terms add constraint lexicon_terms_term_key unique (term);
alter table public.lexicon_terms add constraint lexicon_terms_term_format check (
  term ~ '^([a-z0-9]+|\*)( ([a-z0-9]+|\*))*$' and term ~ '[a-z0-9]'
);
-- Lettura del lessico: solo admin (e service role lato server).
grant select on public.lexicon_terms to authenticated;
create policy lexicon_terms_admin_read on public.lexicon_terms for select to authenticated
  using ((select public.is_admin()));

-- Registro pubblico delle modifiche al lessico: senza il termine (il lessico resta riservato).
create table public.lexicon_changelog (
  id bigint generated always as identity primary key,
  changed_at timestamptz not null default now(),
  action text not null check (action in ('insert', 'update', 'delete')),
  level smallint not null check (level in (2, 3, 4)),
  reason text not null check (length(btrim(reason)) > 0),
  changed_by uuid references auth.users (id) on delete set null
);
create index lexicon_changelog_changed_at_idx on public.lexicon_changelog (changed_at);
create index lexicon_changelog_changed_by_idx on public.lexicon_changelog (changed_by);
alter table public.lexicon_changelog enable row level security;
grant select (id, changed_at, action, level, reason) on public.lexicon_changelog to anon, authenticated;
create policy lexicon_changelog_read on public.lexicon_changelog for select to anon, authenticated using (true);

create or replace function private.lexicon_changelog_append_only()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Unica eccezione: ON DELETE SET NULL della FK changed_by quando si cancella un utente.
  if tg_op = 'UPDATE'
     and old.changed_by is not null and new.changed_by is null
     and new.id = old.id and new.changed_at = old.changed_at and new.action = old.action
     and new.level = old.level and new.reason = old.reason then
    return new;
  end if;
  raise exception 'lexicon_changelog_append_only';
end;
$$;
revoke execute on function private.lexicon_changelog_append_only() from public, anon, authenticated;

create trigger lexicon_changelog_no_update_delete
  before update or delete on public.lexicon_changelog
  for each row execute function private.lexicon_changelog_append_only();
create trigger lexicon_changelog_no_truncate
  before truncate on public.lexicon_changelog
  for each statement execute function private.lexicon_changelog_append_only();

create or replace function public.admin_lexicon_upsert(term text, level integer, reason text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_exists boolean;
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;
  if admin_lexicon_upsert.reason is null or length(btrim(admin_lexicon_upsert.reason)) = 0 then
    raise exception 'reason_required';
  end if;
  if admin_lexicon_upsert.term is null
     or char_length(admin_lexicon_upsert.term) > 200
     or admin_lexicon_upsert.term !~ '^([a-z0-9]+|\*)( ([a-z0-9]+|\*))*$'
     or admin_lexicon_upsert.term !~ '[a-z0-9]' then
    raise exception 'invalid_term';
  end if;
  if admin_lexicon_upsert.level is null or admin_lexicon_upsert.level not in (2, 3, 4) then
    raise exception 'invalid_value';
  end if;

  select exists (select 1 from public.lexicon_terms t where t.term = admin_lexicon_upsert.term) into v_exists;
  insert into public.lexicon_terms (term, level)
  values (admin_lexicon_upsert.term, admin_lexicon_upsert.level)
  on conflict on constraint lexicon_terms_term_key do update set level = excluded.level;

  insert into public.lexicon_changelog (action, level, reason, changed_by)
  values (case when v_exists then 'update' else 'insert' end, admin_lexicon_upsert.level,
          btrim(admin_lexicon_upsert.reason), auth.uid());
end;
$$;
revoke execute on function public.admin_lexicon_upsert(text, integer, text) from public, anon, authenticated;
grant execute on function public.admin_lexicon_upsert(text, integer, text) to authenticated;

create or replace function public.admin_lexicon_delete(term text, reason text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_level smallint;
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;
  if admin_lexicon_delete.reason is null or length(btrim(admin_lexicon_delete.reason)) = 0 then
    raise exception 'reason_required';
  end if;
  delete from public.lexicon_terms t where t.term = admin_lexicon_delete.term returning t.level into v_level;
  if v_level is null then
    raise exception 'unknown_term';
  end if;
  insert into public.lexicon_changelog (action, level, reason, changed_by)
  values ('delete', v_level, btrim(admin_lexicon_delete.reason), auth.uid());
end;
$$;
revoke execute on function public.admin_lexicon_delete(text, text) from public, anon, authenticated;
grant execute on function public.admin_lexicon_delete(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 1. Finestra degli strike da config
-- ---------------------------------------------------------------------------
create or replace function private.filter_strike_window()
returns interval
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_hours integer;
begin
  select (c.value #>> '{}')::integer into v_hours from public.platform_config c where c.key = 'filter_strike_window_hours';
  if v_hours is null then
    raise exception 'config_missing';
  end if;
  return make_interval(hours => v_hours);
end;
$$;
revoke execute on function private.filter_strike_window() from public, anon, authenticated;

create or replace function private.cleanup_filter_strikes()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from private.filter_strikes s where s.blocked_at < now() - private.filter_strike_window();
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;
revoke execute on function private.cleanup_filter_strikes() from public, anon, authenticated;

-- Escalation: la pausa parte dall'ultimo strike; oltre la soglia ogni nuovo strike nella finestra la fa ripartire.
create or replace function private.writing_paused_until(uid uuid)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_threshold integer;
  v_minutes integer;
  v_count integer;
  v_last timestamptz;
  v_until timestamptz;
begin
  select (c.value #>> '{}')::integer into v_threshold from public.platform_config c where c.key = 'filter_l3_blocks_pause';
  select (c.value #>> '{}')::integer into v_minutes from public.platform_config c where c.key = 'filter_pause_minutes';
  if v_threshold is null or v_minutes is null then
    raise exception 'config_missing';
  end if;
  select count(*), max(s.blocked_at) into v_count, v_last
  from private.filter_strikes s
  where s.user_id = writing_paused_until.uid and s.blocked_at > now() - private.filter_strike_window();
  if v_count >= v_threshold then
    v_until := v_last + make_interval(mins => v_minutes);
    if v_until > now() then
      return v_until;
    end if;
  end if;
  return null;
end;
$$;
revoke execute on function private.writing_paused_until(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. record_filter_block solo dal server (service role) con l'utente della sessione verificata.
-- ---------------------------------------------------------------------------
drop function public.record_filter_block(integer, text);

create or replace function public.record_filter_block(user_id uuid, level integer, content_type text)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if record_filter_block.user_id is null
     or record_filter_block.level is null or record_filter_block.level not in (2, 3, 4)
     or record_filter_block.content_type is null
     or record_filter_block.content_type not in (
       'problem', 'reformulation', 'fact', 'proposal', 'argument', 'piazza', 'bar', 'handle', 'report') then
    raise exception 'invalid_value';
  end if;

  insert into public.filter_block_stats as st (day, level, content_type, count)
  values ((now() at time zone 'Europe/Rome')::date, record_filter_block.level, record_filter_block.content_type, 1)
  on conflict on constraint filter_block_stats_pkey do update set count = st.count + 1;

  perform private.cleanup_filter_strikes();
  if record_filter_block.level >= 3 then
    insert into private.filter_strikes (user_id) values (record_filter_block.user_id);
  end if;
  return private.writing_paused_until(record_filter_block.user_id);
end;
$$;
revoke execute on function public.record_filter_block(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.record_filter_block(uuid, integer, text) to service_role;

-- ---------------------------------------------------------------------------
-- 8. Controllo unico per le scritture di contenuti (da M4 in poi ogni RPC/insert DEVE chiamarlo):
-- onboarding + stato dell'account + pausa del filtro. Restituisce l'id utente.
-- ---------------------------------------------------------------------------
create or replace function private.assert_can_write(content_type text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
begin
  if assert_can_write.content_type is null or assert_can_write.content_type not in (
       'problem', 'reformulation', 'fact', 'proposal', 'argument', 'piazza', 'bar', 'handle', 'report') then
    raise exception 'invalid_value';
  end if;
  v_uid := private.assert_can_vote();
  if private.writing_paused_until(v_uid) is not null then
    raise exception 'writing_paused';
  end if;
  return v_uid;
end;
$$;
revoke execute on function private.assert_can_write(text) from public, anon, authenticated;
