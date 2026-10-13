# Algoritmo del motore di consenso — bozza

Stato: bozza (stream E1). Codice: `engine/src/core/` (funzioni pure), test: `engine/test/`.
Il motore gira di notte; questa pagina spiega in italiano semplice cosa fa, con quali parametri, cosa non salva e quali limiti ha. Le parole tecniche sono spiegate nel glossario in fondo.

## In una frase
Il motore guarda come hanno votato le persone, le divide in gruppi d'opinione anonimi in base a come votano (non a cosa dichiarano), e cerca le proposte approvate da **tutti** i gruppi: le **proposte ponte**.

## Cosa riceve
- I voti, ciascuno come `{pseudo, item, valore}`: `pseudo` è un codice che sostituisce l'utente (vedi "Limiti"), `item` è una proposta o un messaggio della Piazza, il valore è +1 (d'accordo), -1 (contrario) o 0 (passo).
- L'età di ogni account in giorni (associata allo pseudo).
- Lo storico degli esiti delle run precedenti, per ogni item: una voce per run, con la classificazione oppure `assente` se in quella run l'item non era considerato o la run non ha formato gruppi.
- Gli pseudo idonei a fare i giurati (il filtro di idoneità si fa prima del motore).
- Gli eventi di reputazione: ogni "utile" a un argomento e ogni "d'accordo" a un messaggio della Piazza, con lo pseudo dell'autore e quello di chi ha votato.
- Un seed (una stringa): tutto ciò che è casuale dipende solo da lui. Stessi dati + stesso seed = stesso risultato, verificabile da chiunque.
- I parametri, letti da `platform_config` (tabella sotto).

Dati non validi (età negative o non numeriche, voti doppi, eventi di reputazione incompleti) fermano la run con un errore che non contiene pseudo.

## I passi
1. **Chi entra nel calcolo.** Entrano gli account con almeno `min_account_age_days_for_engine` giorni di vita e almeno `min_votes_participant` voti **sugli item considerati**; un item è considerato se ha almeno `min_votes_item` voti di chi è nel calcolo. Le due regole dipendono l'una dall'altra, quindi il filtro si ripete finché nulla cambia (al massimo tanti giri quanti sono persone + item: ogni giro può solo togliere qualcuno). Così chi vota solo item quasi ignorati non entra nel calcolo e non forma un "gruppo fantasma". Gli esclusi votano normalmente, ma il loro voto non entra nei gruppi né nelle classificazioni del motore. Serve anche contro gli account creati in massa.
2. **Controlli prima del calcolo.** Se nessun item è considerato, la run finisce con esito `insufficient` e motivo `no_items`. Se le persone nel calcolo sono meno di `min_participants_for_clustering`, esito `insufficient` con motivo `too_few_participants`. In entrambi i casi si pubblicano solo le approvazioni totali degli item, senza gruppi.
3. **La tabella dei voti e la riduzione a 2 dimensioni (PCA).** Una riga per persona, una colonna per item: +1, -1, 0, vuoto se non ha votato. Per ogni colonna si sottrae la media dei voti presenti; le caselle vuote diventano 0 ("nessuna informazione"). Poi la tabella viene riassunta in 2 numeri per persona con l'analisi delle componenti principali (libreria `ml-pca`): chi vota in modo simile finisce vicino.
4. **Gruppi (k-means).** I punti vengono divisi in k gruppi, provando ogni k da `k_min` a `k_max`. Si sceglie il k con la silhouette più alta (una misura di quanto i gruppi sono compatti e separati); a parità vince il k più piccolo. L'inizio del k-means (k-means++) usa un generatore casuale deterministico (mulberry32) inizializzato dal seed. I gruppi si chiamano "Gruppo 1", "Gruppo 2", ... in ordine di dimensione: sono numeri, non etichette politiche, e vengono ricalcolati da zero a ogni run. Se i punti sono tutti uguali (per esempio tutti hanno votato allo stesso modo) non c'è nulla da dividere: esito `insufficient` con motivo `no_structure`.
5. **Accordo per gruppo.** Per ogni item e ogni gruppo con almeno max(`min_votes_per_cluster`, `min_votes_item`) voti sull'item (la stessa soglia sotto cui i conteggi pubblici restano nascosti): p_agree = (d'accordo + 1) / (d'accordo + contrari + passo + 2). Il "+1/+2" evita che pochi voti diano 0% o 100%. Sotto quella soglia l'accordo del gruppo non si calcola né si pubblica (`p_agree` vuoto), perché con pochissimi voti si potrebbe risalire a come ha votato qualcuno.
   **Quota minima del gruppo** (decisione di Manuel): un gruppo conta per la classificazione solo se contiene almeno `min_cluster_share` dei partecipanti (con il valore iniziale 0.05, il 5%). I gruppi più piccoli restano visibili nei risultati, marcati "sotto quota" (`below_share`), con la loro dimensione ma senza accordo pubblicato, e non entrano nei calcoli qui sotto. In parole semplici: un gruppetto compatto non può da solo impedire che una proposta sia ponte; una minoranza ampia sì. Se tutti i gruppi fossero sotto quota (con i valori iniziali non può succedere), la run finisce con esito `insufficient` e motivo `all_groups_below_share`.
   Il **bridging score** di un item è il p_agree più basso tra i gruppi a quota. Se anche un solo gruppo a quota non ha abbastanza voti, l'item è `insufficiente`.
6. **Classificazione** (solo sui gruppi a quota), nell'ordine:
   - `ponte`: il p_agree più basso è almeno `bridging_threshold` (tutti i gruppi approvano);
   - `divisivo`: la differenza tra il p_agree più alto e il più basso è almeno `divisive_gap`;
   - `maggioritario`: l'approvazione totale (d'accordo / voti, tra chi è nel calcolo) è almeno `majority_threshold`;
   - `nessun_consenso`: tutto il resto.

   **Un solo gruppo a quota.** Se dopo la quota resta un solo gruppo, non ha senso parlare di accordo "tra gruppi": `ponte` e `divisivo` sono impossibili, ogni item è `maggioritario` o `nessun_consenso` in base all'approvazione totale, e la run pubblica il segnale `single_group_at_share: true`.
7. **Stabilità.** Un item è `stable_ponte` se è `ponte` in questa run e nelle `bridging_stable_runs` − 1 run immediatamente precedenti. Una run in cui l'item era `assente` o `insufficiente` interrompe la serie. Solo le proposte ponte stabili possono entrare nell'Agenda.
8. **Panel di giuria.** Contano come "bucket" della diversità solo i gruppi a quota che hanno almeno un idoneo a fare il giurato. Con almeno 2 bucket, il motore forma panel di `jury_size` persone, ciascuno con persone di almeno min(`jury_min_buckets`, numero di bucket) bucket diversi (decisione di Manuel: con 2 gruppi una giuria resta possibile); gli idonei dei gruppi sotto quota o senza gruppo possono completare un panel, ma non contano per la diversità. Si forma il massimo numero di panel possibile, senza ripetere persone. Con 0 o 1 bucket, o se la run è `insufficient` (nessun gruppo), i panel sono estratti a caso tra tutti gli idonei e marcati `diversity: false`: nel registro pubblico la giuria risulterà "senza garanzia di diversità". Se gli idonei sono almeno `jury_size`, almeno un panel si forma sempre. Il panel non dice mai di che gruppo è ciascun membro.
9. **Reputazione.** Ogni "utile" a un argomento e ogni "d'accordo" a un messaggio della Piazza dà credito all'autore: `reputation_cross_credit` se chi vota e l'autore sono in gruppi diversi, entrambi a quota; `reputation_same_credit` in tutti gli altri casi (stesso gruppo, uno dei due in un gruppo sotto quota o senza gruppo, run senza gruppi). Così un blocco sotto quota non può gonfiare la reputazione di un complice. Il credito è 0 se chi vota non è entrato nel calcolo (passo 1) o se vota sé stesso: così gli account nuovi creati in massa non spostano la reputazione di nessuno. Il credito si dimezza ogni `reputation_half_life_days` giorni. La reputazione sblocca permessi (curatore, giurato), **mai** peso nel voto. Il punteggio grezzo non va mai mostrato agli utenti: si usano solo soglie e percentili.
10. **Cosa esce.** L'output è diviso in due parti separate: `public` (solo aggregati) e `private` (panel e reputazione). Il motore non scrive log.

Sorteggio dei curatori (usato da M8): tra gli idonei si estrae `curators_count` persone in modo stratificato, cioè ogni gruppo d'opinione riceve posti in proporzione alla sua dimensione (chi non ha gruppo forma uno strato a parte). Il seed è pubblico: sha256(data + id dell'ultima run), così chiunque può rifare il sorteggio. Il sorteggio avviene dentro la stessa run, usando l'oggetto dei gruppi in memoria. **Quell'oggetto non deve mai uscire dalla run** (né salvato, né passato ad altri processi, né esposto): interrogandolo ripetutamente su insiemi scelti si ricostruirebbe a quale gruppo appartiene ciascuno.

## Parametri (da `platform_config`)
| Chiave | Valore iniziale | A cosa serve |
|---|---|---|
| `min_account_age_days_for_engine` | 7 | età minima dell'account per entrare nel calcolo |
| `min_votes_participant` | 7 | voti minimi di una persona (sugli item considerati) per entrare nel calcolo |
| `min_votes_item` | 5 | voti minimi di un item per essere considerato |
| `min_votes_per_cluster` | 3 | voti minimi di un gruppo su un item per misurarne l'accordo |
| `min_participants_for_clustering` | 50 | sotto questa soglia niente gruppi, solo totali |
| `k_min` | 2 | numero minimo di gruppi provato |
| `k_max` | 5 | numero massimo di gruppi provato |
| `bridging_threshold` | 0.6 | accordo minimo in ogni gruppo per essere `ponte` |
| `bridging_stable_runs` | 2 | run consecutive da `ponte` per essere stabile |
| `divisive_gap` | 0.4 | distanza tra gruppi oltre cui un item è `divisivo` |
| `majority_threshold` | 0.6 | approvazione totale per essere `maggioritario` |
| `jury_size` | 5 | persone per panel di giuria |
| `jury_min_buckets` | 3 | gruppi diversi minimi in un panel (se la run ne ha trovati meno, tutti quelli trovati) |
| `reputation_half_life_days` | 90 | giorni in cui il credito di reputazione si dimezza |
| `curators_count` | 7 | curatori estratti nel sorteggio stratificato |
| `reputation_cross_credit` | 1 | credito di reputazione da un gruppo diverso — **da aggiungere al seed in M6** |
| `reputation_same_credit` | 0.25 | credito di reputazione dallo stesso gruppo — **da aggiungere al seed in M6** |
| `min_cluster_share` | 0.05 | quota minima di partecipanti perché un gruppo conti in ponte/divisivo/insufficiente (tra 0 e 0.5 escluso) — **da aggiungere al seed in M6** |

Ogni modifica di un parametro passa da `admin_set_config` con motivazione obbligatoria ed è registrata in `config_changelog` (pubblico). Un test (`engine/test/seed-config.test.ts`) controlla che i valori usati nei test coincidano con il seed delle migrazioni.

## Cosa esce
**Parte `public`: l'unica che si può pubblicare o stampare nei log.**
- Esito della run (`clustered` o `insufficient`, con il motivo `no_items`, `too_few_participants`, `no_structure` o `all_groups_below_share`), numero di persone e di item considerati, k scelto, silhouette e il segnale `single_group_at_share`.
- Per ogni gruppo: solo l'etichetta ("Gruppo 1"), quante persone contiene e se è sotto quota.
- Per ogni item: voti totali, d'accordo, contrari, passo, approvazione totale, p_agree di ogni gruppo (vuoto per i gruppi sotto quota e per le celle sotto soglia), bridging score, classificazione, stabilità.

Un test verifica che la parte `public` serializzata non contenga nessuno pseudo dell'input.

**Parte `private`: contiene pseudo, va solo nelle tabelle dello schema `private` (accessibili solo al service role), mai pubblicata né loggata.**
- Panel di giuria: numero del panel → `diversity` (sì se costruito sui gruppi della run, no se estratto a caso in una run senza gruppi) + elenco di pseudo in ordine alfabetico.
- Reputazione: pseudo dell'autore → punteggio grezzo (mai mostrato agli utenti).

## Cosa NON si salva
- **A quale gruppo appartiene una persona.** L'assegnazione pseudo → gruppo esiste solo in memoria durante la run e sparisce alla fine. Nessun output la contiene; un test (`engine/test/privacy.test.ts`) controlla l'output serializzato. I panel di giuria non dicono di che gruppo è ciascun membro.
- **La posizione di una persona nel piano 2D** e i centri dei gruppi.
- **Log su singole persone**: il motore non scrive log; chi lo esegue stampa solo la parte `public`. Anche i messaggi d'errore non contengono pseudo.
- **L'orientamento politico**: non viene mai chiesto. I gruppi nascono solo dai voti.

## Limiti dichiarati
- **Chi gestisce il servizio tecnicamente può tutto.** Chi ha la chiave service role o l'accesso alla dashboard di Supabase può leggere e alterare i dati, compresi voti e risultati. Il ruolo admin dell'applicazione non può modificare voti, risultati, Agenda, reputazione o esiti di giuria, ma questo vincolo vale per l'applicazione, non per chi amministra il database. Le modifiche dirette a `platform_config` sono registrate da un trigger nel changelog, ma un superuser del database può disattivare i trigger. La garanzia per chi usa Arengo è la trasparenza (codice pubblico, run e changelog pubblici), non l'impossibilità tecnica.
- **Pseudonimizzazione, non anonimato.** I voti sono salvati con uno pseudo = HMAC(id utente, segreto custodito nel Vault di Supabase). Chi possiede il segreto e la tabella degli utenti può ricollegare voti e persone. Il segreto non si può cambiare senza ricalcolare tutti i voti: se va perso, i voti esistenti non si possono più collegare ai nuovi voti della stessa persona; per questo va conservato un backup fuori dal repository.
- **Conteggi nascosti sotto soglia.** Le viste pubbliche mostrano i conteggi dei voti di un item solo da `min_votes_item` voti in su: con pochissimi voti, confrontare i totali prima e dopo un voto potrebbe rivelare come ha votato qualcuno.
- **Il veto resta possibile a chi controlla almeno `min_cluster_share` dei partecipanti idonei.** Il bridging score è il minimo tra i gruppi a quota. Un blocco di account che supera età e voti minimi e vota compatto forma un proprio gruppo: se è sotto quota viene mostrato ma non conta (test: 50 account in blocco su più di 1000 partecipanti non tolgono lo stato di `ponte` ai 5 item trasversali); se raggiunge la quota, il suo voto contrario impedisce i ponte (test: gli stessi 50 account su 250 partecipanti, il 20%, trasformano quei 5 item in `divisivi`). Questo è voluto: una minoranza ampia deve contare. Per questo contano le difese d'identità: un numero di telefono = un account, CAPTCHA (Turnstile), età minima dell'account, stabilità su più run; il monitoraggio di gruppi nuovi e compatti resta da fare.
- **Diluizione.** La quota è relativa al numero di partecipanti: aggiungere account idonei che votano come la maggioranza fa crescere il totale e può spingere una minoranza reale sotto quota. Con una minoranza di m persone su N partecipanti servono più di m / `min_cluster_share` − N account in più (con il 5%: più di 20·m − N). Esempi: una minoranza al 7% richiede circa 6 volte i suoi membri in account nuovi; una al 5,5% circa 2 volte; più la minoranza è vicina alla quota, meno account servono. Le difese sono le stesse del punto precedente (identità, età minima, stabilità su più run).
- **Un solo gruppo a quota.** Se la quota lascia un solo gruppo, la run non può trovare ponti né item divisivi (`single_group_at_share: true`): per quella run l'Agenda non si aggiorna con nuovi ponti.
- **Un gruppo a quota che non vota un item lo rende `insufficiente`.** Se un gruppo a quota ha meno di `min_votes_per_cluster` voti su un item, quell'item non può essere classificato: un gruppo ampio può quindi "congelare" un item semplicemente non votandolo.
- **Account falsi pazienti.** Il filtro sull'età dell'account e sui voti minimi ferma gli attacchi rapidi, non chi prepara account per settimane. Le difese restano la verifica del telefono (OTP + Turnstile), la stabilità su più run e il monitoraggio.
- **I gruppi sono una semplificazione.** Due dimensioni e k-means riassumono opinioni complesse; con pochi voti o opinioni poco strutturate i gruppi possono essere instabili da una run all'altra. Per questo un item diventa ponte stabile solo dopo `bridging_stable_runs` run consecutive.
- **Il motore divide sempre in almeno `k_min` gruppi** se ci sono abbastanza persone e i voti non sono tutti identici, anche quando le opinioni non sono davvero divise. In quel caso molti item risultano `ponte` o `maggioritario`, il che è coerente: tutti approvano.
- **Giurie meno varie quando i gruppi sono pochi.** Con meno di `jury_min_buckets` gruppi la diversità si ferma ai gruppi esistenti; in una run senza gruppi i panel sono casuali (`diversity: false`, "senza garanzia di diversità").
- **Valori al confine.** I confronti con le soglie sono fatti in virgola mobile: un valore che "sulla carta" è esattamente uguale alla soglia può cadere di pochissimo sopra o sotto.
- **Costo dell'idoneità iterata.** Il filtro partecipanti↔item del passo 1 rilegge tutti i voti a ogni giro: costo proporzionale a voti × giri. Di solito bastano pochi giri; il caso peggiore (un giro per ogni persona o item tolto) è teorico.
- **Costo di calcolo.** La silhouette è calcolata confrontando ogni coppia di persone (costo O(n²)): va bene fino a qualche migliaio di partecipanti. Oltre servirà calcolarla su un campione estratto con il seed della run, così il risultato resta riproducibile (da documentare qui quando introdotto).

## Glossario per non tecnici
- **Seed**: una stringa da cui il programma ricava tutti i numeri "casuali". Con lo stesso seed e gli stessi dati il risultato è sempre identico, quindi chiunque può rifare il calcolo e controllarlo.
- **HMAC**: un modo per trasformare un dato (l'id dell'utente) in un codice illeggibile usando un segreto. Lo stesso utente dà sempre lo stesso codice, ma senza il segreto non si può risalire all'utente.
- **Service role**: la chiave "di servizio" del database, che salta tutte le regole di accesso. La usano solo i processi interni (per esempio il motore notturno), mai il sito.
- **Trigger**: una regola del database che scatta da sola quando un dato cambia; qui registra nel changelog ogni modifica ai parametri.
- **Superuser**: l'amministratore massimo del database, che può fare qualsiasi cosa, compreso spegnere i trigger.
