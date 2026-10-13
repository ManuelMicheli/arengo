# Piano — Arengo

Riferimento: [BRIEF](./BRIEF.md) · Regole: [AGENTS.md](../AGENTS.md)
Stati task: `todo` · `doing` · `verified` (solo dopo /verify PASS) · `blocked`
Esecuzione: una milestone per volta, sessione pulita, `/milestone Mx` (o brief equivalente). Dopo ogni milestone: `/verify Mx` → `fresh-reviewer` → PR → merge solo con ok di Manuel.

## Rischi principali
| Rischio | Impatto | Mitigazione |
|---|---|---|
| Fuga di voti individuali o di associazione utente→gruppo | alto (art. 9, fiducia) | voti solo via RPC con pseudo; nessuna SELECT diretta; gruppi solo in memoria; pgTAP in CI per ogni tabella; qa-security in M10 |
| Brigading / account falsi che spostano il consenso | alto | età minima account per il motore, stabilità su più run, test di brigading obbligatorio, OTP + Turnstile |
| Test RLS non eseguibili in locale (no Docker) | medio | job CI con `supabase start` + `supabase test db` dal M0; nessun task DB è `verified` senza CI verde |

## Milestone

### M0 — Fondazioni (scaffold, CI, mappa)
Dimostrazione: `pnpm dev` mostra una home grezza; CI verde su PR con job app + job DB.

| # | Task | Possiede | Accettazione | Verifica | Dipende | Stato |
|---|---|---|---|---|---|---|
| 0.1 | Scaffold Next.js 16 (ultima stabile, versione dal package.json reale) + TS strict + Tailwind + ESLint, pnpm workspace con pacchetti root (app) e `engine/` | root, `src/app/` | `pnpm dev` serve `/` con titolo "Arengo"; `tsconfig` strict | `pnpm typecheck && pnpm lint && pnpm build` | — | verified |
| 0.2 | Vitest (app + engine), Zod, `@supabase/ssr`, `@supabase/supabase-js`, `@upstash/ratelimit` + `@upstash/redis`; in `engine/`: `ml-pca` (k-means, silhouette e PRNG si scrivono a mano in E1). Font self-hosted via `next/font/local` | `package.json`, `engine/package.json` | un test d'esempio per pacchetto passa; nessuna richiesta a Google Fonts | `pnpm test`; grep `fonts.googleapis` = 0 | 0.1 | verified |
| 0.3 | `supabase init` (via `pnpm dlx supabase`), cartelle `supabase/migrations`, `supabase/tests` con un test pgTAP banale; `.env.example` senza valori; `.gitignore` con `.env*` | `supabase/`, `.env.example` | struttura presente, nessun segreto tracciato | `git ls-files | grep -i env` mostra solo `.env.example` | 0.1 | verified |
| 0.4 | GitHub Actions CI: job `app` (typecheck, lint, test, build) + job `db` (`supabase start`, `supabase db reset`, `supabase test db`) su PR e push | `.github/workflows/ci.yml` | entrambi i job verdi sulla PR di M0 | `gh run list --branch claude/m0-scaffold` | 0.2, 0.3 | verified |
| 0.5 | Script `pnpm ai:map` → `.ai/mappa-codice.md` (file → export, rotte, tabelle da migrazioni, file grandi da non leggere) + `ai:check` in CI + `check:changed` (solo pacchetti toccati) + hook PostToolUse in `.claude/settings.json` che rigenera la mappa | `scripts/`, `.claude/settings.json`, `.ai/` | mappa generata e non vuota; `ai:check` fallisce se la mappa è vecchia | `pnpm ai:map && pnpm ai:check` | 0.1 | verified |
| 0.6 | `src/AGENTS.md`, `supabase/AGENTS.md`, `engine/AGENTS.md` (1-3 KB, solo convenzioni dell'area) + sezione "Comandi" di `AGENTS.md` aggiornata con i comandi reali | `*/AGENTS.md` | ogni comando citato esiste in package.json | lettura + esecuzione dei comandi | 0.1-0.5 | verified |

Richiede ok di Manuel: creazione repo GitHub pubblico `arengo`, creazione progetto Supabase `arengo-dev`, installazione dipendenze.

### M1 — Schema core, voto pseudonimo, RLS
Dimostrazione: migrazioni applicate in CI; test pgTAP dimostrano che nessuno legge voti individuali.

Specifica:
- `private.pseudo(uid uuid) returns text` = `encode(hmac(uid::text, <segreto Vault 'vote_pseudo_secret'>, 'sha256'), 'hex')`, SECURITY DEFINER, eseguibile solo da service role e dalle RPC di voto.
- Tabelle `public`: `profiles` (id=auth.users.id, handle unico 3-20, status active|suspended|banned, suspended_until, rules_version_accepted, consent_art9_at, adult_declared_at, created_at, deleted_at) · `platform_config` (key pk, value jsonb, description, updated_at) · `config_changelog` (id, key, old_value, new_value, reason NOT NULL, changed_by, changed_at) · `topics` (id, slug, title, description, selection_criterion, sort, is_active) · `problems` (id, topic_id, title ≤120, body ≤1000, affected ≤300, status pending|active|merged|archived, merged_into, author_id, created_at, activated_at) · `problem_supports` (problem_id, voter_pseudo, created_at, pk composta) · `problem_reformulations` (id, problem_id, title, body, author_id, status open|accepted|rejected, created_at) · `problem_reformulation_votes` (reformulation_id, voter_pseudo, value) · `sources` (id, url, title, publisher, kind istituzionale|primaria|studio|stampa, added_by, created_at) · `problem_facts` (id, problem_id, statement ≤400, source_id NOT NULL, status proposed|approved|rejected, proposed_by, reviewed_by, created_at) · `proposals` (id, problem_id, what ≤300, how ≤1200, cost_and_funding ≤600, risks ≤600, foreign_example ≤600 null, foreign_source_id null, origin direct|piazza, origin_message_id null, author_id, status open|archived, created_at) · `proposal_votes` (proposal_id, voter_pseudo, value smallint in (-1,0,1), voted_at, updated_at, pk composta) · `arguments` (id, proposal_id, side pro|contro, body ≤400, author_id, status, cross_utility numeric null, created_at) · `argument_ratings` (argument_id, rater_pseudo, useful bool, created_at, pk composta) · `piazza_messages` (id, topic_id, problem_id null, parent_id null, depth 0..1, body, author_id, status visible|collapsed_pending|removed, bridging_score numeric null, created_at) · `piazza_votes` (message_id, voter_pseudo, value -1|0|1, created_at, pk composta) · `bar_messages` (id, topic_id, parent_id null, depth 0..1, body, author_id, status, created_at, expires_at).
- Viste: `problems_public`, `proposals_public`, `arguments_public` (senza author_id); `piazza_public`, `bar_public` (handle sì, author_id no); aggregati `proposal_tallies`, `piazza_tallies`, `argument_utility`.
- RPC SECURITY DEFINER: `cast_vote(item_type, item_id, value)`, `support_problem(problem_id)`, `rate_argument(argument_id, useful)`, `my_vote(item_type, item_id)`. Ognuna rifiuta se onboarding incompleto (adult_declared_at, rules_version_accepted, consent_art9_at null) o status ≠ active (sospensione scaduta = active).
- `set_config(key, value, reason)`: solo ruolo admin (`app_metadata.role='admin'`), reason obbligatoria, scrive `config_changelog`. Nessun'altra via di UPDATE su platform_config.
- Seed `platform_config`: problem_support_threshold=25, reformulation_min_votes=10, piazza_max_chars=500, bar_max_chars=1000, bar_retention_days=60, min_account_age_days_for_engine=7, min_votes_participant=7, min_votes_item=5, min_votes_per_cluster=3, min_participants_for_clustering=50, k_min=2, k_max=5, bridging_threshold=0.6, bridging_stable_runs=2, divisive_gap=0.4, majority_threshold=0.6, promotion_min_bridging=0.6, promotion_min_votes=15, piazza_new_window_hours=24, rate_limits={problems:1, proposals:3, arguments:10, piazza:30, bar:60, reports:20} (al giorno), slowmode_window_min=10, slowmode_trigger_msgs=20, slowmode_user_interval_min=5, jury_size=5, jury_min_buckets=3, jury_deadline_hours=48, jury_min_votes=3, jury_max_redraws=2, jury_no_sanction_days=90, auto_collapse_reports=5, l4_sla_hours=24, sanction_decay_days=180, filter_l3_blocks_pause=3, filter_pause_minutes=10, curators_count=7, curator_term_months=3, curator_min_account_days=60, curator_reputation_percentile=80, curator_no_sanction_days=180, curator_merge_approvals=2, juror_min_account_days=30, reputation_half_life_days=90, agenda_top_arguments=2, account_deletion_mode="anonymize".

| # | Task | Possiede | Accettazione | Verifica | Dipende | Stato |
|---|---|---|---|---|---|---|
| 1.1 | Migrazioni schemi, tabelle, vincoli, indici (FK, (topic_id, created_at), status), RLS attiva ovunque default deny, grant: nessuno su `private` | `supabase/migrations/` | `supabase db reset` pulito in CI | job CI `db` | M0 | todo |
| 1.2 | `private.pseudo` + RPC voto/sostegno/rating/my_vote con controlli onboarding/status | `supabase/migrations/` | voto doppio aggiorna invece di duplicare; utente non onboardato/sospeso → errore | pgTAP | 1.1 | todo |
| 1.3 | Viste pubbliche e aggregati; `set_config` + changelog; seed config | `supabase/migrations/`, `supabase/seed.sql` | viste senza author_id; config leggibile da anon | pgTAP | 1.1 | todo |
| 1.4 | Test pgTAP: anon non legge voti; authenticated non legge voti altrui né `voter_pseudo`; admin non può UPDATE/DELETE voti; `private` non esposto; `author_id` non leggibile da anon/authenticated | `supabase/tests/` | tutti verdi | `supabase test db` in CI | 1.2, 1.3 | todo |
| 1.5 | Tipi generati in `src/types/database.ts` (generatore Supabase in CI o `pnpm dlx supabase gen types` sul DB di CI) | `src/types/` | typecheck verde | `pnpm typecheck` | 1.1 | todo |

### E1 — Motore core puro (stream parallelo, solo `engine/`)
Dimostrazione: test sintetici verdi, output identico con stesso seed. Nessun accesso a DB, nessuna migrazione, non tocca `package.json` root né lockfile (dipendenze già installate in M0).

Algoritmo (funzioni pure, input = voti `{pseudo, item, value}` + config):
1. Partecipanti: pseudo con account ≥ min_account_age_days_for_engine e ≥ min_votes_participant voti (esclusi dal calcolo, non dal voto). Item con ≥ min_votes_item voti.
2. Matrice partecipanti × item: +1/-1/0 (passo), mancante NaN. Centra le colonne sulla media osservata; mancanti → 0 dopo il centraggio.
3. PCA 2 componenti (`ml-pca`). Se partecipanti < min_participants_for_clustering → esito `insufficient`, solo approvazioni totali.
4. k-means sulla proiezione 2D per k in [k_min, k_max], scelta per silhouette massima (implementata a mano). PRNG con seed deterministico (implementato a mano, es. mulberry32).
5. Per item e gruppo con ≥ min_votes_per_cluster voti: p_agree = (agree+1)/(agree+disagree+pass+2). bridging_score = min tra i gruppi; gruppo con voti insufficienti → `insufficiente`.
6. Classificazione: `ponte` se min ≥ bridging_threshold; `divisivo` se max-min ≥ divisive_gap; `maggioritario` se approvazione totale ≥ majority_threshold; altrimenti `nessun_consenso`.
7. Stabilità: `stable_ponte` se ponte nelle ultime bridging_stable_runs run (input: storico classificazioni).
8. Panel giuria: dato l'insieme degli idonei (in input) e i gruppi in memoria, forma panel di jury_size con ≥ jury_min_buckets gruppi diversi; output solo `panel_id → pseudo[]`, nessuna etichetta di gruppo.
9. Reputazione: per ogni "utile" a un argomento e "d'accordo" a un messaggio Piazza, credito all'autore 1 se il votante è in un gruppo diverso, 0.25 se nello stesso; decadimento esponenziale con half-life reputation_half_life_days. Input: pseudo dell'autore (calcolato fuori dal core).
10. Il core non logga nulla per utente; restituisce solo strutture aggregate + panel + reputazione.

| # | Task | Possiede | Accettazione | Verifica | Dipende | Stato |
|---|---|---|---|---|---|---|
| E1.1 | Matrice, centraggio, PCA, PRNG, k-means, silhouette | `engine/src/core/` | test unitari su casi noti | `pnpm --filter engine test` | M0 | todo |
| E1.2 | p_agree, bridging, classificazione, stabilità | `engine/src/core/` | test con valori attesi calcolati a mano | idem | E1.1 | todo |
| E1.3 | Panel giuria + reputazione | `engine/src/core/` | panel sempre con ≥ jury_min_buckets gruppi; nessun output con etichetta di gruppo | idem | E1.1 | todo |
| E1.4 | Generatore dati sintetici + test: 2 gruppi polarizzati (200 utenti) + 5 item trasversali → trovati come ponte, divisivi classificati; brigading: 50 account nuovi in blocco non cambiano classificazione; stesso seed → output identico (deep equal) | `engine/test/` | tutti verdi | idem | E1.2, E1.3 | todo |
| E1.5 | Bozza `docs/ALGORITMO.md` in italiano semplice (passi, parametri, limiti, cosa NON si salva, limite del principio 7) | `docs/ALGORITMO.md` | ogni parametro citato esiste nel seed config | lettura + grep chiavi | E1.4 | todo |

### M2 — Filtro contenuti pre-invio
Specifica: tabella `lexicon_terms` (term, level 2|3|4, is_pattern, notes), solo admin, **seed vuoto** (TODO Manuel; nei test termini fittizi). `filter_block_stats` (day, level, content_type, count). `private.filter_strikes` (user_id, blocked_at) solo per la pausa, nessun testo, pulizia > 24h. `checkContent(text, context)`: normalizzazione (minuscole, NFKD senza accenti, leet 0→o 1→i 3→e 4→a 5→s 7→t @→a $→s, ripetizioni ridotte, separatori tra lettere singole rimossi); livello 2 = termine offensivo + pattern rivolto alla persona ("sei un", "tu sei", menzione di handle, "vai a"). Esito `ok` | `blocked{level, rule}`. Il testo bloccato non si salva né si logga. Nessuna sanzione automatica; dopo filter_l3_blocks_pause blocchi L3 in 24h → pausa di scrittura filter_pause_minutes.

| # | Task | Possiede | Accettazione | Verifica | Dipende | Stato |
|---|---|---|---|---|---|---|
| 2.1 | Migrazione lexicon/stats/strikes + RLS | `supabase/` | anon/authenticated non leggono lexicon né strikes | pgTAP | M1 | todo |
| 2.2 | `checkContent` + normalizzazione | `src/lib/moderation/` | casi "f.r.o.c.i.o"-style (con termine fittizio), leet, accenti, ripetizioni; etichetta politica descrittiva ammessa | Vitest | 2.1 | todo |
| 2.3 | Integrazione: stats, pausa, messaggio all'utente con regola | `src/lib/moderation/` | nessun testo bloccato in DB, log o console (test che intercetta console) | Vitest + pgTAP | 2.2 | todo |

### M3 — Auth, onboarding, privacy
Specifica: Supabase Auth phone OTP (provider SMS da env; in dev numeri di test) + CAPTCHA Turnstile; un numero = un account, il numero resta solo in auth.users. Onboarding obbligatorio in 3 passi: (a) maggiore età; (b) regole + Scala (salva rules_version_accepted); (c) consenso art. 9 con checkbox non preselezionata e testo (voti → opinioni politiche, pseudonimizzazione, la piattaforma non chiede l'orientamento, come revocare). Testi in `content/legal/*.md` con `[DA VERIFICARE CON LEGALE]`. Handle: 3-20, unico, rifiutato se `checkContent` ≠ ok. `proxy.ts` reindirizza all'onboarding (UX), ma il blocco vero è nelle RPC/RLS (M1). Revoca consenso = cancellazione account (spiegato in UI). Export (art. 20): JSON con profilo, contenuti, voti propri via pseudo. Cancellazione: elimina voti, sostegni, rating (via pseudo), Bar, reputazione; Piazza/proposte/argomenti cancellati o anonimizzati ("utente eliminato") secondo `account_deletion_mode`. Rate limit OTP per IP e per numero (Upstash).

| # | Task | Possiede | Accettazione | Verifica | Dipende | Stato |
|---|---|---|---|---|---|---|
| 3.1 | Login OTP + Turnstile + rate limit | `src/app/(auth)/`, `src/lib/` | login con numero di test; superato il limite → 429 | Playwright + Vitest | M2 | todo |
| 3.2 | Onboarding 3 passi + handle + testi legali | `src/app/onboarding/`, `content/legal/` | scrittura negata finché incompleto | pgTAP + Playwright | 3.1 | todo |
| 3.3 | Sospensioni (scadenza automatica) | `supabase/`, `src/` | utente sospeso → scrittura negata; dopo suspended_until → consentita | pgTAP | 3.2 | todo |
| 3.4 | Export e cancellazione account | `src/app/account/`, `supabase/` | dopo cancellazione: zero righe con il suo pseudo; contenuti pubblici anonimizzati | pgTAP + Vitest | 3.2 | todo |

### M4 — Contenuti core
Specifica: Server Action → Zod → rate limit (config) → `checkContent` → RPC/insert. Problemi con checklist di formulazione neutra; `pending` → `active` a problem_support_threshold sostegni. Riformulazioni votabili, accettate se superano il testo attuale con ≥ reformulation_min_votes; storico visibile. Schede: fatto + fonte obbligatoria, tipo fonte mostrato, approvazione curatori (permesso in M8; qui stato `proposed`). Proposte solo su problemi attivi, campi obbligatori tranne esempio estero, autore mai mostrato. Voto d'accordo/contrario/passo modificabile; ordine proposte casuale per utente (seed di sessione). Argomenti pro/contro, "utile/non utile", ordinati per cross_utility (prima della run: ordine casuale). Ricerca full-text Postgres config `italian` su problemi, schede, proposte (Agenda aggiunta in M9). Pagine funzionali grezze.

| # | Task | Possiede | Accettazione | Verifica | Dipende | Stato |
|---|---|---|---|---|---|---|
| 4.1 | Temi + problemi + sostegni + attivazione a soglia | `src/app/temi/`, `src/app/problemi/`, `supabase/` | al sostegno N il problema diventa active | pgTAP + Playwright | M3 | todo |
| 4.2 | Riformulazioni + schede/fonti | idem | riformulazione accettata sopra soglia; fatto senza fonte rifiutato | pgTAP + Vitest | 4.1 | todo |
| 4.3 | Proposte + voto + ordine casuale | `src/app/proposte/` | voto unico per pseudo; proposta su problema pending rifiutata | pgTAP + Playwright | 4.1 | todo |
| 4.4 | Argomenti + rating | `src/app/proposte/` | autore non esposto da nessuna query anon/authenticated | pgTAP | 4.3 | todo |
| 4.5 | Ricerca full-text | `supabase/`, `src/app/cerca/` | "casa" trova "case"/"abitazione" via stemming italiano dove applicabile | Vitest su DB CI | 4.1 | todo |

### M5 — Piazza e Bar
Specifica: Piazza per tema (e opz. problema), profondità max 2, limite piazza_max_chars, voto via `cast_vote`. Due liste: "Più condivisi" per bridging_score, "Nuovi" = ultime piazza_new_window_hours non ancora valutati. Slow mode: se un thread supera slowmode_trigger_msgs in slowmode_window_min, un messaggio per utente ogni slowmode_user_interval_min, con motivo mostrato. Promozione a proposta: se bridging_score ≥ promotion_min_bridging e voti ≥ promotion_min_votes → form proposta precompilato (origin=piazza, origin_message_id); il messaggio linka la proposta. Bar: stessa struttura, nessun voto, fuori dal motore, expires_at = created_at + bar_retention_days; pg_cron giornaliero elimina gli scaduti tranne quelli con segnalazioni L4 aperte (attivo da M7). Entrambi: checkContent, rate limit, `collapsed_pending` a auto_collapse_reports segnalazioni (collegato in M7). Niente condivisione con commento, niente contatori sulle persone.

| # | Task | Possiede | Accettazione | Verifica | Dipende | Stato |
|---|---|---|---|---|---|---|
| 5.1 | Piazza thread + voto + due liste | `src/app/piazza/`, `supabase/` | profondità 3 rifiutata | pgTAP + Playwright | M4 | todo |
| 5.2 | Slow mode | `supabase/`, `src/lib/` | 21° messaggio in 10 min attiva limite per utente | pgTAP | 5.1 | todo |
| 5.3 | Promozione a proposta | `src/app/piazza/` | negata sotto soglia; sopra soglia crea proposta con origin=piazza | pgTAP + Playwright | 5.1 | todo |
| 5.4 | Bar + pg_cron scadenza | `src/app/bar/`, `supabase/` | messaggio scaduto eliminato dal job | pgTAP (invocazione diretta della funzione del job) | 5.1 | todo |

### M6 — Motore integrato
Specifica: `engine/src/run.ts` con service role: legge voti (solo pseudo) e config, chiama il core E1, scrive output. Pseudo degli autori calcolati via RPC privata, solo in memoria. Tabelle: `consensus_runs` (id, started_at, finished_at, status, n_participants, n_items, k, silhouette, seed, params jsonb, code_version sha), `consensus_cluster_stats` (run_id, cluster_label "Gruppo 1..k", size), `item_consensus` (run_id, item_type, item_id, approval_by_cluster jsonb, overall_approval, bridging_score, n_votes, classification, stable_ponte), `private.jury_panels` (run_id, panel_id, user_id) sovrascritta a ogni run, `private.reputation` (user_id, score, updated_at). Aggiorna `piazza_messages.bridging_score` e `arguments.cross_utility`. GitHub Actions: doppio cron UTC + guardia "sono le 03 a Roma?", avvio manuale; log solo aggregati.

| # | Task | Possiede | Accettazione | Verifica | Dipende | Stato |
|---|---|---|---|---|---|---|
| 6.1 | Migrazioni output motore + RLS (lettura pubblica run/stats/item_consensus; nessun UPDATE/DELETE per admin) | `supabase/` | admin non modifica item_consensus | pgTAP | M5, E1 | todo |
| 6.2 | `run.ts` I/O + scrittura output + panel + reputazione | `engine/src/` | run su seed DB di CI produce righe coerenti | job CI che esegue la run su DB locale | 6.1 | todo |
| 6.3 | Workflow `engine.yml` | `.github/workflows/` | avvio manuale ok; nessun pseudo nei log | `gh run view --log` + grep | 6.2 | todo |
| 6.4 | `docs/ALGORITMO.md` completo | `docs/` | coerente con il codice | lettura | 6.2 | todo |

### M7 — Segnalazioni, giurie, sanzioni
Specifica: segnalazione su qualsiasi contenuto con livello (2,3,4) + nota, una per utente per contenuto. L4 → nascosto subito + coda admin con SLA l4_sla_hours. L2-3 → giuria alla prima segnalazione; a auto_collapse_reports → `collapsed_pending`. Giuria: jury_size membri da un panel di `private.jury_panels`, filtrati per account ≥ juror_min_account_days, nessuna sanzione negli ultimi jury_no_sanction_days, non autore né segnalante (se il panel perde membri, si prende il successivo). Il giurato vede contenuto, messaggio padre, Scala; non autore né segnalanti. Voto viola/non viola/astensione; maggioranza con ≥ jury_min_votes entro jury_deadline_hours, altrimenti nuova estrazione (max jury_max_redraws), poi admin. "Viola" → rimozione + sanzione; "non viola" → ripristino. Sanzioni graduate: avviso → 24h → 7 giorni → ban; storico decade dopo sanction_decay_days senza violazioni. Ricorso: uno per sanzione, nuova giuria che non vede l'esito precedente. `moderation_log_public` (data, tipo contenuto, livello, decisore filtro|giuria|admin, esito; niente testo né handle). `admin_actions` con motivazione obbligatoria + riepilogo pubblico. Collegare eccezione L4 al job del Bar.

| # | Task | Possiede | Accettazione | Verifica | Dipende | Stato |
|---|---|---|---|---|---|---|
| 7.1 | Tabelle reports/juries/jury_members/jury_votes/sanctions/appeals/admin_actions + RLS | `supabase/` | giurato non vede autore; segnalazione doppia rifiutata | pgTAP | M6 | todo |
| 7.2 | Flusso segnalazione → collapse/coda L4 | `src/app/`, `supabase/` | L4 nascosto subito | pgTAP + Playwright | 7.1 | todo |
| 7.3 | Giurie: estrazione, voto, scadenza, ri-estrazione | `supabase/`, `src/app/giuria/` | composizione esclude coinvolti; panel con ≥ jury_min_buckets gruppi | pgTAP | 7.1 | todo |
| 7.4 | Sanzioni graduate + ricorsi + registro pubblico | `supabase/`, `src/app/` | escalation corretta; decadimento | pgTAP | 7.3 | todo |

### M8 — Curatori
Specifica: candidatura opt-in. Idonei: account ≥ curator_min_account_days, reputazione ≥ percentile curator_reputation_percentile, nessuna sanzione negli ultimi curator_no_sanction_days, non curatore nel mandato precedente. Sorteggio ogni curator_term_months, eseguito **dentro la run del motore** (stratificato sui gruppi in memoria): seed pubblico = sha256(data + id ultima consensus_run); salva seed, numero di idonei, algoritmo, estratti. `curator_terms` (handle_snapshot, date) pubblico. Permessi: approvare/rifiutare fatti con motivazione; merge problemi con curator_merge_approvals approvazioni; correggere refusi nelle proposte (diff visibile all'autore, che può annullare). Nessun permesso di eliminare/nascondere/bloccare. Ogni azione loggata pubblicamente.

| # | Task | Possiede | Accettazione | Verifica | Dipende | Stato |
|---|---|---|---|---|---|---|
| 8.1 | Tabelle candidature/mandati/azioni + RLS | `supabase/` | curatore non può nascondere una proposta | pgTAP | M7 | todo |
| 8.2 | Sorteggio nel motore | `engine/src/` | non idoneo mai estratto; stesso seed → stessi estratti | Vitest | 8.1 | todo |
| 8.3 | UI permessi curatore + log pubblico | `src/app/curatori/` | merge solo con 2 approvazioni | pgTAP + Playwright | 8.1 | todo |

### M9 — Agenda, trasparenza, admin
Specifica: a fine run, per tema: problemi attivi → proposte stable_ponte con approval_by_cluster, migliori agenda_top_arguments pro e contro per cross_utility, proposte divisive ("Disaccordi aperti"), numeri della run. Nuova versione in `agenda_versions` (id, topic_id, version, run_id, content jsonb, diff jsonb, generated_at, unique(topic_id, version)) solo se il contenuto cambia; immutabile. Pagine: Agenda per tema + storico versioni; `/regole`; `/come-funziona` (render ALGORITMO.md); `/trasparenza/config`; `/trasparenza/motore` (run, parametri, k, silhouette, link log Actions); `/trasparenza/moderazione`; `/trasparenza/curatori`; `/come-abbiamo-scelto` (statico, TODO Manuel). Admin (`app_metadata.role`): temi, lexicon, coda L4, `set_config`. Non può: voti, item_consensus, agenda_versions, reputazione, esiti giurie. Ricerca estesa all'Agenda.

| # | Task | Possiede | Accettazione | Verifica | Dipende | Stato |
|---|---|---|---|---|---|---|
| 9.1 | `agenda_versions` + generazione nel motore | `supabase/`, `engine/src/` | Agenda generata da dati seed; nessuna nuova versione se invariata | Vitest + pgTAP | M8 | todo |
| 9.2 | Pagine Agenda + trasparenza | `src/app/` | tutte raggiungibili da anon | Playwright 375/768/1440 | 9.1 | todo |
| 9.3 | Area admin limitata | `src/app/admin/` | admin non altera voti/agenda/esiti | pgTAP | 9.1 | todo |

### M10 — Revisione finale
| # | Task | Possiede | Accettazione | Verifica | Dipende | Stato |
|---|---|---|---|---|---|---|
| 10.1 | `qa-security` → `docs/REVIEW.md` | `docs/REVIEW.md` | nessun problema critico aperto | suite completa + CI | M9 | todo |
| 10.2 | `fresh-reviewer` su tutto | — | verdetto "pronto al merge" | — | 10.1 | todo |

## Stream paralleli
Unico stream parallelo: **E1** (solo `engine/src/core/`, `engine/test/`, `docs/ALGORITMO.md`), avviabile dopo M0, in worktree `../ARENGO-engine` branch `claude/e1-engine-core`. Non tocca migrazioni, `package.json`, lockfile, config globali. Integrazione prima di M6. Tutto il resto è sequenziale (migrazioni, `cast_vote`, `checkContent` condivisi).

## Decisioni
| Data | Decisione | Motivo | Alternativa scartata |
|---|---|---|---|
| 2026-10-13 | Contesto in AGENTS.md + BRIEF + PLAN; prompt archiviato | coerenza con WORKFLOW-CLAUDE.md e skill /milestone /verify | CLAUDE.md di 70 righe + 9 subagent implementatori |
| 2026-10-13 | Repo pubblico AGPL-3.0 | trasparenza verificabile, modifiche di servizi derivati restano pubbliche | MIT; privato fino alla beta |
| 2026-10-13 | DB: Supabase dev remoto + test RLS in CI | nessun Docker locale | Docker Desktop locale |
| 2026-10-13 | `private.jury_panels` senza etichetta di gruppo; sorteggio curatori dentro la run | `jury_pool` user_id+bucket violava il principio 2 | jury_pool persistito 24h |
| 2026-10-13 | Next.js 16, `proxy.ts`; autorizzazione nelle RPC/RLS | ultima stabile; middleware non è confine di sicurezza | Next 15 + blocco nel middleware |
| 2026-10-13 | Turnstile su OTP | SMS pumping e costi | solo rate limit IP |
| 2026-10-13 | Filtro (M2) prima di auth (M3) | il controllo handle usa il lessico | ordine originale |
| 2026-10-13 | Soglie implicite del prompt portate in config | principio 7 | numeri nel codice |
| 2026-10-13 | TypeScript 6.x (non 7) | typescript-eslint (usato da eslint-config-next) non supporta TS 7 | TS 7 con installazione side-by-side |
| 2026-10-13 | Supabase CLI fissata a 2.120.0 (`pnpm dlx supabase@2.120.0` in locale, `supabase/setup-cli` in CI) | stessa versione locale/CI; setup-cli più veloce di dlx nel job | `latest` |
| 2026-10-13 | Job CI `db` avvia solo Postgres + Auth (`-x` sugli altri servizi) | i test pgTAP non usano API/storage; job più veloce | stack completo |
| 2026-10-13 | Font: Inter variable subset latin (woff2 + OFL in `src/app/fonts/`) | self-hosted, copre l'italiano, sostituibile in fase design | pacchetto `geist`, font di sistema |
| 2026-10-13 | `CLAUDE.md` = `@AGENTS.md` anche in `src/`, `supabase/`, `engine/` | Claude Code carica in automatico solo i CLAUDE.md annidati (WORKFLOW §2) | solo AGENTS.md |
| 2026-10-13 | `.gitattributes` con `eol=lf`; mappa senza timestamp | `ai:check` deterministico tra Windows e CI Linux | normalizzare solo nello script |
| 2026-10-13 | Email autore git = noreply GitHub (config locale del repo) | repo pubblico: niente email personali nei commit | email personale |

## Candidati Skill (creare dopo 2 esecuzioni manuali)
| Candidato | Trigger | Input | Output | Esecuzioni manuali |
|---|---|---|---|---|
| /migrazione | nuova tabella o RPC | nome, colonne, policy | migrazione numerata + test pgTAP + rigenerazione tipi | 0 |
| /azione | nuova Server Action di scrittura | tabella/RPC, schema | action con Zod + rate limit + checkContent + test | 0 |
