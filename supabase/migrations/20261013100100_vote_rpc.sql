-- M1 · 1.2 — Pseudonimo di voto (HMAC con segreto Vault) e RPC di voto/sostegno/rating.
-- Tutte SECURITY DEFINER con search_path vuoto e nomi qualificati.
-- Il segreto 'vote_pseudo_secret' NON è in nessuna migrazione: in CI lo crea seed.sql (valore di test),
-- in produzione lo crea Manuel a mano (vedi supabase/AGENTS.md).

create or replace function private.pseudo(uid uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  if uid is null then
    raise exception 'pseudo_null_uid';
  end if;
  select ds.decrypted_secret into v_secret
  from vault.decrypted_secrets ds
  where ds.name = 'vote_pseudo_secret';
  if v_secret is null or v_secret = '' then
    raise exception 'pseudo_secret_missing';
  end if;
  return encode(extensions.hmac(uid::text, v_secret, 'sha256'), 'hex');
end;
$$;
revoke execute on function private.pseudo(uuid) from public, anon, authenticated;
grant execute on function private.pseudo(uuid) to service_role;

-- Verifica che il chiamante possa votare: autenticato, onboarding completo, account attivo
-- (una sospensione scaduta conta come attivo). Restituisce l'id utente.
create or replace function private.assert_can_vote()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_profile from public.profiles p where p.id = v_uid;
  if not found or v_profile.deleted_at is not null then
    raise exception 'onboarding_incomplete';
  end if;
  if v_profile.adult_declared_at is null
     or v_profile.rules_version_accepted is null
     or v_profile.consent_art9_at is null then
    raise exception 'onboarding_incomplete';
  end if;
  if v_profile.status = 'banned'
     or (v_profile.status = 'suspended'
         and (v_profile.suspended_until is null or v_profile.suspended_until > now())) then
    raise exception 'account_not_active';
  end if;
  return v_uid;
end;
$$;
revoke execute on function private.assert_can_vote() from public, anon, authenticated;

-- item_type: 'proposal' (value -1/0/1), 'piazza' (value -1/0/1), 'reformulation' (value -1/1).
-- Un secondo voto sullo stesso item aggiorna il precedente.
create or replace function public.cast_vote(item_type text, item_id uuid, value integer)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_pseudo text;
begin
  v_pseudo := private.pseudo(private.assert_can_vote());

  case cast_vote.item_type
    when 'proposal' then
      if cast_vote.value not in (-1, 0, 1) then
        raise exception 'invalid_value';
      end if;
      perform 1 from public.proposals pr where pr.id = cast_vote.item_id and pr.status = 'open';
      if not found then
        raise exception 'item_not_votable';
      end if;
      insert into public.proposal_votes as v (proposal_id, voter_pseudo, value)
      values (cast_vote.item_id, v_pseudo, cast_vote.value)
      on conflict on constraint proposal_votes_pkey
      do update set value = excluded.value, updated_at = now();

    when 'piazza' then
      if cast_vote.value not in (-1, 0, 1) then
        raise exception 'invalid_value';
      end if;
      perform 1 from public.piazza_messages m where m.id = cast_vote.item_id and m.status <> 'removed';
      if not found then
        raise exception 'item_not_votable';
      end if;
      insert into public.piazza_votes as v (message_id, voter_pseudo, value)
      values (cast_vote.item_id, v_pseudo, cast_vote.value)
      on conflict on constraint piazza_votes_pkey
      do update set value = excluded.value, updated_at = now();

    when 'reformulation' then
      if cast_vote.value not in (-1, 1) then
        raise exception 'invalid_value';
      end if;
      perform 1 from public.problem_reformulations r where r.id = cast_vote.item_id and r.status = 'open';
      if not found then
        raise exception 'item_not_votable';
      end if;
      insert into public.problem_reformulation_votes as v (reformulation_id, voter_pseudo, value)
      values (cast_vote.item_id, v_pseudo, cast_vote.value)
      on conflict on constraint problem_reformulation_votes_pkey
      do update set value = excluded.value, updated_at = now();

    else
      raise exception 'invalid_item_type';
  end case;
end;
$$;
revoke execute on function public.cast_vote(text, uuid, integer) from public, anon, authenticated;
grant execute on function public.cast_vote(text, uuid, integer) to authenticated;

-- Sostegno a un problema: idempotente. Solo problemi pending/active.
create or replace function public.support_problem(problem_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_pseudo text;
begin
  v_pseudo := private.pseudo(private.assert_can_vote());
  perform 1 from public.problems p
  where p.id = support_problem.problem_id and p.status in ('pending', 'active');
  if not found then
    raise exception 'item_not_votable';
  end if;
  insert into public.problem_supports (problem_id, voter_pseudo)
  values (support_problem.problem_id, v_pseudo)
  on conflict on constraint problem_supports_pkey do nothing;
end;
$$;
revoke execute on function public.support_problem(uuid) from public, anon, authenticated;
grant execute on function public.support_problem(uuid) to authenticated;

-- Rating di utilità di un argomento: un secondo rating aggiorna il precedente.
create or replace function public.rate_argument(argument_id uuid, useful boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_pseudo text;
begin
  if rate_argument.useful is null then
    raise exception 'invalid_value';
  end if;
  v_pseudo := private.pseudo(private.assert_can_vote());
  perform 1 from public.arguments a where a.id = rate_argument.argument_id and a.status <> 'removed';
  if not found then
    raise exception 'item_not_votable';
  end if;
  insert into public.argument_ratings (argument_id, rater_pseudo, useful)
  values (rate_argument.argument_id, v_pseudo, rate_argument.useful)
  on conflict on constraint argument_ratings_pkey
  do update set useful = excluded.useful;
end;
$$;
revoke execute on function public.rate_argument(uuid, boolean) from public, anon, authenticated;
grant execute on function public.rate_argument(uuid, boolean) to authenticated;

-- Il proprio voto (mai quello altrui). item_type come cast_vote più:
-- 'problem' → 1 se sostenuto; 'argument' → 1 utile / -1 non utile. null se nessun voto.
create or replace function public.my_vote(item_type text, item_id uuid)
returns smallint
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pseudo text;
  v_value smallint;
begin
  v_pseudo := private.pseudo(private.assert_can_vote());
  case my_vote.item_type
    when 'proposal' then
      select v.value into v_value from public.proposal_votes v
      where v.proposal_id = my_vote.item_id and v.voter_pseudo = v_pseudo;
    when 'piazza' then
      select v.value into v_value from public.piazza_votes v
      where v.message_id = my_vote.item_id and v.voter_pseudo = v_pseudo;
    when 'reformulation' then
      select v.value into v_value from public.problem_reformulation_votes v
      where v.reformulation_id = my_vote.item_id and v.voter_pseudo = v_pseudo;
    when 'problem' then
      select 1 into v_value from public.problem_supports s
      where s.problem_id = my_vote.item_id and s.voter_pseudo = v_pseudo;
    when 'argument' then
      select case when r.useful then 1 else -1 end into v_value from public.argument_ratings r
      where r.argument_id = my_vote.item_id and r.rater_pseudo = v_pseudo;
    else
      raise exception 'invalid_item_type';
  end case;
  return v_value;
end;
$$;
revoke execute on function public.my_vote(text, uuid) from public, anon, authenticated;
grant execute on function public.my_vote(text, uuid) to authenticated;
