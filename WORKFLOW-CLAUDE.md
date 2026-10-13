# Workflow Claude: massima efficienza, minimo token

Documento riutilizzabile per ogni progetto. Nato in I-Events (monorepo Next.js + Expo + Supabase). Copialo nel nuovo progetto, oppure incolla in chat: *"Leggi WORKFLOW-CLAUDE.md e applicalo a questo progetto"*.

**Principio:** il costo di una sessione è quasi tutto *lettura*. Si risparmia facendo leggere pochi file giusti, non facendo esplorare. Precisione e risparmio non sono in conflitto: un contesto preparato bene dà più precisione, non meno.

---

## 1. Regole d'oro

1. **Non esplorare, instrada.** L'agente parte da una tabella "compito → file da leggere" e apre solo quelli.
2. **Cerca, non leggere.** Grep su una mappa del codice; Read con `offset`/`limit` sui file grandi. Mai interi: lockfile, tipi generati, CSS globale, spec e2e lunghi.
3. **Un agente = uno scopo.** Ogni sotto-cartella ha il suo contesto minimo; l'agente non esce dal suo perimetro.
4. **Il contesto sta nel repo, non nella chat.** Regole, mappa, stato e design sono file versionati: ogni sessione riparte da zero senza perdere nulla.
5. **Niente rilettura, niente ripetizione.** Non rileggere un file appena modificato (Edit/Write falliscono se non applicano). Non riassumere all'utente ciò che sa già.
6. **Verifica con strumenti, non a occhio.** Typecheck, lint, test e CI decidono se è "fatto".
7. **Rischio prima di velocità.** Azioni irreversibili o esterne (merge su main, scritture su DB di produzione, push) solo con ok esplicito.

---

## 2. Struttura del contesto (da creare in ogni progetto)

```
AGENTS.md                  # contesto di base: protocollo, regole, instradamento, comandi, trappole
CLAUDE.md                  # una riga:  @AGENTS.md   (stesso file per Claude Code e altri agenti)
<area>/AGENTS.md           # convenzioni SOLO di quell'area (web, mobile, core, db...) + CLAUDE.md = @AGENTS.md
.ai/mappa-codice.md        # GENERATA da script: file, export, rotte, tabelle (si cerca con Grep)
.ai/design.md              # sintesi del design system (sostituisce docs enormi)
.ai/stato.md               # stato lavori, backlog, cosa manca (si aggiorna a ogni fine lavoro)
.ai/brief-agente.md        # modello di brief per sotto-agenti
.claude/agents/*.md        # sotto-agenti con scope e modello fissati
.claude/skills/*/SKILL.md  # procedure ripetibili (/chiudi, /funzione, /migrazione...)
.claude/hooks/*            # automazioni eseguite dal sistema (es. rigenera la mappa dopo modifiche)
.claude/settings.json      # permessi: allow comandi sicuri, deny file pesanti
```

### AGENTS.md radice: sezioni obbligatorie
- **Protocollo token** (le regole d'oro, in forma imperativa, 5-6 punti).
- **Prodotto** in 5 righe: cosa fa, per chi, URL live, cosa è produzione.
- **Stack e struttura**: tabella percorso → cosa contiene.
- **Regole fisse** del proprietario (lingua, branch, DB, stile, cose vietate).
- **Gemelli** (se ci sono due client dello stesso prodotto): tabella funzione sito ↔ app, così il gemello si trova senza cercare.
- **Instradamento**: tabella *compito → leggi solo*. È la parte che fa risparmiare di più.
- **Comandi**: build/test/lint/map, con i trucchi della piattaforma (es. variabili d'ambiente Windows).
- **Trappole note**: errori già incontrati, una riga ciascuno.
- **"Fatto vuol dire"**: checklist di chiusura.

Obiettivo dimensione: AGENTS.md radice ≈ 8 KB, quelli di area 1-3 KB. Se cresce, sposta in `.ai/`.

### Mappa del codice
Script (`pnpm ai:map`) che genera `.ai/mappa-codice.md`: file → export principali, rotte, tabelle DB, elenco dei file grandi da non leggere interi. Un hook la rigenera dopo ogni modifica strutturale e la CI la verifica (`ai:check`). Si consulta **solo con Grep sul nome**.

---

## 3. Ciclo di una sessione

```
1. Leggi AGENTS.md (già caricato) → trova il compito in "Instradamento"
2. Grep nella mappa per localizzare funzione/componente/rotta
3. Read mirato (offset/limit) dei soli file della riga di instradamento
4. Riusa componenti/funzioni esistenti prima di crearne
5. Modifica. Logica condivisa nel pacchetto core, UI nel client
6. Verifica: check sui soli pacchetti cambiati (non tutto il repo)
7. Chiusura (/chiudi): check verde, mappa rigenerata, stato.md aggiornato
8. Risposta: cosa è cambiato, file toccati, cosa resta. Niente riassunti lunghi
```

---

## 4. Sotto-agenti e modelli

- **Esplorazione larga** ("dove si usa X?") → agente `esplora`, modello piccolo (Haiku), risposta ≤ 10 righe.
- **Codice mirato** → `dev-sito` / `dev-app` (Sonnet), ciascuno confinato alla sua cartella.
- **Core, DB, RLS, architettura, design nuovo** → sessione principale (modello grande), *prima* di lanciare i sotto-agenti.
- **Parallelo solo se indipendente**: due compiti, due agenti, file diversi. Mai lo stesso file in due agenti.
- **Brief preciso** = pochi file letti. Modello (da `.ai/brief-agente.md`):

```
COMPITO: <una frase, risultato osservabile>
LATO: sito | app | entrambi          GEMELLO DI: <file già fatto>
FILE DA TOCCARE: <percorsi esatti>
FILE DA LEGGERE (solo questi): <max 6>
RIUSA: <componenti/funzioni dalla mappa>
NON TOCCARE: <aree fuori scopo>
FATTO QUANDO: <criteri verificabili>
RISPONDI CON: file cambiati + 3 righe su cosa resta. Niente codice incollato.
```
Ogni campo vuoto = l'agente va a cercare = token sprecati.

---

## 5. Git, review e rilascio

- **Un branch per lavoro** (`claude/<tema>`), mai commit diretti su `main`.
- **Una PR per branch**, revisionata passo passo dall'utente.
- **Review automatica** (es. CodeRabbit) a ogni push: leggere i commenti sulla PR, correggere o motivare, ripushare.
- **CI come verifica** quando l'ambiente locale non basta (niente Docker/DB locale): dopo il push `gh run list --branch <b>` / `gh run watch <id>`. Prima di correggere, `pull --rebase` (altre sessioni possono aver pushato).
- **Merge su `main` solo con ok esplicito** ("ok unisci").
- **Commit**: messaggi brevi, in forma Conventional Commits, il *perché* solo se non ovvio.

---

## 6. Database e servizi esterni

- **Solo migrazioni nuove**, mai modificare quelle esistenti. Numero > max tra repo e DB online.
- Connettore al DB di produzione: **letture libere, scritture solo con ok**.
- Tipi DB generati: non a mano (o, senza strumenti locali, imitando il generatore e lasciando che la CI confermi).
- **Repo pubblico?** Zero chiavi, ref di progetto, email, dati demo nel codice. Stanno in un file fuori repo (`../materiali/PRIVATO.md`).

---

## 7. Memoria persistente (tra sessioni)

Memoria di Claude Code: un file per fatto, con frontmatter, indicizzato in `MEMORY.md`.
- **user**: chi è l'utente, lingua, preferenze.
- **feedback**: correzioni e approcci confermati (con *Why* e *How to apply*).
- **project**: decisioni e vincoli non deducibili dal codice (con date assolute).
- **reference**: link a risorse esterne.

Non salvare ciò che il repo già dice (struttura, fix, git log). Aggiorna invece di duplicare; elimina le voci sbagliate.

---

## 8. Permessi e automazioni (`.claude/settings.json`)

- **allow**: comandi sicuri e frequenti (`typecheck`, `lint`, `test`, `ai:map`, `git status/diff/log`) → niente prompt, niente giri a vuoto.
- **deny**: lockfile, `node_modules`, `.next`, `.expo`, `.turbo`, report test → l'agente non può sprecarci token.
- **Hook PostToolUse** su Edit/Write: rigenera la mappa se cambia la struttura. Ciò che deve succedere *sempre* va in un hook, non in una promessa a parole.
- **Skill** per procedure ripetute: `/chiudi` (chiusura completa), `/funzione` (nuova funzione), `/gemello` (porta una cosa sull'altro client), `/migrazione` (nuova migrazione DB).

---

## 9. Comunicazione

- Lingua dell'utente (qui: italiano) per tutto ciò che legge; codice e identificatori restano originali.
- Modalità *caveman* (frammenti, niente convenevoli) per risposte brevi; codice, commit e avvisi di sicurezza in forma normale.
- Raccomanda, non elencare: una scelta con motivo, non un menù di opzioni.
- Domande all'utente solo se la decisione è sua e non risolvibile da codice o default sensati.

---

## 10. Setup in un nuovo progetto (checklist 30 minuti)

- [ ] `AGENTS.md` radice con le sezioni del §2 + `CLAUDE.md` = `@AGENTS.md`
- [ ] `AGENTS.md` per ogni area, con solo le sue convenzioni
- [ ] Script mappa (`ai:map` + `ai:check`) e prima generazione
- [ ] `.ai/stato.md`, `.ai/design.md` (sintesi, non copia), `.ai/brief-agente.md`
- [ ] `.claude/settings.json`: allow/deny + hook mappa
- [ ] Sotto-agenti (`esplora`, uno per area) e skill (`chiudi` almeno)
- [ ] Script `check:changed` (typecheck+lint+test solo dei pacchetti toccati)
- [ ] CI: stessi controlli + `ai:check` + eventuale verifica tipi DB
- [ ] Regole di branch/merge scritte in AGENTS.md
- [ ] Prima memoria: lingua, ruolo dell'utente, regola "nessun merge senza ok"

## 11. Anti-pattern (costano token, evitali)

- Esplorare il repo "per capire" invece di seguire l'instradamento.
- Leggere file generati o enormi interi.
- Rileggere un file appena scritto "per verificare".
- Un solo agente con tutto il repo in testa invece di agenti con scope.
- Documentazione lunga duplicata (sintetizza in `.ai/`, rimanda alla sezione precisa).
- Riassunti finali lunghi di ciò che l'utente ha appena visto.
- Stato nella chat invece che in `.ai/stato.md`.
- Controlli completi del repo quando bastano i pacchetti cambiati.
