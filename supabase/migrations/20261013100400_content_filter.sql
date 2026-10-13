-- M2 · 2.1 — Filtro contenuti: lessico (solo admin), statistiche aggregate dei blocchi, strike per la pausa.
-- Nessuna tabella contiene il testo bloccato. Il lessico parte VUOTO: lo compila Manuel.

-- Lessico: termini o pattern (regex applicate al testo normalizzato) con livello della Scala.
create table public.lexicon_terms (
  id uuid primary key default gen_random_uuid(),
  term text not null check (char_length(term) between 1 and 200),
  level smallint not null check (level in (2, 3, 4)),
  is_pattern boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  unique (term, is_pattern)
);
alter table public.lexicon_terms enable row level security;
-- Solo admin (RLS): gli altri authenticated vedono zero righe, anon nessun grant.
grant select, insert, update, delete on public.lexicon_terms to authenticated;
create policy lexicon_terms_admin on public.lexicon_terms for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Statistiche pubbliche dei blocchi: solo conteggi per giorno (Europe/Rome), livello, tipo di contenuto.
create table public.filter_block_stats (
  day date not null,
  level smallint not null check (level in (2, 3, 4)),
  content_type text not null check (content_type in (
    'problem', 'reformulation', 'fact', 'proposal', 'argument', 'piazza', 'bar', 'handle', 'report')),
  count integer not null default 0 check (count >= 0),
  primary key (day, level, content_type)
);
alter table public.filter_block_stats enable row level security;
grant select on public.filter_block_stats to anon, authenticated;
create policy filter_block_stats_read on public.filter_block_stats for select to anon, authenticated using (true);

-- Strike per la pausa di scrittura: solo utente e ora, cancellati dopo 24 ore.
create table private.filter_strikes (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  blocked_at timestamptz not null default now()
);
create index filter_strikes_user_blocked_idx on private.filter_strikes (user_id, blocked_at);
create index filter_strikes_blocked_idx on private.filter_strikes (blocked_at);
revoke all on private.filter_strikes from public, anon, authenticated;

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
  delete from private.filter_strikes s where s.blocked_at < now() - interval '24 hours';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;
revoke execute on function private.cleanup_filter_strikes() from public, anon, authenticated;

-- Fine della pausa di scrittura dell'utente, o null. Soglie da platform_config.
-- Contano gli strike delle ultime 24 ore; la pausa parte dall'ultimo.
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
  where s.user_id = writing_paused_until.uid and s.blocked_at > now() - interval '24 hours';
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

-- Registra un blocco del filtro (senza testo): +1 alle statistiche; per livello ≥ 3 uno strike.
-- Restituisce la fine della pausa di scrittura, o null.
create or replace function public.record_filter_block(level integer, content_type text)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if record_filter_block.level is null or record_filter_block.level not in (2, 3, 4)
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
    insert into private.filter_strikes (user_id) values (v_uid);
  end if;
  return private.writing_paused_until(v_uid);
end;
$$;
revoke execute on function public.record_filter_block(integer, text) from public, anon, authenticated;
grant execute on function public.record_filter_block(integer, text) to authenticated;

create or replace function public.my_writing_pause()
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  return private.writing_paused_until(auth.uid());
end;
$$;
revoke execute on function public.my_writing_pause() from public, anon, authenticated;
grant execute on function public.my_writing_pause() to authenticated;

-- Pulizia oraria degli strike con pg_cron, se disponibile (la RPC pulisce comunque a ogni blocco).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('arengo_cleanup_filter_strikes', '17 * * * *', 'select private.cleanup_filter_strikes()');
  end if;
exception when others then
  raise notice 'pg_cron non disponibile: pulizia strike solo via record_filter_block (%)', sqlerrm;
end;
$$;
