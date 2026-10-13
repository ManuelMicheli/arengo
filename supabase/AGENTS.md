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

## Test pgTAP
Ogni tabella/RPC nuova ha test: utente autorizzato riesce, non autorizzato fallisce (anon, authenticated altrui, admin dove vietato). Struttura: `begin; select plan(n); ...; select * from finish(); rollback;`. Un task DB è `verified` solo con job CI `db` verde.
