# Esperienza — Arengo

Stato: bozza da approvare (Manuel)
Ultimo aggiornamento: 2026-10-15

> Come Arengo funziona **per le persone**: ciclo delle idee, motivi per tornare, navigazione, accoglienza, schermate, tono, verifica di coerenza con i principi.
> Requisiti e soglie: `docs/BRIEF.md` e `docs/PLAN.md` (vincono loro in caso di conflitto). Principi: `AGENTS.md`. Direzione visiva: "La politica a matita", regole in `docs/DESIGN.md` (PR #6, branch `claude/design-tokens`, in attesa di approvazione); prototipo `C:\dev\arengo-design\index.html` (v3, fuori dal repo).
> Le funzioni nuove rispetto a BRIEF/PLAN sono marcate **[delta]** e raccolte in §10: non entrano nelle milestone senza ok di Manuel.
> Nei testi per l'utente, `{chiave}` è un valore letto da `platform_config`: nessun numero scritto a mano. Unica eccezione: `{tema}` è il nome del tema corrente.

---

## 1. Il patto con l'utente

Cinque promesse. Ogni scelta di questo documento si giustifica rispetto a loro; se una funzione ne rompe una, si toglie la funzione.

1. **Pesi come chiunque altro.** Un account verificato, un voto. Nessuna anzianità, reputazione o ruolo cambia il peso del voto.
2. **Nessuno vede come voti.** Si vedono solo i totali. Diciamo anche il limite: il voto è pseudonimizzato, non anonimo (vedi §8).
3. **Nessuno ti chiede da che parte stai.** I gruppi d'opinione li calcola il motore ogni notte, sono anonimi e non vengono mai associati a te.
4. **Non ti teniamo incollato.** Niente feed infinito, niente trending, niente notifiche che ti richiamano. Quando hai finito, te lo diciamo.
5. **Vedi sempre perché.** Ogni numero, classificazione, blocco o sanzione ha un "perché?" che porta alla regola pubblica che l'ha prodotto.

Payoff da tenere in testa scrivendo ogni schermata: **"il terreno comune degli italiani"**. Arengo non è dove si vince una discussione, è dove si scopre su cosa si è già d'accordo.

---

## 2. Il ciclo di un'idea

È la spina dorsale del prodotto e del sistema visivo (matita → evidenziatore → penna). Ogni oggetto mostra **in che stato è** e **cosa gli serve per avanzare**, sempre con la stessa forma: stato + prossimo passo + quanto manca.

```
Problema in raccolta ──{problem_support_threshold} sostegni──▶ Problema attivo
        │                                                          │
        └─ riformulazioni (vince il testo più votato,              ├─ Schede: fatti con fonte (curatori)
           con almeno {reformulation_min_votes} voti)              │
                                                                   ▼
Piazza (vivaio) ──messaggio condiviso da gruppi diversi──▶ Proposta  (A MATITA)
                  ({promotion_min_bridging}, {promotion_min_votes})   │  voti d'accordo/contrario/passo
                                                                      │  argomenti pro/contro, "utile"
                                                       run notturna   ▼
                                     ponte in una run ──────────▶ EVIDENZIATA
                                     ponte per {bridging_stable_runs} run di fila ──▶ A PENNA
                                                                                     │
                                                                                     ▼
                                                                         Agenda del tema, versione N
```

| Oggetto | Stato visibile | Prossimo passo mostrato | Linguaggio visivo |
|---|---|---|---|
| Problema in raccolta | "In raccolta" | "Ne mancano X" (o "meno di {min_votes_item} sostegni" sotto soglia) | tally alla lavagna |
| Problema attivo | "Aperto alle proposte" | "Proponi una soluzione" / "Leggi le N proposte" | matita |
| Proposta nuova | "A matita" | "Servono voti da persone diverse" | corsivo a matita |
| Proposta valutata, nessun consenso | "A matita · nessun consenso" | i migliori argomenti contro: cosa la blocca | matita |
| Proposta divisiva | "Divide" | "Leggi perché i gruppi la vedono in modo opposto" | evidenziatori con barre lontane |
| Proposta maggioritaria | "Piace ai più" | "Piace in totale, ma non a tutti i gruppi" | un solo evidenziatore pieno |
| Proposta ponte (1 run) | "Evidenziata" | "Se regge altre N notti passa a penna" | tutti gli evidenziatori sopra soglia |
| Proposta ponte stabile | "A penna" | "Nell'Agenda {tema}, versione N" | tondo nero, timbro |
| Insufficiente | "Pochi voti per dirlo" | "Mancano voti da gruppi diversi" | grafite chiara (HB) |

Regole del ciclo:
- **Maggioritario non è ponte.** La differenza va resa evidente: "piace al 70% ma un gruppo è al 30%" non entra in Agenda. È la lezione centrale di Arengo e deve vedersi senza leggere `/come-funziona`.
- **"Divide" non è una sconfitta.** I disaccordi aperti stanno nell'Agenda come sezione propria: sono la mappa di dove serve lavoro.
- **Piazza come vivaio.** Un messaggio Piazza che raccoglie consenso trasversale si offre come proposta: il form arriva precompilato e il messaggio linka la proposta nata da lui ("da qui è nata una proposta").
- **Bar come sfogo.** Fuori dal motore, si autocancella dopo {bar_retention_days} giorni. Serve a non sporcare la Piazza, va detto in modo esplicito e simpatico ("qui si chiacchiera, niente conta, tutto sparisce").

---

## 3. Perché tornare (senza engagement tossico)

Le piattaforme premium trattengono con ritmo, progressi visibili e cura del dettaglio, non con la dipendenza. Ogni ispirazione è adattata ai principi; accanto c'è cosa **non** prendiamo.

### 3.1 Il rito della notte — *Wordle, BeReal*
Un solo evento al giorno, uguale per tutti: la run delle 03:00. Al mattino la home diventa **Stanotte**: cosa è passato a penna, cosa si è evidenziato, dove il disaccordo si è stretto o allargato, quali Agende hanno una nuova versione. Finisce in una schermata. **[delta: pagina Stanotte]**
Non prendiamo: countdown ansiosi, "non perderti".

### 3.2 Il mazzo del giorno — *Duolingo (lezione finita), Tinder (una carta alla volta)*
"Vota" è una pila di N proposte (`daily_deck_size` **[delta]**) dai temi che segui, in ordine casuale per utente (già previsto in 4.3). Una carta alla volta, tre caselle. Quando la pila finisce: "Per oggi hai finito." con il riepilogo e l'invito a tornare domani, non un'altra pila.
- Il mazzo dà precedenza alle proposte con **meno voti** (come Polis): servono a raggiungere {min_votes_item} e a entrare nel calcolo. Non è ranking per engagement, è copertura.
- `daily_deck_size` ≥ {min_votes_participant}: chi finisce il primo mazzo ha già votato abbastanza per contare nel motore (dopo {min_account_age_days_for_engine} giorni di anzianità, da dire onestamente).
- Chi vuole continuare può farlo da tema/problema: il mazzo finisce, la piattaforma no.
Non prendiamo: streak punitive, cuori persi, "hai perso la serie".

### 3.3 Il risultato dopo il voto — *Community Notes*
Nel mazzo le barre per gruppo di una proposta si vedono **dopo** aver votato (o scelto "passo"). Riduce l'effetto gregge e trasforma ogni voto in una piccola scoperta: "i gruppi qui sono più vicini di quanto pensassi". Fuori dal mazzo (pagina proposta, Agenda) i risultati sono sempre visibili: è trasparenza, non un premio.

### 3.4 Il tuo segno nel risultato — *Strava, Spotify Wrapped (ma privato)*
Nel Quaderno: "Questa settimana hai votato 23 proposte. 3 sono passate a penna." Calcolato al volo per te (via pseudo, come l'export), mai salvato in chiaro, mai condiviso. **[delta: riepilogo Quaderno]**
Non prendiamo: card da condividere sui social con il tuo voto, classifiche.

### 3.5 La curiosità del disaccordo — *Polis, vTaiwan*
Le proposte "Divide" sono la porta d'ingresso più interessante: mostrano il miglior argomento di ciascun lato, ordinati per utilità trasversale. Microcopy: "Su questa i gruppi sono lontani. Ecco l'argomento che ha convinto di più chi la pensa diversamente." Curiosità senza rissa: niente nomi, niente risposte dirette, solo argomenti valutati per utilità.

### 3.6 Progressione di ruolo, non di potere — *Wikipedia, Stack Overflow*
Partecipare con argomenti utili a chi la pensa diversamente fa crescere la reputazione, che sblocca **compiti** (giurato, candidatura a curatore), mai peso del voto. In UI solo traguardi e percentili ("puoi candidarti come curatore"), mai punteggio grezzo, mai badge pubblici.

### 3.7 La campana — *l'Arengo medievale*
La campana convocava l'assemblea. In Arengo è l'unico punto di notifica **in-app** (le push sono fuori scope v1): cose che ti riguardano davvero, in ordine di importanza:
1. Sei stato estratto per una giuria (con scadenza).
2. Una sanzione, l'esito di un ricorso, una correzione di un curatore a una tua proposta.
3. Un tuo problema si è attivato; una tua proposta è evidenziata o a penna.
4. Nuova versione dell'Agenda di un tema che segui.
Niente "X ha risposto al tuo messaggio" come leva di ritorno compulsivo: le risposte si vedono nel thread.

### Vietato in ogni caso
Streak, contatori o like sulle persone, trending, "N persone stanno guardando", ordinamento per engagement, condivisione con commento, profili pubblici, messaggi privati, dark pattern sui consensi.

---

## 4. Architettura e navigazione

### 4.1 Quattro luoghi fissi
Tab bar su mobile, barra superiore su desktop. Nient'altro a livello principale.

| Tab | Domanda a cui risponde | Contenuto |
|---|---|---|
| **Vota** | "Cosa posso fare adesso in 5 minuti?" | Stanotte (al mattino) + mazzo del giorno |
| **Piazza** | "Di cosa si discute?" | Piazza per tema/problema; il Bar come stanza laterale del tema |
| **Agenda** | "Su cosa siamo d'accordo?" | Agende per tema, versioni, disaccordi aperti |
| **Quaderno** | "Cosa ho fatto io?" | temi seguiti, le mie proposte/problemi, riepilogo, campana, compiti (giuria, curatore), account |

- **I temi non sono una tab.** Agenda e Piazza sono organizzate per tema (elenco dei temi come primo livello, poi il tema); Vota usa i temi che segui. Problemi e proposte si raggiungono dal tema o dalla ricerca.
- **Bar** dentro la Piazza del tema; **Trasparenza** e **Account** dentro il Quaderno (e nel footer, per chi non ha account).
- **Ricerca** sempre a un tocco (icona in barra): problemi, schede, proposte, Agenda.
- **Scrivere** non è una tab: è l'azione principale della pagina in cui ha senso (problema attivo → "Proponi", tema → "Segnala un problema", Piazza → campo messaggio). Evita il "+" generico che porta a un form vuoto.
- **Trasparenza** nel footer e, soprattutto, nei "perché?" accanto a numeri e classificazioni, con link all'ancora giusta di `/come-funziona`.

### 4.2 Una pagina, un invito
Ogni schermata ha una sola azione primaria (pulsante inchiostro). Le secondarie sono testo o icone. Se servono due azioni primarie, servono due schermate.

### 4.3 Mappa rotte ↔ milestone

| Rotta | Contenuto | Milestone |
|---|---|---|
| `/` | anon: presentazione + Agenda in evidenza; utente: Stanotte + mazzo | M4 (mazzo **[delta]**), M6/M9 (Stanotte **[delta]**) |
| `/login`, `/onboarding` | accesso e 3 passi (+ scelta temi **[delta]**) | M3 (fatto), M4 |
| `/temi/[slug]` | tema: problemi, Agenda corrente, link Piazza | M4 |
| `/problemi/[id]` | problema, schede, riformulazioni, proposte | M4 |
| `/proposte/[id]` | proposta, voto, argomenti, consenso per gruppo | M4, M6 |
| `/cerca` | ricerca | M4, M9 |
| `/piazza/[tema]`, `/bar/[tema]` | discussione | M5 |
| `/giuria/[id]` | compito del giurato | M7 |
| `/curatori` | strumenti curatore + log | M8 |
| `/agenda/[tema]`, `/agenda/[tema]/v/[n]` | Agenda e versioni | M9 |
| `/come-funziona`, `/regole`, `/trasparenza/*`, `/come-abbiamo-scelto` | trasparenza | M9 |
| `/quaderno` | area personale | **[delta]** (oggi `/account`, M3) |
| `/account` | export, cancellazione, consensi | M3 (fatto) |

---

## 5. Accoglienza: i primi cinque minuti

L'obiettivo è che chi arriva capisca **in 10 secondi cosa rende Arengo diverso** e faccia **il primo gesto entro 2 minuti**.

### 5.1 Visitatore anonimo — *Medium, Substack: leggi, poi entra*
- Legge tutto senza account: Agende, proposte con barre per gruppo, argomenti, trasparenza.
- La home anon mostra **una proposta a penna vera** con le barre di tutti i gruppi sopra soglia e una frase: "Persone che non sono d'accordo quasi su niente sono d'accordo su questo." Poi "Come ci siamo arrivati" (3 passi illustrati) e l'elenco delle Agende.
- La richiesta di account arriva **solo al primo gesto** (voto, sostegno, messaggio): un foglio dal basso, "Per votare serve un numero di telefono: un numero, un voto." Dopo il login si torna esattamente al gesto interrotto.

### 5.2 Login e onboarding (M3, da rivestire)
I passi restano quelli di M3 (maggiore età, regole + Scala, consenso art. 9); cambia la forma:
- **Una domanda per schermata**, progresso visibile ("2 di 3"), indietro sempre possibile.
- **Regole in 4 frasi** + la Scala come esempi concreti ("Ammesso: 'questa legge è una follia'. Bloccato: 'sei un idiota'.") + "regole complete" espandibili.
- **Consenso art. 9 in linguaggio piano**, con il testo legale completo espandibile: "I tuoi voti su temi politici possono far capire come la pensi. Per questo li salviamo sotto uno pseudonimo, non chiediamo mai il tuo orientamento e non mostriamo a nessuno i voti singoli. Se cambi idea, cancelli l'account e i voti spariscono." Checkbox mai preselezionata. `[DA VERIFICARE CON LEGALE]` resta visibile dove c'è.
- **Handle**: suggerimenti generati, controllo disponibilità al volo, nessun nome reale richiesto ("non serve il tuo nome: qui contano le idee").

### 5.3 Dopo l'onboarding: il primo giro
1. **Scegli i temi che ti interessano** (chip, almeno uno, modificabile dal Quaderno). "Lo sai solo tu, e non entra nel calcolo." **[delta]**
2. **Il primo mazzo**: 5 carte, dai temi scelti. Al primo voto, una nota a margine (corsivo a mano): "il voto è segreto, contano solo i totali". Dopo il primo voto si vedono le barre per gruppo, con una spiegazione unica: "Ogni colore è un gruppo di persone che votano in modo simile. Il motore li ricalcola ogni notte. Non sai in che gruppo sei: nessuno lo sa."
3. **Fine del primo mazzo**: "Stanotte contiamo anche i tuoi voti" + nota onesta: "entrano nel calcolo dopo {min_account_age_days_for_engine} giorni dall'iscrizione: così nessuno può creare account per spostare i risultati." Poi un solo invito: "Vuoi dire la tua su un problema? Leggi le proposte di {tema}."

### 5.4 Stati vuoti e iniziali (curati, mai pagine bianche)
| Situazione | Cosa si dice | Azione |
|---|---|---|
| Nessuna run ancora | "Il primo conteggio è stanotte alle 3. Intanto vota: servono voti da persone diverse." | Vota |
| Run `insufficient` | "Stanotte i voti erano troppo pochi per trovare gruppi d'opinione. Servono almeno {min_participants_for_clustering} persone con {min_votes_participant} voti." + barra di avanzamento aggregata | Vota |
| Un solo gruppo a quota | "Stanotte il motore ha trovato un solo gruppo: senza almeno due gruppi non si può parlare di ponte." | Leggi perché |
| Tema senza ponti | "Ancora nessun terreno comune su {tema}. Ecco dove ci si avvicina." (proposte con bridging più alto) | Vota quelle |
| Problema senza proposte | "Nessuno ha ancora proposto una soluzione. Puoi essere il primo: il tuo nome non comparirà." | Proponi |
| Mazzo vuoto | "Hai votato tutte le proposte dei temi che segui." | Aggiungi un tema |

---

## 6. Schermate

### 6.0 Regole di struttura (valgono per ogni schermata)

Nate dal feedback di Manuel sulle prime 14 schermate ("sembra tutto uguale, non ci sono regole visive"). Qui stanno ruoli, gerarchie e comportamenti; valori esatti di font, colori e spaziature stanno in `docs/DESIGN.md`.

**Tre livelli, uno solo dominante.** Ogni schermata ha:
1. **un** elemento dominante (la domanda, il numero, il testo della persona o il titolo): è la prima cosa che l'occhio trova, grande e con aria intorno;
2. il contenuto (testi delle persone in serif, nitidi, mai a matita);
3. i meta (stato, conteggi, date) in sans piccolo.
Se due elementi competono per il livello 1, uno scende o va in un'altra schermata.

**Sei tipi di schermata, ognuno con uno schema fisso.** L'utente riconosce cosa deve fare dalla forma, prima di leggere.

| Tipo | Schermate | Dominante | Azione primaria | Barra in basso |
|---|---|---|---|---|
| **Leggere** | Proposta, Problema, Agenda, pagine di trasparenza | il testo della persona (o "Agenda Casa v4") | in fondo, fissa sopra la tab bar | tab bar |
| **Decidere** | Mazzo, Giuria, Segnalazione | la domanda ("Questo messaggio rispetta le regole?") con l'oggetto su un foglio | le scelte stesse, grandi; nel Mazzo il tocco vota subito, in Giuria e Segnalazione si conferma perché non si torna indietro | Mazzo: tab bar · Giuria e Segnalazione: nessuna (modalità concentrata) |
| **Scrivere** | Nuovo problema, Nuova proposta, Argomento, Riformulazione | la domanda del passo ("Quanto costa e chi paga?") | "Avanti" / "Pubblica …" fisso sopra la tastiera | nessuna; in alto "Annulla · titolo · passo N di M" |
| **Conversare** | Piazza, Bar | i messaggi (serif), più condivisi in alto | il campo di scrittura fisso in basso | tab bar sotto il campo |
| **Risultato** | Stanotte, Fine mazzo, problema aperto, proposta pubblicata | una frase o un numero molto grande ("Stanotte 3 proposte sono passate a penna.") | una sola, poi la schermata finisce | tab bar |
| **Sistema** | Account, Cosa sappiamo di te, Regole, Sanzione, Config | il titolo | nessuna dominante; righe etichetta + spiegazione; azioni distruttive in fondo, colore gomma, con conferma | tab bar |

**Un momento per sezione.** Ogni area ha un solo gesto che la rende riconoscibile, e un solo segno a mano per schermata:

| Sezione | Momento distintivo |
|---|---|
| Vota | la croce che si disegna nella casella, la carta che scivola via e lascia la successiva |
| Stanotte | il numero cerchiato a matita e il timbro "a penna" |
| Problema | la lavagna delle tacche che si riempie |
| Proposta | le barre evidenziatore che si stendono una alla volta al primo ingresso |
| Agenda | il numero di versione gigante; chi entra va a inchiostro, chi esce viene barrato a matita |
| Scrivere | la parola che giudica sottolineata a matita, come un professore |
| Filtro | la gomma |
| Piazza / Bar | la testata illustrata (portici / tavolino del bar); il Bar ha carta e tono più rilassati |
| Giuria | il biglietto del sorteggio; per il resto nessuna decorazione |
| Quaderno | la copertina disegnata dai temi seguiti (grigio neutro, mai colori di gruppo) |

**Leggibilità e accessibilità (minimi non negoziabili).**
- Corpo testo ≥ 16 px; testi delle persone ≥ 18 px su mobile; meta mai sotto 12 px.
- Contrasto AA (4,5:1 per il testo normale, 3:1 per il testo grande). La grafite HB (`#8B8B91` su carta) non lo raggiunge: solo decorazioni e stati disabilitati, **mai testo da leggere**; per i meta si usa almeno la 2B.
- Aree tattili ≥ 44 × 44 px; le caselle di voto più grandi.
- Righe di testo ≤ 70 caratteri su desktop (colonna di lettura stretta anche su schermi larghi).
- Numeri con cifre tabulari; percentuali sempre accanto alla barra, mai solo colore (daltonismo).
- Focus visibile da tastiera su ogni elemento interattivo; ordine di tabulazione uguale all'ordine visivo.
- Tutto il movimento rispetta `prefers-reduced-motion`; nessuna informazione affidata solo all'animazione.
- Maiuscola solo a inizio frase, ovunque (pulsanti, titoli, tab).

**Barra in alto, sempre uguale.** Sinistra: indietro con il nome del luogo da cui vieni ("‹ Casa"). Centro: contesto breve. Destra: al massimo un'azione (cerca o campana). Sulle quattro schermate principali niente "indietro", solo il titolo del luogo.

**Moduli.** Una domanda per schermata; tastiera del tipo giusto (numerica per OTP); etichetta sempre visibile, mai solo segnaposto; contatore caratteri che diventa evidente solo vicino al limite; errori sotto il campo, scritti come "cosa fare"; bozza tenuta nel browser.

**Stati obbligatori per ogni schermata.** Prima di disegnarla o costruirla si definiscono: vuoto · caricamento (righe di grafite al posto del contenuto, niente spinner) · errore · successo · sotto soglia · ospite (foglio "entra per …" al primo gesto) · sospeso o pausa di scrittura. Una schermata senza tutti gli stati non è finita.

**Desktop.** La tab bar diventa una barra in alto con gli stessi quattro luoghi. Leggere e Scrivere restano a colonna singola; Agenda e Proposta possono affiancare testo e consenso; la Piazza può mostrare il thread aperto accanto all'elenco.

---

Formato delle schede seguenti: **obiettivo** · contenuto in ordine di importanza · **azione primaria** · stati · microcopy · gesto (Segnare, Contare, Cancellare, Sottolineare della moodboard).

### 6.1 Stanotte (home utente al mattino) [delta]
- **Obiettivo**: in 30 secondi sapere cosa è cambiato.
- Contenuto: 1) passate a penna (con tema e "il gruppo più freddo al X%"), 2) evidenziate, 3) Agende con nuova versione, 4) disaccordi che si sono stretti/allargati, 5) numeri della run in piccolo (partecipanti, gruppi) con link a `/trasparenza/motore`. Se tra queste c'è qualcosa che hai votato: nota a margine "c'era anche il tuo voto" (calcolato per te, non salvato).
- **Azione**: "Apri il mazzo di oggi".
- Stati: run fallita → "Stanotte il conteggio non è andato a buon fine, riproviamo" + link al log; nessuna novità → "Notte tranquilla".
- Gesto: timbro "a penna".

### 6.2 Mazzo voto
- **Obiettivo**: votare bene, una proposta alla volta.
- Carta: tema (evidenziatore), problema in una riga, **cosa** della proposta grande, "come" e "costo" espandibili, numero argomenti. Contatore "4 di 10".
- **Azione**: tre caselle (D'accordo / Contrario / Passo). Dopo il voto: barre per gruppo + miglior argomento pro e contro, poi "Avanti".
- Voto cambiabile: tornando indietro la casella mostra la croce; "Puoi cambiarlo quando vuoi: stanotte contiamo quello che c'è."
- "Passo" ha pari dignità: "Passi, va benissimo. Anche questo aiuta il calcolo."
- Stati: sotto soglia → barre sostituite da "Pochi voti per ora: i risultati compaiono da {min_votes_item}". Non onboardato o sospeso → spiegazione e cosa fare.
- Gesto: Segnare.

### 6.3 Problema
- Contenuto: titolo neutro, corpo, "chi riguarda", **schede** (fatti con fonte e tipo fonte), stato e prossimo passo, proposte (ordine casuale per utente prima della run), storico riformulazioni.
- **Azione** (dipende dallo stato): in raccolta → "Sostieni"; attivo → "Proponi una soluzione".
- Riformulazione: "Pensi che si possa dire meglio, in modo più neutro?" → testo alternativo votabile; storico visibile come diff a matita.
- Gesto: Contare (tally dei sostegni; sotto {min_votes_item} solo "meno di {min_votes_item} sostegni").

### 6.4 Proposta
- Contenuto: cosa · come · costo e copertura · rischi · esempio estero (con fonte) · stato e prossimo passo · **consenso per gruppo** (barre evidenziatore, "il gruppo più freddo al X%", "perché?") · **argomenti pro e contro affiancati** (colonne su desktop, schede alternate su mobile), ordinati per utilità trasversale.
- **Azione**: votare (stesse caselle del mazzo). Secondarie: "Aggiungi un argomento", "Utile / Non utile" sugli argomenti, segnala.
- Mai l'autore. Se la proposta nasce dalla Piazza: "nata in Piazza" con link al messaggio.
- Gesto: Sottolineare (utilità degli argomenti).

### 6.5 Scrivi un problema
- Passi: titolo (≤120) → descrizione → chi riguarda → tema.
- **Checklist di neutralità dal vivo** accanto al campo: "È misurabile?", "Evita aggettivi come 'vergognoso', 'assurdo'?", "Non contiene già la soluzione?". Suggerimenti, non blocchi (il blocco è solo del filtro).
- Prima dell'invio: "Cerca se esiste già" (ricerca full-text sui titoli simili) per ridurre i doppioni.
- Dopo l'invio: "Il tuo problema è in raccolta. Si apre con {problem_support_threshold} sostegni." Il problema compare nel Quaderno.
- Limite giornaliero (`rate_limits.problems`): mostrato prima, non dopo l'errore.

### 6.6 Scrivi una proposta
- Wizard a 5 passi = 5 campi (cosa, come, costo e copertura, rischi, esempio estero opzionale), con limiti di caratteri visibili e un esempio buono per ogni campo.
- Anteprima "come la vedranno gli altri" (senza nome) prima dell'invio.
- Bozza tenuta nel browser se esci (solo locale).
- Promozione da Piazza: stessi passi, "cosa" precompilato dal messaggio.

### 6.7 Piazza
- Contenuto: due liste, **Più condivisi** (bridging) e **Nuovi** (ultime {piazza_new_window_hours} ore non ancora valutati). Thread a 2 livelli. Handle visibile, nessun contatore sulle persone.
- Voto messaggio: d'accordo / contrario / passo (alimenta il motore: va detto).
- **Slow mode**: banner con motivo e attesa in minuti, senza secondi che scorrono: "Discussione molto animata: un messaggio ogni {slowmode_user_interval_min} minuti. Puoi scrivere di nuovo tra 4 minuti."
- Messaggio promuovibile: segno a margine "questo messaggio piace a gruppi diversi: può diventare una proposta".
- Gesto: Cancellare (filtro all'invio).

### 6.8 Bar
- Stessa struttura della Piazza, carta diversa (più informale), niente voti.
- Testata fissa: "Qui si chiacchiera. Niente conta per il motore, tutto sparisce dopo {bar_retention_days} giorni."

### 6.9 Agenda
- Contenuto: tema e **versione N** grande, data e run; problemi attivi → proposte a penna con barre per gruppo; migliori {agenda_top_arguments} argomenti pro e contro; **Disaccordi aperti**; numeri della run.
- **Confronto tra versioni**: "Cosa è cambiato dalla v3": entrate, uscite, con il motivo ("non più ponte per 1 run").
- **Azione**: "Vota le proposte che possono entrare" (proposte evidenziate o vicine alla soglia).
- È la pagina più condivisibile: link pubblico pulito, anteprima social con titolo e numero di versione (solo dati aggregati).

### 6.10 Quaderno [delta per riepilogo e temi seguiti]
- Copertina disegnata dai temi seguiti (design).
- Sezioni: questa settimana (riepilogo §3.4) · i miei problemi e le mie proposte (con stato e prossimo passo: solo io vedo che sono mie) · campana · compiti (giuria aperta con scadenza; candidatura curatore se idoneo) · temi seguiti · account.
- Testo fisso: "Lo vedi solo tu. Non entra nel motore."

### 6.11 Giuria
- Compito chiaro e a tempo: "Sei stato estratto. Decidi se questo messaggio viola la regola di livello N. Scadenza tra 31 ore."
- Contenuto: messaggio, messaggio padre, livello segnalato, la Scala con esempi; **mai autore né segnalanti**. Voto: Viola / Non viola / Mi astengo.
- Dopo il voto: "Grazie. L'esito arriva quando votano almeno {jury_min_votes} giurati." Esito nella campana.
- Se il panel è senza garanzia di diversità, il giurato lo sa (coerente con il registro pubblico).

### 6.12 Segnalazione
- Tre scelte con esempi dalla Scala (2 insulto a utente, 3 odio, 4 illecito) + nota opzionale. "Critica dura e volgarità non rivolte a persone sono ammesse": riduce le segnalazioni di disaccordo.
- Dopo: "Ricevuta. Un livello 4 viene nascosto subito e controllato entro {l4_sla_hours} ore; gli altri li decide una giuria di utenti estratti."

### 6.13 Sanzione e ricorso
- Tono rispettoso, mai punitivo: cosa è successo, quale regola, quale contenuto, chi ha deciso (filtro/giuria/admin), quanto dura, quando decade lo storico ({sanction_decay_days} giorni senza violazioni), **"Fai ricorso"** (uno per sanzione, giuria nuova che non vede l'esito precedente).

### 6.14 Curatori
- Strumenti: fatti da approvare con motivazione, doppioni da unire (serve {curator_merge_approvals}), refusi nelle proposte (diff mostrato all'autore, che può annullare).
- Banner fisso: "I curatori ordinano, non nascondono. Ogni azione è pubblica." Log pubblico su `/trasparenza/curatori`.

### 6.15 Trasparenza
- `/come-funziona`: l'algoritmo spiegato a strati, prima una frase, poi un disegno, poi i dettagli (ALGORITMO.md). Ogni "perché?" del prodotto atterra su un'ancora qui.
- `/trasparenza/motore`: run, parametri, gruppi, silhouette, link ai log. `/trasparenza/config`: soglie correnti e storico modifiche con motivazione. `/trasparenza/moderazione`: registro anonimizzato. Linguaggio: prima la frase umana, poi il numero.

### 6.16 Account
- Export dati, cancellazione (con spiegazione: cosa sparisce, cosa resta anonimizzato secondo `account_deletion_mode`), revoca consenso = cancellazione (detto chiaramente), **"Cosa sappiamo di te"** (§8).

---

## 7. Feedback, microinterazioni, tono

### 7.1 Microinterazioni
| Momento | Comportamento |
|---|---|
| Voto | la croce si disegna nella casella (gesto Segnare); cambiare voto cancella e ridisegna |
| Sostegno | una tacca in più alla lavagna; al raggiungimento soglia: "Si è aperto. Ora si possono proporre soluzioni." |
| Filtro | la gomma cancella davanti all'utente, spiega la regola, "Questa frase non è stata pubblicata né salvata." Il testo resta nel campo, solo nel browser, per riformularlo senza riscrivere tutto: il server non lo conserva né lo logga (principio 9). Svuotare il campo punirebbe chi ha sbagliato una parola in un argomento lungo |
| Pausa di scrittura | "Hai ricevuto troppi blocchi gravi di fila. Puoi riscrivere tra {filter_pause_minutes} minuti." Nessun dettaglio salvato, e lo diciamo |
| Slow mode | attesa in minuti, con calma: non è un errore |
| Errore di rete o limite | sempre "cosa è successo" + "cosa fare ora"; mai codici |
| Passaggio a penna | animazione una tantum (matita → inchiostro) quando una proposta che hai visto passa a penna |
| Movimento ridotto | tutte le animazioni rispettano `prefers-reduced-motion` |

### 7.2 Tono di voce
Diretto, caldo, una punta di ironia; mai paternalista, mai burocratico, mai militante. Regole condivise con `docs/DESIGN.md`:
- si dà del tu, frasi brevi, verbi attivi, maiuscola solo a inizio frase, niente punti esclamativi;
- i pulsanti dicono cosa succede ("Sostieni", "Pubblica proposta") e lo stesso verbo resta in tutto il flusso;
- gli errori spiegano cosa è successo e cosa fare, senza scusarsi;
- vocabolario dei materiali: "a matita", "evidenziata", "passa a penna", "segna";
- niente gergo tecnico ("gruppi d'opinione", mai "cluster"), niente numeri fissi delle soglie;
- gli stati vuoti invitano ad agire.

| Sì | No |
|---|---|
| "Critica l'idea, non chi la scrive." | "Il tuo contenuto viola le linee guida della community." |
| "Per oggi hai finito." | "Hai esaurito le proposte disponibili." |
| "Pochi voti per dirlo." | "Dati insufficienti (n < 5)." |
| "Nessuno vede come hai votato: contano solo i totali." | "Il tuo voto è anonimo." (falso) |
| "Divide: i gruppi la vedono in modo opposto." | "Proposta controversa." |
| "Passi, va benissimo." | "Sei sicuro di non voler votare?" |
| "Ne mancano 8." | "Progresso: 68%." |

Mai: aggettivi politici per i gruppi ("progressisti", "conservatori"), "vinto/perso", "la community ha deciso" quando ha deciso una regola.

---

## 8. Fiducia come esperienza

- **Ogni numero è cliccabile** e porta alla sua spiegazione.
- **Versione dell'algoritmo e della config** in piccolo nel footer di Agenda e Stanotte ("motore v. abc1234, config del 12 ottobre").
- **"Cosa sappiamo di te"** in Account, elenco onesto:
  - il numero di telefono, solo nel sistema di login, per garantire un account a persona;
  - l'handle e i contenuti che hai scritto (proposte e argomenti senza nome per gli altri);
  - i tuoi voti, sotto uno pseudonimo calcolato con una chiave segreta: nessuna pagina li mostra, ma chi gestisce il server con le chiavi potrebbe tecnicamente ricollegarli. Per questo lo scriviamo (`docs/ALGORITMO.md`, limite del principio 7);
  - i temi che segui **[delta]**;
  - cosa **non** sappiamo: il tuo orientamento, il tuo gruppo d'opinione (calcolato solo in memoria durante la run), i testi bloccati dal filtro.
- **Registro moderazione** leggibile da tutti, senza testi né handle.

---

## 9. Verifica di coerenza

### 9.1 Funzioni × principi
Legenda: ✓ coerente · ⚠ coerente con la condizione indicata.

| Funzione | 1 Peso uguale | 2 No orientamento / gruppi | 3 Voto segreto | 4 No censura | 5 Ranking per consenso | 6 Anti-X | 7 Gestore limitato | 8 Trasparenza | 9 Minimizzazione |
|---|---|---|---|---|---|---|---|---|---|
| Ciclo e stati (§2) | ✓ | ✓ | ✓ solo aggregati | ✓ | ✓ | ✓ | ✓ soglie da config | ✓ "perché?" | ✓ |
| Stanotte (§3.1) | ✓ | ✓ solo aggregati di run | ⚠ "c'era il tuo voto" calcolato al volo per l'utente, mai salvato | ✓ | ✓ | ✓ nessun trending | ✓ | ✓ | ✓ |
| Mazzo del giorno (§3.2) | ✓ | ✓ | ✓ | ✓ | ⚠ priorità a "meno voti", mai a engagement | ✓ finito | ⚠ dimensione in config | ✓ criterio dichiarato | ✓ |
| Risultati dopo il voto (§3.3) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ visibili sempre fuori dal mazzo | ✓ |
| Riepilogo Quaderno (§3.4) | ✓ | ✓ | ⚠ via pseudo come l'export, solo a sé | ✓ | ✓ | ✓ niente condivisione | ✓ | ✓ | ⚠ non persistito |
| Argomenti dell'altra parte (§3.5) | ✓ | ⚠ "chi la pensa diversamente" = utilità trasversale aggregata, mai "il gruppo X" riferito all'utente | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Ruoli da reputazione (§3.6) | ✓ mai peso | ✓ | ✓ | ✓ | ✓ | ✓ niente badge | ✓ soglie in config | ✓ | ⚠ punteggio grezzo mai mostrato |
| Campana (§3.7) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ niente leve sociali | ✓ | ✓ | ✓ |
| Temi seguiti [delta] | ✓ | ⚠ tabella privata, fuori dal motore, non usata per inferire nulla | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ dichiarata in "Cosa sappiamo" | ⚠ in export e cancellata con l'account |
| Barre colorate per gruppo | ✓ | ⚠ colori in ordine, riassegnati a ogni run, mai legati all'utente o ai suoi voti | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Filtro come gomma (§7) | ✓ | ✓ | ✓ | ✓ solo livelli 2-4 | ✓ | ✓ | ✓ | ✓ regola mostrata | ✓ testo non salvato |
| Giuria, segnalazione, sanzione (§6.11-13) | ✓ | ✓ panel senza etichette | ✓ | ✓ | ✓ | ✓ | ✓ admin non tocca esiti | ✓ registro | ✓ |
| Anteprima social dell'Agenda | ✓ | ✓ | ✓ | ✓ | ✓ | ⚠ link semplice, niente "condividi con commento" interno | ✓ | ✓ | ✓ solo aggregati |
| "Cosa sappiamo di te" (§8) | ✓ | ✓ | ✓ dichiara il limite | ✓ | ✓ | ✓ | ✓ dichiara il limite del service role | ✓ | ✓ |

### 9.2 Coerenza con la spec (PLAN)
- **Soglie**: ogni numero nei testi è un `{chiave}` di `platform_config`. Chiavi citate e già nel seed: problem_support_threshold, reformulation_min_votes, bar_retention_days, min_account_age_days_for_engine, min_votes_participant, min_votes_item, min_participants_for_clustering, bridging_stable_runs, promotion_min_bridging, promotion_min_votes, piazza_new_window_hours, rate_limits, slowmode_user_interval_min, jury_min_votes, jury_deadline_hours, l4_sla_hours, sanction_decay_days, filter_pause_minutes, curator_merge_approvals, agenda_top_arguments, account_deletion_mode. Nuova: `daily_deck_size` **[delta]**.
- **Conteggi sotto soglia** (task 4.6, `min_votes_item`): ovunque appaia un conteggio esiste lo stato "meno di {min_votes_item}".
- **Autore**: mai mostrato su problemi, proposte, argomenti; l'utente vede i propri solo nel Quaderno (lettura riservata a sé).
- **Ordine**: proposte in ordine casuale per utente prima della run (4.3); argomenti casuali prima della run, poi per utilità trasversale (4.4); Piazza per bridging (5.1).
- **Onestà sull'anzianità**: i voti dei nuovi account entrano nel motore dopo {min_account_age_days_for_engine} giorni; il prodotto lo dice invece di nasconderlo.

### 9.3 Incoerenze trovate nella moodboard (inviate alla sessione design il 2026-10-15, corrette nella v3)
| Testo moodboard | Problema | Correzione |
|---|---|---|
| "nessuno sa come hai votato, nemmeno noi" | falso: pseudonimizzazione, non anonimato (principio 3) | "nessuno vede come hai votato: contano solo i totali" |
| "Ponte stabile per tre notti" | `bridging_stable_runs` oggi vale 2; numeri fissi nei testi | "ponte per {bridging_stable_runs} notti di fila" |
| tally "17 sostegni su 25" | sotto `min_votes_item` i conteggi sono nascosti (task 4.6) | stato "meno di {min_votes_item} sostegni" senza tacche esatte |
| "Puoi cambiarla fino alla run di stanotte" | il voto si cambia sempre, la run fotografa | "puoi cambiarlo quando vuoi: stanotte contiamo quello che c'è" |
| evidenziatori "Gruppo A…E" | rischio di associare utente e gruppo (principio 2) | mai "il tuo gruppo"; legenda "i colori si assegnano ai gruppi in ordine e ripartono a ogni run: non dicono chi sei"; copertina del Quaderno in grigio neutro |
| "altre 6 e per oggi hai finito", Quaderno con temi | funzioni non previste | proposte come delta (§10) |

Seconda verifica, sulle 14 schermate (`C:\dev\arengo-design\schermate.html`, 2026-10-15):

| Schermata | Problema | Correzione |
|---|---|---|
| Proposta: "Evidenziata da 4 gruppi su 5" con un gruppo al 52% | errore di concetto: ponte = **tutti** i gruppi a quota sopra {bridging_threshold}; con un gruppo sotto non è evidenziata | "A matita · manca un gruppo": barre degli altri piene, quella sotto soglia in evidenza, "il gruppo più freddo è al 52%" |
| Giuria: radio con i livelli 0-4 | il giurato non sceglie il livello: decide se il contenuto viola il livello segnalato (M7) | livello segnalato in alto con l'esempio della Scala; scelte "Viola / Non viola / Mi astengo" |
| Giuria: "livello 2: il messaggio si nasconde" | per M7 "viola" → rimozione **e** sanzione graduata (prima un avviso), per livello 2 e 3; il livello 4 va agli admin già alla segnalazione | descrivere l'esito, non il livello: "Se viola: il messaggio viene rimosso e l'autore riceve una sanzione, a partire da un avviso." |
| Giuria: "uno di 7 giurati" | numero fisso e sbagliato (`jury_size` oggi 5) | "uno di {jury_size} giurati" |
| Giuria: "Nessuno vede la tua scelta" | promessa non garantita dalla spec | "La tua scelta non è pubblica: il registro mostra solo l'esito." |
| Bar: "si cancellano dopo 7 giorni" | numero fisso e sbagliato (`bar_retention_days` oggi 60) | "dopo {bar_retention_days} giorni" |
| Cosa sappiamo di te: "Quello che scrivi: pubblico, senza il tuo nome" | in Piazza e Bar l'handle si vede (`piazza_public`, `bar_public`) | "Problemi, proposte e argomenti: senza nome. Piazza e Bar: con il tuo handle, mai con il numero." |
| Cosa sappiamo di te: voti "con uno pseudonimo" | manca il limite dichiarato (§8) | aggiungere: "Chi gestisce i server con le chiavi potrebbe tecnicamente ricollegarli: per questo lo scriviamo." |
| Piazza: messaggi senza handle | la spec mostra l'handle in Piazza e Bar | tenere l'handle (piccolo, sans), nessun contatore accanto. Toglierlo è una scelta di prodotto di Manuel |
| Filtro: campo svuotato | punisce chi riformula; il principio 9 riguarda server e log, non il campo nel browser | testo lasciato nel campo (§7.1) |

### 9.4 Rischi d'esperienza da presidiare
- **Freddezza iniziale**: con pochi utenti le run sono `insufficient` per settimane. Mitigazione: stati vuoti che mostrano l'avanzamento verso {min_participants_for_clustering}, beta con gruppo chiuso, temi iniziali pochi (3-5) per concentrare i voti.
- **Giurati che non vedono l'estrazione** (niente push): la campana basta solo se si torna. Mitigazione v1: scadenza {jury_deadline_hours} + ri-estrazione già previste; dopo v1 valutare un avviso via SMS/email con opt-in esplicito.
- **"Maggioritario" percepito come vittoria**: va mostrato visivamente diverso dal ponte (§2).
- **Mazzo che diventa feed**: deve finire davvero; il "continua" è solo navigazione per tema.

---

## 10. Delta proposti a BRIEF/PLAN

Nessuno entra nelle milestone senza ok di Manuel. Impatto stimato in ordine crescente.

| # | Funzione | Cosa serve | Milestone | Quando |
|---|---|---|---|---|
| D1 | Microcopy e stati di questo documento (inclusi "sotto soglia" uniformi, onboarding rivestito) | solo UI e testi | M4-M9, ognuna per le sue pagine | v1 |
| D2 | Risultati visibili dopo il voto nel mazzo (§3.3) | solo UI | M4 | v1 |
| D3 | Temi seguiti + scelta in onboarding | tabella `topic_follows` (user_id, topic_id) con RLS solo proprietario, in export e cancellazione account | M4 (task nuovo) | v1 |
| D4 | Mazzo del giorno | chiave `daily_deck_size` (≥ `min_votes_participant`) via `admin_set_config`; RPC che seleziona proposte non votate dai temi seguiti, priorità a meno voti, ordine casuale | M4 | v1 |
| D5 | Quaderno (`/quaderno`) con riepilogo settimanale | RPC SECURITY DEFINER che restituisce all'utente soli i propri conteggi (come l'export), nessuna tabella nuova | M6 (serve `item_consensus`) | v1 |
| D6 | Stanotte | lettura confronto tra due `item_consensus` consecutive + `agenda_versions` | M9 | v1 |
| D7 | Campana in-app | tabella `notifications` privata per utente (tipo, riferimento, letto), scritta da RPC/motore; cancellata con l'account | M7 (giurie) | v1 o subito dopo |
| D8 | Anteprima social dell'Agenda | immagini OG generate da dati aggregati | M9 | dopo v1 |
| D9 | Avviso giuria fuori piattaforma (SMS/email, opt-in) | provider, costi, consenso | — | dopo v1 |

Se approvati: D3, D4 come task di M4; D5 in M6; D6, D8 in M9; D7 in M7; una riga per ciascuno in `docs/PLAN.md` → "Decisioni".
