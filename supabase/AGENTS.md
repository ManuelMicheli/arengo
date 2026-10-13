# supabase/ — database

## Struttura
- `config.toml`: config CLI locale (usata solo in CI). `migrations/`: migrazioni numerate. `tests/`: test pgTAP (`*.test.sql`). `seed.sql`: seed (da M1).
- CLI sempre via `pnpm dlx supabase@2.120.0` in locale (stessa versione del job CI). Niente Docker locale: `start`, `db reset`, `test db` girano solo nel job CI `db`.

## Convenzioni
- Migrazioni: solo nuove, prefisso numerico > max esistente, mai modificare una migrazione già su main. Nome: `<timestamp>_<tema>.sql` (`pnpm dlx supabase migration new <tema>`).
- Schemi: `public` (esposto via PostgREST, RLS) e `private` (solo service role; nessun grant ad anon/authenticated; mai in `api.schemas`).
- RLS attiva su ogni tabella, default deny; policy esplicite per ruolo.
- Voti/sostegni/rating: solo via RPC `SECURITY DEFINER` con `set search_path = ''`, pseudo calcolato lato server (`private.pseudo`), controllo onboarding + status. Nessuna SELECT diretta sulle tabelle di voto.
- Contenuti con autore esposti solo da viste `*_public` senza `author_id`.
- Soglie solo da `platform_config`, mai numeri magici nell'SQL. Modifiche config solo via `admin_set_config` (scrive `config_changelog`).
- Nessun ref di progetto, URL o chiave nel repo.
- Grant: default deny (M1 revoca i default di Supabase). Ogni tabella nuova: `enable row level security` + grant espliciti, per colonna se ha colonne d'autore. Ogni funzione nuova: `revoke execute ... from public, anon, authenticated` + grant mirato.
- Viste `*_public` con `security_invoker = true` quando grant/RLS della tabella bastano; altrimenti `security_invoker = false, security_barrier = true` con il motivo in commento (es. aggregati sui voti, handle senza profili pubblici).
- **Scritture di contenuti (da M4 in poi): ogni RPC/insert DEVE chiamare `private.assert_can_write(content_type)`** (onboarding, stato account, pausa del filtro) prima di scrivere. Il filtro testuale gira lato server (`src/lib/moderation/`); `record_filter_block` è eseguibile solo dal service role.
- Lessico del filtro: scritture solo via `admin_lexicon_upsert/delete` (motivazione → `lexicon_changelog`, pubblico senza termine). Guida per compilarlo: `docs/LESSICO.md`.
- Admin applicativo = `public.is_admin()` (`app_metadata.role = 'admin'` nel JWT). Non ha grant di scrittura su voti, config o risultati.
- Tipi: `src/types/database.ts` si rigenera solo dal DB di CI. Se il passo "Tipi DB" fallisce, scarica l'artifact `database-types` (`gh run download <id> -n database-types`) e committalo.

## Segreto dei pseudo (Vault)
`private.pseudo` legge `vote_pseudo_secret` da Vault. In CI/locale lo crea `seed.sql` con un valore di test pubblico. In produzione lo crea Manuel una sola volta, a mano, dall'SQL editor, generato nel DB così il valore non passa da cronologia, chat o repo (backup fuori repo dal Vault; non ruotabile senza migrare i voti):
`select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'vote_pseudo_secret', 'HMAC pseudo di voto');`
- **Mai `supabase db reset --linked`** né `db push --include-seed` sul remoto: installerebbero il segreto di test.
- Le migrazioni sul remoto si applicano solo dopo il merge su main e con ok di Manuel; le versioni in `supabase_migrations.schema_migrations` devono coincidere con i nomi file.

## Test pgTAP
Ogni tabella/RPC nuova ha test: utente autorizzato riesce, non autorizzato fallisce (anon, authenticated altrui, admin dove vietato). Struttura: `begin; select plan(n); ...; select * from finish(); rollback;`. Un task DB è `verified` solo con job CI `db` verde.
