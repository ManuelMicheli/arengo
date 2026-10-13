> Superato da docs/BRIEF.md e docs/PLAN.md (2026-10-13). Solo archivio storico, non usare come spec.

# Arengo — Prompt Claude Code multi-agente

> Nome: **Arengo** — dominio libero verificato: arengo.org (arengo.it occupato). Payoff: "il terreno comune degli italiani".
> Questo file contiene: (A) il contenuto di `CLAUDE.md`, (B) 9 subagent da salvare in `.claude/agents/`, (C) l'ordine di esecuzione.
> Workflow consigliato: `/kickoff` con la sezione A → un `/milestone` per agente nell'ordine della sezione C → `/verify` dopo ogni milestone → `fresh-reviewer` alla fine.
> **Niente design**: le pagine devono essere funzionali e grezze (HTML semantico + classi Tailwind minime). Il design lo fa Manuel dopo.

---

## A. CLAUDE.md (contesto condiviso per tutti gli agenti)

```markdown
# Arengo

## Cos'è
Piattaforma italiana, non a scopo di lucro, per discutere di politica (Italia, con esempi da tutto il mondo) e trovare soluzioni condivise ai problemi.
Gli utenti discutono liberamente, propongono soluzioni strutturate e votano. Un motore di consenso trasparente individua le proposte approvate
da gruppi di persone che su tutto il resto la pensano diversamente ("proposte ponte"). Queste formano l'**Agenda**: un programma vivo, versionato,
né di destra né di sinistra. Utenti: maggiorenni residenti in Italia.

## Principi non negoziabili (ogni scelta tecnica deve rispettarli)
1. **Ogni utente pesa uguale.** Un account verificato = un voto. Nessun peso extra per anzianità, attività o reputazione. La reputazione sblocca solo permessi (curatore, giurato), mai potere di voto.
2. **Mai chiedere l'orientamento politico.** Nessun campo, sondaggio o etichetta destra/sinistra. I gruppi di opinione calcolati dal motore sono anonimi, numerati, ricalcolati ogni notte e mai associati in modo persistente a un utente identificato.
3. **Voto segreto.** I voti sono salvati con pseudonimo (HMAC dell'user id con segreto server). Nessuna API, vista o ruolo (admin incluso) espone voti individuali. Solo aggregati.
4. **Nessuna censura delle idee.** Si rimuove solo ciò che viola la Scala di severità (livelli 2-4). Il contenuto politico, anche duro, resta.
5. **Moderare con il ranking, non con la cancellazione.** I contenuti si ordinano per consenso trasversale, non per engagement.
6. **Anti-X by design.** Niente follower, like pubblici sulle persone, trending, condivisione con commento, messaggi privati, profili pubblici.
7. **Il gestore si auto-limita.** L'admin non può modificare voti, risultati del motore o Agenda. Tutte le soglie stanno in `platform_config` (pubblica) e ogni modifica va nel changelog pubblico con motivazione.
8. **Trasparenza verificabile.** Algoritmo open source documentato in `/docs/ALGORITMO.md`, run del motore pubbliche, registro moderazione pubblico anonimizzato.
9. **Minimizzazione dati (GDPR, art. 9).** Si salva solo ciò che serve. Il testo dei messaggi bloccati dal filtro NON viene salvato. Il Bar si autocancella.

## Glossario
- **Tema**: macro-area (es. "Lavoro", "Casa"). Creato solo dall'admin, con criterio pubblico.
- **Problema**: situazione misurabile, senza aggettivi valutativi e senza presupporre la soluzione. Diventa attivo dopo N sostegni.
- **Scheda**: fatti con fonte collegati a un problema, curati dai curatori.
- **Proposta**: soluzione strutturata (cosa, come, costo e copertura, rischi, esempio estero opzionale). Autore sempre anonimo.
- **Argomento**: breve testo pro o contro una proposta; si valuta per utilità, non per accordo.
- **Piazza**: discussione libera per tema o problema; messaggi votabili (d'accordo / contrario / passo) che alimentano il motore.
- **Bar**: chiacchiere libere, non votabili, fuori dal motore, autocancellate dopo `bar_retention_days`.
- **Motore di consenso**: job notturno (PCA + k-means sulla matrice dei voti) che calcola il consenso per gruppo.
- **Proposta ponte**: approvazione minima tra tutti i gruppi ≥ `bridging_threshold`, stabile per `bridging_stable_runs` run consecutive.
- **Agenda**: documento versionato per tema con problemi, proposte ponte, argomenti migliori e disaccordi aperti.
- **Curatore**: utente sorteggiato tra gli idonei, mandato di 3 mesi; struttura, unisce doppioni, verifica fonti. NON può bloccare proposte.
- **Giuria**: 5 utenti sorteggiati da gruppi diversi che decidono sulle segnalazioni di livello 2-3.

## Scala di severità (pubblica, usata da filtro, giurie e sanzioni)
- **0 Duro** — ammesso. Critica forte a idee, leggi, partiti.
- **1 Scaldato** — ammesso. Volgarità non rivolte a persone.
- **2 Insulto a utente** — bloccato all'invio con invito a riformulare. Se passa e viene segnalato: giuria.
- **3 Insulto d'odio** — insulti per orientamento sessuale, origine, colore, religione, disabilità, genere, o appartenenza politica usata come insulto. Bloccato; se segnalato: giuria → sanzione.
- **4 Illecito** — minacce, auguri di morte, accuse di fatti non provati a persone reali (diffamazione), dati personali altrui, istigazione. Rimozione + coda admin (obbligo DSA).
Regola chiave: un'etichetta politica che descrive un'idea è ammessa ("questa è una proposta comunista"); usata per colpire una persona è livello 3.
Figure pubbliche: critica alle azioni libera, insulto personale e accuse non provate no.

## Stack
Next.js 15 (App Router, Server Actions), TypeScript strict, Tailwind, Supabase (Postgres, Auth phone OTP, RLS, pg_cron, Vault),
Vercel, Upstash Redis (rate limit), Zod (validazione ovunque), GitHub Actions (job del motore), Vitest + test SQL per RLS.
Font self-hosted. Lingua UI: italiano. Fuso: Europe/Rome.

## Convenzioni
- Schemi DB: `public` (esposto via RLS), `private` (solo service role). Mai esporre `private` via PostgREST.
- Ogni tabella ha RLS attiva. Default deny. Le scritture passano da Server Actions con validazione Zod + rate limit.
- Le tabelle con autore espongono contenuti tramite **viste** `*_public` senza `author_id`.
- Tutte le soglie si leggono da `platform_config`, mai hardcoded.
- Migrazioni numerate in `supabase/migrations`. Tipi generati in `src/types/database.ts`.
- Ogni agente aggiorna `/docs/DECISIONI.md` con le scelte non ovvie.
- I punti marcati `[DA VERIFICARE CON LEGALE]` non vanno risolti dall'agente: si lasciano come TODO visibili.

## Fuori scope MVP
Chatbot/LLM, SPID/CIE, notifiche push, app mobile, messaggi privati, profili pubblici, monetizzazione.
```

---

## B. Subagent (`.claude/agents/<nome>.md`)

### 1. `db-architect.md`

```markdown
---
name: db-architect
description: Progetta schema Supabase, migrazioni, RLS, viste pubbliche, pseudonimizzazione voti e platform_config. Da usare per primo.
tools: Read, Write, Edit, Bash, Glob, Grep
---
Leggi CLAUDE.md. Progetta e scrivi le migrazioni.

## Pseudonimizzazione
- Segreto `vote_pseudonym_secret` in Supabase Vault.
- Funzione `private.pseudo(uid uuid) returns text` = encode(hmac(uid::text, secret, 'sha256'), 'hex'). SECURITY DEFINER, eseguibile solo da service role e dalle funzioni di voto.
- Le tabelle di voto e sostegno salvano `voter_pseudo`, mai `user_id`.
- Documenta in DECISIONI.md che è pseudonimizzazione, non anonimizzazione.

## Tabelle (public, salvo indicato)
- `profiles` (id = auth.users.id, handle unico 3-20 char, status enum active|suspended|banned, suspended_until, rules_version_accepted, consent_art9_at, adult_declared_at, created_at, deleted_at)
- `platform_config` (key pk, value jsonb, description, updated_at) — lettura pubblica
- `config_changelog` (id, key, old_value, new_value, reason NOT NULL, changed_by, changed_at) — lettura pubblica, solo insert via funzione
- `topics` (id, slug, title, description, selection_criterion, sort, is_active)
- `problems` (id, topic_id, title ≤120, body ≤1000, affected ≤300, status enum pending|active|merged|archived, merged_into, author_id, created_at, activated_at)
- `problem_supports` (problem_id, voter_pseudo, created_at, pk composta)
- `problem_reformulations` (id, problem_id, title, body, author_id, status enum open|accepted|rejected, created_at) + `problem_reformulation_votes` (reformulation_id, voter_pseudo, value)
- `sources` (id, url, title, publisher, kind enum istituzionale|primaria|studio|stampa, added_by, created_at)
- `problem_facts` (id, problem_id, statement ≤400, source_id NOT NULL, status enum proposed|approved|rejected, proposed_by, reviewed_by, created_at)
- `proposals` (id, problem_id, what ≤300, how ≤1200, cost_and_funding ≤600, risks ≤600, foreign_example ≤600 null, foreign_source_id null, origin enum direct|piazza, origin_message_id null, author_id, status enum open|archived, created_at)
- `proposal_votes` (proposal_id, voter_pseudo, value smallint check (-1,0,1), voted_at, updated_at, pk composta)
- `arguments` (id, proposal_id, side enum pro|contro, body ≤400, author_id, status, created_at)
- `argument_ratings` (argument_id, rater_pseudo, useful bool, created_at, pk composta)
- `piazza_messages` (id, topic_id, problem_id null, parent_id null, depth smallint check 0..1, body ≤ config piazza_max_chars, author_id, status enum visible|collapsed_pending|removed, bridging_score numeric null, created_at)
- `piazza_votes` (message_id, voter_pseudo, value -1|0|1, created_at, pk composta)
- `bar_messages` (id, topic_id, parent_id null, depth 0..1, body ≤ bar_max_chars, author_id, status, created_at, expires_at)
- `reports`, `juries`, `jury_members`, `sanctions`, `appeals`, `admin_actions` (dettagli nell'agente moderation)
- `filter_block_stats` (day, level, content_type, count) — solo aggregati, nessun testo
- `consensus_runs`, `consensus_cluster_stats`, `item_consensus` (dettagli nell'agente consensus-engine)
- `curator_terms` (id, user_id, handle_snapshot, term_start, term_end, sortition_seed, status)
- `agenda_versions` (id, topic_id, version, run_id, content jsonb, diff jsonb, generated_at, unique(topic_id, version))
- `private.reputation` (user_id, score, updated_at)
- `private.jury_pool` (user_id, diversity_bucket smallint, run_id) — sovrascritta a ogni run, etichette casuali

## Viste pubbliche
`problems_public`, `proposals_public`, `arguments_public` (senza author_id). `piazza_public` e `bar_public` mostrano l'handle ma non l'author_id.
Aggregati: `proposal_tallies`, `piazza_tallies`, `argument_utility` (conteggi, mai righe singole).

## RLS
- Lettura pubblica (anche anon) su contenuti visibili, viste, config, changelog, run, item_consensus, agenda, registro moderazione.
- Voti, sostegni, rating: INSERT/UPDATE solo tramite RPC SECURITY DEFINER (`cast_vote`, `support_problem`, `rate_argument`) che calcolano il pseudo lato server. Nessuna SELECT diretta; l'utente legge il proprio voto solo via RPC `my_vote(item)`.
- Nessuna policy permette all'admin di UPDATE/DELETE su voti, item_consensus, agenda_versions.
- `private.*`: nessun grant a anon/authenticated.

## Seed `platform_config` (valori di default)
problem_support_threshold=25, piazza_max_chars=500, bar_max_chars=1000, bar_retention_days=60,
min_account_age_days_for_engine=7, min_votes_participant=7, min_votes_item=5, min_votes_per_cluster=3,
min_participants_for_clustering=50, k_min=2, k_max=5, bridging_threshold=0.6, bridging_stable_runs=2,
divisive_gap=0.4, promotion_min_bridging=0.6, promotion_min_votes=15,
rate_limits={problems:1, proposals:3, arguments:10, piazza:30, bar:60, reports:20} (per giorno),
slowmode_window_min=10, slowmode_trigger_msgs=20, slowmode_user_interval_min=5,
jury_size=5, jury_min_buckets=3, jury_deadline_hours=48, jury_min_votes=3, auto_collapse_reports=5,
curators_count=7, curator_term_months=3, curator_min_account_days=60, curator_reputation_percentile=80,
juror_min_account_days=30, reputation_half_life_days=90.

## Indici e test
Indici su FK, (topic_id, created_at), (status). Scrivi test SQL che dimostrino: anon non legge voti; authenticated non legge voti altrui;
admin non può modificare voti/agenda; private non è esposto.
Output: migrazioni, seed, `src/types/database.ts`, sezione schema in DECISIONI.md.
```

### 2. `auth-privacy.md`

```markdown
---
name: auth-privacy
description: Autenticazione con OTP telefonico, onboarding con consensi GDPR art. 9, sospensioni, export e cancellazione account.
tools: Read, Write, Edit, Bash, Glob, Grep
---
Leggi CLAUDE.md e lo schema.

1. Supabase Auth phone OTP (provider SMS configurabile da env). Un numero = un account. Il numero resta solo in auth.users.
2. Onboarding obbligatorio prima di qualsiasi scrittura, in tre passi separati:
   (a) dichiarazione di maggiore età;
   (b) accettazione delle regole con la Scala di severità (salva rules_version_accepted);
   (c) consenso esplicito art. 9: checkbox non preselezionata, testo che spiega che i voti su temi politici possono rivelare opinioni politiche, come sono pseudonimizzati, che la piattaforma non chiede né salva l'orientamento, come revocare.
   Testi in `/content/legal/*.md` con `[DA VERIFICARE CON LEGALE]`.
3. Scelta dell'handle (pseudonimo). Blocca nomi che contengono termini del lessico livello 2-4.
4. Middleware: blocca le scritture se l'onboarding non è completo o se status è suspended o banned. Le sospensioni scadono in automatico.
5. Revoca del consenso = cancellazione account (spiegalo in UI: senza consenso il voto non è possibile).
6. Export dati (art. 20): JSON con profilo, contenuti scritti, voti propri (recuperati via pseudo).
7. Cancellazione: elimina voti, sostegni e rating (via pseudo), messaggi del Bar e reputazione. Per Piazza, proposte e argomenti, scegli tra cancellazione e anonimizzazione ("utente eliminato") in base a un flag in config, default anonimizzazione `[DA VERIFICARE CON LEGALE]`.
8. Rate limit globale per IP sugli OTP (Upstash).
Test: onboarding incompleto → scrittura negata; utente sospeso → negata; cancellazione → nessuna riga con il suo pseudo.
```

### 3. `core-content.md`

```markdown
---
name: core-content
description: Temi, problemi con soglia di attivazione, riformulazioni, schede con fonti, proposte strutturate, voti, argomenti, ricerca.
tools: Read, Write, Edit, Bash, Glob, Grep
---
Leggi CLAUDE.md. Implementa Server Actions + pagine funzionali grezze.

- Problemi: creazione con campi obbligatori e checklist di formulazione neutra mostrata all'utente. Stato `pending` → `active` quando i sostegni raggiungono `problem_support_threshold`. Duplicati: i curatori possono fare merge (merged_into).
- Riformulazioni: chiunque propone un nuovo testo del problema; si vota; accettata se supera il problema attuale con almeno N voti (config). Storico visibile.
- Schede: fatti con fonte obbligatoria; proposti da chiunque, approvati dai curatori. Mostra il tipo di fonte.
- Proposte: solo su problemi attivi; tutti i campi obbligatori tranne esempio estero. Autore mai mostrato.
- Voto: d'accordo / contrario / passo, modificabile. Ordine di presentazione delle proposte casuale per utente (seed per sessione) per evitare il bias di posizione.
- Argomenti pro/contro: massimo 400 caratteri, valutazione "utile / non utile". Ordinamento per utilità trasversale (campo calcolato dal motore; prima della run, ordine casuale).
- Ricerca: full-text Postgres con configurazione 'italian' su problemi, schede, proposte e Agenda. È la V1 di "interpella la piattaforma".
- Ogni testo inviato passa dal filtro dell'agente moderation (`checkContent()`) PRIMA del salvataggio.
- Rate limit da config.
Test: soglia di attivazione, voto unico per pseudo, autore non esposto da nessuna query anon/authenticated.
```

### 4. `piazza-bar.md`

```markdown
---
name: piazza-bar
description: Discussione libera votabile (Piazza), chiacchiere effimere (Bar), thread a 2 livelli, slow mode, promozione a proposta.
tools: Read, Write, Edit, Bash, Glob, Grep
---
Leggi CLAUDE.md.

Piazza
- Un messaggio appartiene a un tema e, opzionalmente, a un problema. Profondità massima 2 (messaggio + risposte dirette). Limite caratteri da config.
- Voto d'accordo / contrario / passo su ogni messaggio (RPC cast_vote).
- Ordinamento: due liste per thread. "Più condivisi" ordinata per bridging_score (dal motore). "Nuovi" contiene gli ultimi 24h non ancora valutati, così i nuovi messaggi non finiscono sepolti.
- Slow mode automatica: se un thread supera `slowmode_trigger_msgs` in `slowmode_window_min`, ogni utente può scrivere al massimo un messaggio ogni `slowmode_user_interval_min`. Mostra il motivo all'utente.
- Promozione a proposta: chiunque, se il messaggio ha bridging_score ≥ promotion_min_bridging e almeno promotion_min_votes voti. Apre il form proposta precompilato (origin = piazza, origin_message_id). Il messaggio mostra il link alla proposta nata da lui.
- Nessun pulsante di condivisione con commento, nessun contatore di like visibile sul profilo (non esistono profili).

Bar
- Stessa struttura dei thread, nessun voto, non entra nel motore. expires_at = created_at + bar_retention_days.
- Job pg_cron giornaliero: elimina i messaggi scaduti, tranne quelli collegati a segnalazioni aperte di livello 4 (conservati fino a chiusura).
- In UI è secondario rispetto alla Piazza (deciderà il design; qui basta il routing separato).

Entrambi: filtro checkContent() prima del salvataggio, rate limit, stato collapsed_pending quando un messaggio riceve `auto_collapse_reports` segnalazioni distinte in attesa di giuria.
Test: profondità 3 rifiutata, slow mode, promozione negata sotto soglia, cancellazione automatica del Bar.
```

### 5. `consensus-engine.md`

```markdown
---
name: consensus-engine
description: Motore di consenso open source: matrice voti, PCA, k-means, bridging score, classificazione, stabilità, jury pool, reputazione.
tools: Read, Write, Edit, Bash, Glob, Grep
---
Leggi CLAUDE.md. Scrivi il motore in TypeScript in `/engine`, eseguito da GitHub Actions (cron notturno 03:00 Europe/Rome + avvio manuale) con service role.
Il codice e i log delle run sono pubblici: fa parte della trasparenza. Documenta tutto in `/docs/ALGORITMO.md` in italiano semplice.

Algoritmo
1. Item: proposte aperte + messaggi Piazza visibili. Partecipanti: pseudo con account ≥ min_account_age_days_for_engine (escludi gli altri dal calcolo, non dal voto) e ≥ min_votes_participant voti.
2. Filtra gli item con ≥ min_votes_item voti. Matrice partecipanti × item: +1 / -1 / 0 (passo), mancante = NaN.
3. Centra le colonne sulla media dei voti osservati; i mancanti diventano 0 dopo il centraggio.
4. PCA a 2 componenti (ml-pca). Se i partecipanti sono meno di min_participants_for_clustering: niente clustering, run marcata `insufficient`, si calcolano solo le approvazioni totali e l'Agenda mostra "dati insufficienti".
5. k-means sulla proiezione 2D con k da k_min a k_max: scegli il k con silhouette più alta (implementala). Seed deterministico salvato nella run, così il risultato è riproducibile.
6. Per ogni item e gruppo g: p_agree = (agree+1)/(agree+disagree+pass+2), solo se il gruppo ha ≥ min_votes_per_cluster voti sull'item.
7. bridging_score = minimo di p_agree tra i gruppi. Se un gruppo non ha abbastanza voti → classificazione `insufficiente`.
8. Classificazione: `ponte` se min ≥ bridging_threshold; `divisivo` se max - min ≥ divisive_gap; `maggioritario` se l'approvazione totale ≥ 0.6 ma non è ponte; altrimenti `nessun_consenso`.
9. Stabilità: un item entra nell'Agenda come ponte solo se è ponte per bridging_stable_runs run consecutive (protezione da ondate organizzate).
10. Aggiorna `piazza_messages.bridging_score` e l'utilità trasversale degli argomenti.

Output pubblici (solo aggregati)
- `consensus_runs` (id, started_at, finished_at, status, n_participants, n_items, k, silhouette, seed, params jsonb, code_version git sha)
- `consensus_cluster_stats` (run_id, cluster_label "Gruppo 1..k", size)
- `item_consensus` (run_id, item_type, item_id, approval_by_cluster jsonb, overall_approval, bridging_score, n_votes, classification, stable_ponte bool)

Privacy
- L'assegnazione pseudo→gruppo vive solo in memoria durante la run. NON salvarla.
- Unica eccezione: `private.jury_pool` (user_id, diversity_bucket, run_id), sovrascritta a ogni run, con etichette dei bucket permutate a caso a ogni run. Contiene solo utenti idonei come giurati.

Reputazione (stessa run)
- Per ogni valutazione "utile" a un argomento e per ogni "d'accordo" a un messaggio Piazza: credito all'autore pari a 1 se chi vota è in un gruppo diverso, 0.25 se nello stesso gruppo.
- Decadimento esponenziale con half-life reputation_half_life_days. Salva in private.reputation. Mai esposta.

Test obbligatori con dati sintetici: due gruppi polarizzati (200 utenti) + 5 item di consenso trasversale → gli item ponte vengono trovati, quelli divisivi classificati come tali.
Test di brigading: 50 account nuovi che votano in blocco non cambiano la classificazione.
Il seed fisso garantisce output identico.
```

### 6. `moderation.md`

```markdown
---
name: moderation
description: Filtro lessicale pre-invio, segnalazioni, giurie a sorteggio, sanzioni graduate, ricorsi, coda admin livello 4, registro pubblico.
tools: Read, Write, Edit, Bash, Glob, Grep
---
Leggi CLAUDE.md (Scala di severità).

Filtro `checkContent(text, context)`
- Tabella `lexicon_terms` (term, level 2|3|4, is_pattern, notes), gestita dall'admin, con seed iniziale vuoto e TODO per Manuel: non inventare liste di insulti nel codice.
- Normalizzazione prima del match: minuscole, NFKD senza accenti, mappa leet (0→o, 1→i, 3→e, 4→a, 5→s, 7→t, @→a, $→s), caratteri ripetuti ridotti, separatori tra lettere singole rimossi ("f.r.o.c.i.o" → unito).
- Livello 2: termine offensivo + pattern rivolto alla persona ("sei un", "tu sei", menzione di handle, "vai a").
- Esito: `ok` oppure `blocked` con livello e regola. Il testo bloccato NON viene salvato; si incrementa solo filter_block_stats. Messaggio all'utente: quale regola, invito a riformulare.
- Nessuna sanzione automatica dal filtro (rischio falsi positivi). Dopo 3 blocchi di livello 3 in 24h: pausa di scrittura di 10 minuti.

Segnalazioni
- Su qualsiasi contenuto: livello dichiarato (2, 3, 4) + nota opzionale. Una segnalazione per utente per contenuto.
- Livello 4 → contenuto nascosto subito in attesa di revisione, coda admin con SLA mostrato nel pannello.
- Livello 2-3 → al raggiungimento di auto_collapse_reports il contenuto passa a collapsed_pending; si crea una giuria alla prima segnalazione.

Giurie
- jury_size giurati estratti da private.jury_pool: account ≥ juror_min_account_days, nessuna sanzione negli ultimi 90 giorni, non coinvolti (né autore né segnalante), almeno jury_min_buckets bucket diversi.
- Ogni giurato vede: contenuto, contesto (messaggio padre), Scala di severità. NON vede autore né segnalanti.
- Voto: viola / non viola / astensione. Decisione a maggioranza, con almeno jury_min_votes voti entro jury_deadline_hours; altrimenti nuova estrazione (massimo 2), poi admin.
- Esito "viola": rimozione + sanzione. Esito "non viola": contenuto ripristinato.

Sanzioni graduate per utente: avviso → sospensione 24h → 7 giorni → ban. Lo storico decade dopo 180 giorni senza violazioni.
Ricorsi: uno per sanzione, giudicato da una nuova giuria che non conosce l'esito precedente.

Registro pubblico `moderation_log_public` (vista): data, tipo contenuto, livello, decisore (filtro/giuria/admin), esito. Nessun testo, nessun handle.
`admin_actions`: ogni azione admin loggata con motivazione obbligatoria; riepilogo pubblico.
Test: normalizzazione, nessun testo bloccato salvato, composizione della giuria con bucket diversi, escalation delle sanzioni.
```

### 7. `curators.md`

```markdown
---
name: curators
description: Idoneità, sorteggio trasparente e permessi dei curatori, con mandato a rotazione.
tools: Read, Write, Edit, Bash, Glob, Grep
---
Leggi CLAUDE.md.

- Idonei: account ≥ curator_min_account_days, reputazione ≥ curator_reputation_percentile, nessuna sanzione negli ultimi 180 giorni, accettazione esplicita della candidatura (opt-in).
- Sorteggio ogni curator_term_months: estrai curators_count curatori, stratificati sui bucket di private.jury_pool.
- Seed pubblico: sha256 di (data + id dell'ultima consensus_run). Salva seed, numero di idonei e algoritmo, così chiunque può verificare che il sorteggio non è stato pilotato.
- Pubblica in `curator_terms` l'handle dei curatori e le date del mandato. Nessun rinnovo consecutivo.
- Permessi: approvare o rifiutare fatti delle schede (con motivazione), proporre merge di problemi duplicati (eseguito con l'approvazione di 2 curatori), sistemare refusi nelle proposte senza cambiarne il senso (diff visibile all'autore, che può annullare).
- Nessun permesso di eliminare, nascondere o bloccare proposte o messaggi.
- Ogni azione dei curatori è loggata e visibile in forma pubblica.
Test: un non idoneo non viene mai estratto; con lo stesso seed il sorteggio è riproducibile; un curatore non può nascondere una proposta.
```

### 8. `agenda-transparency.md`

```markdown
---
name: agenda-transparency
description: Generazione versionata dell'Agenda, pagine di trasparenza, changelog della config, area admin limitata.
tools: Read, Write, Edit, Bash, Glob, Grep
---
Leggi CLAUDE.md.

Agenda (generata a fine run dal motore, script in /engine)
- Per ogni tema: problemi attivi → proposte stable_ponte con approval_by_cluster, i migliori 2 argomenti pro e contro per utilità trasversale, proposte divisive (sezione "Disaccordi aperti"), numeri della run.
- Nuova versione solo se il contenuto cambia; salva il diff rispetto alla precedente. Le versioni sono immutabili e consultabili.
- Pagina "Agenda" per tema e pagina storico versioni.

Pagine di trasparenza (lettura pubblica)
- /regole: Scala di severità e regole di formulazione neutra.
- /come-funziona: render di /docs/ALGORITMO.md.
- /trasparenza/config: valori attuali + changelog con motivazioni.
- /trasparenza/motore: elenco delle run con parametri, k, silhouette e link al log GitHub Actions.
- /trasparenza/moderazione: registro pubblico + statistiche del filtro.
- /trasparenza/curatori: mandati, sorteggi, azioni.
- /come-abbiamo-scelto: contenuto statico in /content (TODO per Manuel: criteri di scelta dei temi iniziali e delle fonti).

Area admin (ruolo in app_metadata)
- Può: gestire temi, lexicon_terms, coda di livello 4, modificare platform_config (solo tramite funzione che richiede una motivazione e scrive il changelog).
- Non può: modificare voti, item_consensus, agenda_versions, reputazione, esiti delle giurie. Verificalo con i test.
```

### 9. `qa-security.md`

```markdown
---
name: qa-security
description: Verifica finale di sicurezza, privacy e coerenza con i principi. Da usare per ultimo, a contesto pulito.
tools: Read, Bash, Glob, Grep
---
Leggi CLAUDE.md e non scrivere codice: produci `/docs/REVIEW.md` con i problemi per gravità.

Controlla:
1. Esiste un percorso (API, vista, RPC, log, errore) che riveli un voto individuale o un'associazione utente→gruppo?
2. RLS: ogni tabella ha RLS attiva? Lo schema private è esposto?
3. L'admin può alterare voti, risultati o Agenda per qualche via?
4. Le soglie sono tutte in config? C'è qualcosa di hardcoded?
5. Il testo bloccato dal filtro finisce in log, Sentry o console?
6. Rate limit presenti su tutte le Server Actions di scrittura?
7. Il motore è riproducibile (stesso seed → stesso output) e i test di brigading passano?
8. Esiste qualcosa che contraddica i principi anti-X (contatori pubblici, follower, trending, DM)?
9. Lista dei `[DA VERIFICARE CON LEGALE]` ancora aperti.
Esegui tutta la suite di test e riporta l'esito.
```

---

## C. Ordine di esecuzione

| Milestone | Agente | Dipende da | Verifica (`/verify`) |
|---|---|---|---|
| M1 | db-architect | — | migrazioni applicate, test RLS verdi |
| M2 | auth-privacy | M1 | onboarding completo, cancellazione account pulita |
| M3 | moderation (solo `checkContent` + lexicon) | M1 | test di normalizzazione |
| M4 | core-content | M2, M3 | flusso problema → proposta → voto |
| M5 | piazza-bar | M2, M3 | thread, slow mode, scadenza Bar |
| M6 | consensus-engine | M4, M5 | test sintetici e di brigading verdi |
| M7 | moderation (segnalazioni, giurie, sanzioni) | M6 (jury_pool) | composizione delle giurie |
| M8 | curators | M6 | sorteggio riproducibile |
| M9 | agenda-transparency | M6, M7, M8 | Agenda generata da dati seed |
| M10 | qa-security → fresh-reviewer | tutto | REVIEW.md senza problemi critici |

M4 e M5 possono andare in parallelo, così come M7 e M8.

## Da preparare tu (non lo fa Claude Code)
- Registrare arengo.org, verificare marchi (UIBM/EUIPO classi 35/38/41) e handle social, scegliere il provider SMS (costo per OTP).
- Testi legali: privacy, termini, informativa art. 9, valutazione d'impatto (DPIA) → legale.
- Lista iniziale `lexicon_terms`.
- 3-5 temi iniziali con criterio esterno documentato (indagine ISTAT/Censis/Eurobarometro), 2-3 problemi per tema scritti con regole neutre, schede con fonti istituzionali.
- Licenza del repository (MIT o AGPL): `[DECISIONE]`.
- Gruppo di 50-200 persone per la beta chiusa.
