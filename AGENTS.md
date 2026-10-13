# Arengo — contesto agenti

## Protocollo token
1. Non esplorare: trova il compito in "Instradamento" e apri solo quei file.
2. Cerca, non leggere: Grep su `.ai/mappa-codice.md`; Read con offset/limit sui file grandi. Mai interi: lockfile, `src/types/database.ts`, migrazioni vecchie.
3. Un agente = una milestone di `docs/PLAN.md`. Non uscire dai file della milestone; il fuori scope va in lista, non nel codice.
4. Non rileggere file appena scritti. Non riassumere ciò che l'utente ha già visto.
5. "Fatto" = `/verify` verde con output reale. Stato e decisioni si scrivono in `docs/PLAN.md`, non in chat.

## Prodotto
Piattaforma italiana non profit per discutere di politica e trovare soluzioni condivise. Gli utenti (maggiorenni residenti in Italia) propongono soluzioni strutturate e votano; un motore di consenso trasparente trova le "proposte ponte", approvate da gruppi che su tutto il resto la pensano diversamente. Le proposte ponte formano l'Agenda versionata. Dominio: arengo.org. Requisiti completi e glossario: `docs/BRIEF.md`. Piano e stato: `docs/PLAN.md`.

## Principi non negoziabili
1. **Ogni utente pesa uguale.** Un account verificato = un voto. La reputazione sblocca permessi (curatore, giurato), mai potere di voto.
2. **Mai chiedere l'orientamento politico.** I gruppi d'opinione del motore sono anonimi, numerati, ricalcolati a ogni run e **mai salvati associati a un utente**: l'assegnazione pseudo→gruppo vive solo in memoria durante la run. Le giurie usano panel pre-estratti (`private.jury_panels`, senza etichetta di gruppo).
3. **Voto segreto.** Voti/sostegni/rating salvati con `voter_pseudo` = HMAC(user_id, segreto in Vault). Nessuna API, vista, log o ruolo applicativo espone voti individuali: solo aggregati. È pseudonimizzazione, non anonimizzazione.
4. **Nessuna censura delle idee.** Si rimuove solo ciò che viola la Scala di severità livelli 2-4 (`docs/BRIEF.md`).
5. **Moderare con il ranking**: ordinamento per consenso trasversale, mai per engagement.
6. **Anti-X by design.** Niente follower, like pubblici sulle persone, trending, condivisione con commento, messaggi privati, profili pubblici.
7. **Il gestore si auto-limita.** Il ruolo admin applicativo non può modificare voti, risultati del motore, Agenda, reputazione, esiti di giuria. Ogni soglia sta in `platform_config`; ogni modifica passa da funzione che scrive `config_changelog` con motivazione. (Limite dichiarato: chi ha service role/dashboard Supabase tecnicamente può tutto; va scritto in `docs/ALGORITMO.md`.)
8. **Trasparenza verificabile.** Repo pubblico AGPL-3.0, algoritmo in `docs/ALGORITMO.md`, run e log pubblici (i log stampano solo aggregati), registro moderazione anonimizzato.
9. **Minimizzazione dati (GDPR art. 9).** Il testo bloccato dal filtro NON si salva né si logga (né console né Sentry). Il Bar si autocancella.

## Stack
Next.js 16 App Router (Server Actions, `proxy.ts` non `middleware.ts`), TypeScript strict, Tailwind, Supabase (Postgres, Auth phone OTP + Turnstile, RLS, pg_cron, Vault), Vercel, Upstash Redis (rate limit), Zod, GitHub Actions (CI + motore notturno), Vitest + pgTAP. pnpm. Font self-hosted (`next/font/local`). UI in italiano, fuso Europe/Rome.
**Niente design**: HTML semantico + Tailwind minimo. Il design lo fa Manuel dopo.

## Struttura
| Percorso | Contenuto |
|---|---|
| `src/app/` | rotte Next.js e Server Actions |
| `src/lib/` | client Supabase, rate limit, `checkContent`, schemi Zod |
| `src/types/database.ts` | tipi generati (non a mano, non leggere intero) |
| `supabase/migrations/` | migrazioni numerate, solo nuove |
| `supabase/tests/` | test pgTAP (RLS, RPC) |
| `engine/` | motore di consenso (TS), eseguito da GitHub Actions |
| `content/` | testi statici e legali (`[DA VERIFICARE CON LEGALE]`) |
| `docs/` | BRIEF, PLAN, ALGORITMO; `archive/` = storico, non leggere |
Le aree `src/`, `supabase/`, `engine/` hanno il proprio `AGENTS.md` (creato dalla milestone che le apre).

## Convenzioni
- Schemi DB: `public` (via RLS) e `private` (solo service role, mai esposto a PostgREST, nessun grant ad anon/authenticated).
- RLS attiva su ogni tabella, default deny. Scritture solo da Server Action → Zod → rate limit → `checkContent` (per testi) → RPC/insert.
- Voti/sostegni/rating solo via RPC `SECURITY DEFINER` che calcolano il pseudo lato server e verificano onboarding completo + status attivo. Il controllo di autorizzazione sta nel DB, non (solo) in `proxy.ts`.
- Contenuti con autore esposti solo tramite viste `*_public` senza `author_id`.
- Soglie: sempre da `platform_config`, mai numeri magici nel codice o nell'SQL.
- Migrazioni: solo nuove, numero > max esistente. Mai modificare una migrazione già su main.
- Zero segreti, ref di progetto, email o dati personali nel repo (è pubblico). Segreti in `.env.local` (gitignored) e nei secret di Vercel/GitHub.
- `[DA VERIFICARE CON LEGALE]`: lasciare come TODO visibile, non risolvere.
- Decisioni non ovvie: una riga in `docs/PLAN.md` → "Decisioni".

## Instradamento
| Compito | Leggi solo |
|---|---|
| eseguire una milestone | `docs/PLAN.md` sez. milestone, `docs/BRIEF.md` sez. citate, `AGENTS.md` dell'area |
| tabella/RLS/RPC | `supabase/AGENTS.md`, Grep `.ai/mappa-codice.md` per la tabella, ultima migrazione che la tocca |
| soglia/config | Grep `platform_config` nella migrazione di seed |
| pagina o Server Action | `src/AGENTS.md`, Grep mappa per la rotta |
| filtro contenuti | `src/lib/moderation/`, `docs/BRIEF.md` sez. Scala |
| motore | `engine/AGENTS.md`, `docs/ALGORITMO.md` |
| brief per un sotto-agente | `.ai/brief-agente.md` |

## Comandi
| Comando | Cosa fa |
|---|---|
| `pnpm dev` | server di sviluppo (http://localhost:3000) |
| `pnpm typecheck` | `next typegen` + `tsc` app + typecheck `engine` |
| `pnpm lint` | ESLint su tutto il repo |
| `pnpm test` | Vitest app (`src/`, `scripts/`) + `engine` |
| `pnpm --filter engine test` | solo test del motore |
| `pnpm build` | build Next.js |
| `pnpm ai:map` / `pnpm ai:check` | rigenera / verifica `.ai/mappa-codice.md` (hook PostToolUse la rigenera da solo) |
| `pnpm check:changed` | typecheck+lint+test solo dei pacchetti toccati rispetto a main |
DB: niente Docker locale. Test SQL/RLS girano solo nel job CI `db` (`supabase start` + `db reset` + `test db`); app su progetto Supabase dev remoto. Supabase CLI via `pnpm dlx supabase@2.120.0` (stessa versione della CI). TypeScript fermo a 6.x finché typescript-eslint non supporta TS 7.
Windows/PowerShell: niente `&&` in PowerShell 5.1; per i comandi POSIX usare il tool Bash.

## Git
Un branch per milestone `claude/mX-<tema>`, una PR per branch, CI verde. **Mai merge su main né push su main senza ok esplicito di Manuel.** Commit in Conventional Commits. Prima di correggere dopo una review: `git pull --rebase`.

## Azioni che richiedono ok esplicito
Creare/cancellare risorse esterne (repo GitHub, progetti Supabase/Vercel/Upstash), scrivere sul DB remoto, installare dipendenze nuove, push/merge.

## Trappole note
- Cron GitHub Actions è UTC: le 03:00 Europe/Rome cambiano con l'ora legale → doppio cron + guardia oraria nello script.
- Il segreto HMAC dei pseudo non è ruotabile senza migrare tutti i voti: backup fuori repo.

## Fatto vuol dire
- [ ] criteri del task in `docs/PLAN.md` verificati con `/verify` (output reale)
- [ ] typecheck, lint, test verdi; CI verde sul branch
- [ ] nessun segreto/dato personale nel diff; nessuna soglia hardcoded
- [ ] `pnpm ai:map` rigenerata, stato task aggiornato in `docs/PLAN.md`
