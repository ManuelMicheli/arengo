-- Seed SOLO per CI e DB locali (`supabase db reset`). Non viene applicato in produzione da `db push`.
-- Segreto HMAC dei pseudo di voto: valore di test pubblico, mai usato in produzione.
-- In produzione il segreto lo crea Manuel a mano (comando in supabase/AGENTS.md).
select vault.create_secret(
  'ci-test-only-not-a-real-secret',
  'vote_pseudo_secret',
  'Solo CI/locale: valore di test, mai in produzione'
);
