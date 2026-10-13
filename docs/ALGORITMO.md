# Algoritmo del motore di consenso — bozza

Stato: bozza (stream E1). Codice: `engine/src/core/` (funzioni pure), test: `engine/test/`.
Il motore gira di notte; questa pagina spiega in italiano semplice cosa fa, con quali parametri, cosa non salva e quali limiti ha.

## In una frase
Il motore guarda come hanno votato le persone, le divide in gruppi d'opinione anonimi in base a come votano (non a cosa dichiarano), e cerca le proposte approvate da **tutti** i gruppi: le **proposte ponte**.

## Cosa riceve
- I voti, ciascuno come `{pseudo, item, valore}`: `pseudo` è un codice che sostituisce l'utente (vedi "Limiti"), `item` è una proposta o un messaggio della Piazza, il valore è +1 (d'accordo), -1 (contrario) o 0 (passo).
- L'età di ogni account in giorni (associata allo pseudo).
- Lo storico delle classificazioni delle run precedenti, per ogni item.
- Gli pseudo idonei a fare i giurati (il filtro di idoneità si fa prima del motore).
- Gli eventi di reputazione: ogni "utile" a un argomento e ogni "d'accordo" a un messaggio della Piazza, con lo pseudo dell'autore e quello di chi ha votato.
- Un seed (una stringa): tutto ciò che è casuale dipende solo da lui. Stessi dati + stesso seed = stesso risultato, verificabile da chiunque.
- I parametri, letti da `platform_config` (tabella sotto).

## I passi
1. **Chi entra nel calcolo.** Entrano solo gli account con almeno `min_account_age_days_for_engine` giorni di vita e almeno `min_votes_participant` voti. Gli altri votano normalmente, ma il loro voto non entra nel calcolo dei gruppi né nelle classificazioni del motore. Serve contro gli account creati in massa per spostare il risultato. Poi si tengono gli item con almeno `min_votes_item` voti, contando **solo** i voti di chi è entrato nel calcolo.
2. **La tabella dei voti.** Una riga per persona, una colonna per item: +1, -1, 0, vuoto se non ha votato. Per ogni colonna si sottrae la media dei voti presenti; le caselle vuote diventano 0 ("nessuna informazione").
3. **Riduzione a 2 dimensioni (PCA).** La tabella viene riassunta in 2 numeri per persona con l'analisi delle componenti principali (libreria `ml-pca`): chi vota in modo simile finisce vicino. Se le persone nel calcolo sono meno di `min_participants_for_clustering`, il motore si ferma qui: esito `insufficient`, si pubblicano solo le approvazioni totali.
4. **Gruppi (k-means).** I punti vengono divisi in k gruppi, provando ogni k da `k_min` a `k_max`. Si sceglie il k con la silhouette più alta (una misura di quanto i gruppi sono compatti e separati); a parità vince il k più piccolo. L'inizio del k-means (k-means++) usa un generatore casuale deterministico (mulberry32) inizializzato dal seed. I gruppi si chiamano "Gruppo 1", "Gruppo 2", ... in ordine di dimensione: sono numeri, non etichette politiche, e vengono ricalcolati da zero a ogni run.
5. **Accordo per gruppo.** Per ogni item e ogni gruppo con almeno `min_votes_per_cluster` voti sull'item: p_agree = (d'accordo + 1) / (d'accordo + contrari + passo + 2). Il "+1/+2" evita che pochi voti diano 0% o 100%. Il **bridging score** di un item è il p_agree più basso tra i gruppi. Se anche un solo gruppo non ha abbastanza voti, l'item è `insufficiente`.
6. **Classificazione**, nell'ordine:
   - `ponte`: il p_agree più basso è almeno `bridging_threshold` (tutti i gruppi approvano);
   - `divisivo`: la differenza tra il p_agree più alto e il più basso è almeno `divisive_gap`;
   - `maggioritario`: l'approvazione totale (d'accordo / voti, tra chi è nel calcolo) è almeno `majority_threshold`;
   - `nessun_consenso`: tutto il resto.
7. **Stabilità.** Un item è `stable_ponte` se è `ponte` in questa run e nelle `bridging_stable_runs` − 1 run precedenti. Solo le proposte ponte stabili possono entrare nell'Agenda.
8. **Panel di giuria.** Tra gli idonei a fare i giurati, il motore forma panel di `jury_size` persone, ciascuno con persone di almeno `jury_min_buckets` gruppi diversi; se la run ha trovato meno gruppi (k < `jury_min_buckets`), bastano persone di tutti i k gruppi, cioè min(`jury_min_buckets`, k). Si forma il massimo numero di panel possibile, senza ripetere persone. Chi è idoneo ma non è entrato nel calcolo (passo 1) non ha un gruppo e non entra nei panel. Se la run è `insufficient` (nessun gruppo), i panel sono estratti a caso tra tutti gli idonei e marcati `diversity: false`. Il panel esce solo come "panel n → diversity sì/no + elenco di pseudo in ordine alfabetico": nessuna indicazione del gruppo.
9. **Reputazione.** Ogni "utile" a un argomento e ogni "d'accordo" a un messaggio della Piazza dà credito all'autore: `reputation_cross_credit` se chi vota è di un gruppo diverso dall'autore, `reputation_same_credit` se è dello stesso gruppo o se l'autore (o l'intera run) non ha gruppi. Il credito è 0 se chi vota non è entrato nel calcolo (account più giovane di `min_account_age_days_for_engine` o con meno di `min_votes_participant` voti) o se vota sé stesso: così gli account nuovi creati in massa non spostano la reputazione di nessuno. Il credito si dimezza ogni `reputation_half_life_days` giorni. La reputazione sblocca permessi (curatore, giurato), **mai** peso nel voto.
10. **Cosa esce.** Solo dati aggregati (vedi sotto). Il motore non scrive log su singole persone.

Sorteggio dei curatori (usato da M8): tra gli idonei si estrae `curators_count` persone in modo stratificato, cioè ogni gruppo d'opinione riceve posti in proporzione alla sua dimensione (chi non ha gruppo forma uno strato a parte). Il seed è pubblico: sha256(data + id dell'ultima run), così chiunque può rifare il sorteggio.

## Parametri (da `platform_config`)
| Chiave | Valore iniziale | A cosa serve |
|---|---|---|
| `min_account_age_days_for_engine` | 7 | età minima dell'account per entrare nel calcolo |
| `min_votes_participant` | 7 | voti minimi di una persona per entrare nel calcolo |
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
| `jury_min_buckets` | 3 | gruppi diversi minimi in un panel |
| `reputation_half_life_days` | 90 | giorni in cui il credito di reputazione si dimezza |
| `curators_count` | 7 | curatori estratti nel sorteggio stratificato |
| `reputation_cross_credit` | 1 | credito di reputazione da un gruppo diverso — **da aggiungere al seed in M6** |
| `reputation_same_credit` | 0.25 | credito di reputazione dallo stesso gruppo — **da aggiungere al seed in M6** |

Ogni modifica di un parametro passa da `admin_set_config` con motivazione obbligatoria ed è registrata in `config_changelog` (pubblico).

## Cosa esce (e si può pubblicare)
- Esito della run (`clustered` o `insufficient`, con il motivo), numero di persone e di item considerati, k scelto e silhouette.
- Per ogni gruppo: solo l'etichetta ("Gruppo 1") e quante persone contiene.
- Per ogni item: voti totali, d'accordo, contrari, passo, approvazione totale, p_agree di ogni gruppo, bridging score, classificazione, stabilità.
- Panel di giuria: numero del panel → `diversity` (sì se costruito sui gruppi della run, no se estratto a caso in una run senza gruppi) + elenco di pseudo in ordine alfabetico.
- Reputazione: pseudo dell'autore → punteggio.

## Cosa NON si salva
- **A quale gruppo appartiene una persona.** L'assegnazione pseudo → gruppo esiste solo in memoria durante la run e sparisce alla fine. Nessun output la contiene; un test (`engine/test/privacy.test.ts`) controlla l'output serializzato. I panel di giuria non dicono di che gruppo è ciascun membro.
- **La posizione di una persona nel piano 2D** e i centri dei gruppi.
- **Log su singole persone**: il motore non scrive log; chi lo esegue stampa solo numeri aggregati (conteggi, k, silhouette). Anche i messaggi d'errore non contengono pseudo.
- **L'orientamento politico**: non viene mai chiesto. I gruppi nascono solo dai voti.

## Limiti dichiarati
- **Chi gestisce il servizio tecnicamente può tutto.** Chi ha la chiave service role o l'accesso alla dashboard di Supabase può leggere e alterare i dati, compresi voti e risultati. Il ruolo admin dell'applicazione non può modificare voti, risultati, Agenda, reputazione o esiti di giuria, ma questo vincolo vale per l'applicazione, non per chi amministra il database. Le modifiche dirette a `platform_config` sono registrate da un trigger nel changelog, ma un superuser del database può disattivare i trigger. La garanzia per chi usa Arengo è la trasparenza (codice pubblico, run e changelog pubblici), non l'impossibilità tecnica.
- **Pseudonimizzazione, non anonimato.** I voti sono salvati con uno pseudo = HMAC(id utente, segreto custodito nel Vault di Supabase). Chi possiede il segreto e la tabella degli utenti può ricollegare voti e persone. Il segreto non si può cambiare senza ricalcolare tutti i voti: se va perso, i voti esistenti non si possono più collegare ai nuovi voti della stessa persona; per questo va conservato un backup fuori dal repository.
- **Conteggi nascosti sotto soglia.** Le viste pubbliche mostrano i conteggi dei voti di un item solo da `min_votes_item` voti in su: con pochissimi voti, confrontare i totali prima e dopo un voto potrebbe rivelare come ha votato qualcuno.
- **I gruppi sono una semplificazione.** Due dimensioni e k-means riassumono opinioni complesse; con pochi voti o opinioni poco strutturate i gruppi possono essere instabili da una run all'altra. Per questo un item diventa ponte stabile solo dopo `bridging_stable_runs` run.
- **Il motore divide sempre in almeno `k_min` gruppi** se ci sono abbastanza persone, anche quando le opinioni non sono davvero divise. In quel caso molti item risultano `ponte` o `maggioritario`, il che è coerente: tutti approvano.
- **Account falsi pazienti.** Il filtro sull'età dell'account e sui voti minimi ferma gli attacchi rapidi, non chi prepara account per settimane. Le difese restano la verifica del telefono (OTP + Turnstile), la stabilità su più run e il monitoraggio.
- **Valori al confine.** I confronti con le soglie sono fatti in virgola mobile: un valore che "sulla carta" è esattamente uguale alla soglia può cadere di pochissimo sopra o sotto.
- **Costo di calcolo.** La silhouette è calcolata confrontando ogni coppia di persone (costo O(n²)): va bene fino a qualche migliaio di partecipanti. Oltre servirà calcolarla su un campione estratto con il seed della run, così il risultato resta riproducibile (da documentare qui quando introdotto).
- **Giurie meno varie quando i gruppi sono pochi.** Con meno di `jury_min_buckets` gruppi la diversità si ferma ai gruppi esistenti; in una run senza gruppi i panel sono casuali (`diversity: false`).
