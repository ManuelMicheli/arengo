# Brief — Arengo

Stato: approvato
Tipo: B prodotto (piattaforma civica, non profit)
Ultimo aggiornamento: 2026-10-13

> Fonte di verità dei requisiti. Se cambia un requisito, si modifica QUI prima del codice. Origine: `docs/archive/prompt-arengo.md` (superato).
> Payoff: "il terreno comune degli italiani". Dominio: arengo.org.

## Problema
Il dibattito politico online premia polarizzazione e engagement. Manca un luogo dove italiani di idee diverse discutano e scoprano su quali soluzioni concrete sono d'accordo.

## Utenti
- Chi usa: maggiorenni residenti in Italia (autodichiarazione + numero di telefono verificato).
- Chi decide: Manuel (gestore), vincolato dai principi in `AGENTS.md` e dalla config pubblica.

## Successo (osservabile)
- Un utente verificato crea un problema, che si attiva dopo N sostegni; altri propongono soluzioni, votano e argomentano.
- La run notturna del motore classifica le proposte (ponte / divisivo / maggioritario / nessun consenso / insufficiente) e genera un'Agenda versionata per tema.
- Nessuna query di anon, utente o admin applicativo restituisce voti individuali (dimostrato da test pgTAP in CI).
- Su dati sintetici (2 gruppi polarizzati, 200 utenti) il motore trova le proposte ponte; 50 account nuovi che votano in blocco non cambiano la classificazione.

## Glossario
- **Tema**: macro-area (es. "Lavoro", "Casa"). Creato solo dall'admin, con criterio di selezione pubblico.
- **Problema**: situazione misurabile, senza aggettivi valutativi e senza presupporre la soluzione. Diventa attivo dopo `problem_support_threshold` sostegni.
- **Riformulazione**: nuovo testo proposto per un problema; accettata se votata più del testo attuale con almeno `reformulation_min_votes` voti.
- **Scheda**: fatti con fonte obbligatoria collegati a un problema, approvati dai curatori.
- **Proposta**: soluzione strutturata (cosa, come, costo e copertura, rischi, esempio estero opzionale). Autore mai mostrato.
- **Argomento**: testo pro o contro una proposta (≤400 car.); si valuta per utilità, non per accordo.
- **Piazza**: discussione per tema/problema, thread a 2 livelli; messaggi votabili (d'accordo / contrario / passo) che alimentano il motore.
- **Bar**: chiacchiere non votabili, fuori dal motore, autocancellate dopo `bar_retention_days`.
- **Motore di consenso**: job notturno (PCA + k-means sulla matrice dei voti) che calcola l'approvazione per gruppo d'opinione.
- **Proposta ponte**: approvazione minima tra tutti i gruppi ≥ `bridging_threshold`, stabile per `bridging_stable_runs` run consecutive.
- **Agenda**: documento versionato per tema: problemi, proposte ponte, migliori argomenti, disaccordi aperti.
- **Curatore**: utente idoneo sorteggiato, mandato di `curator_term_months`; struttura, unisce doppioni, verifica fonti. NON può bloccare o nascondere contenuti.
- **Giuria**: `jury_size` utenti (da panel pre-estratti) da almeno min(`jury_min_buckets`, k) gruppi diversi, dove k è il numero di gruppi trovati dalla run; decidono sulle segnalazioni di livello 2-3. Nelle run senza gruppi (dati insufficienti) la giuria è estratta a caso tra gli idonei e marcata "senza garanzia di diversità" nel registro pubblico.

## Scala di severità (pubblica: filtro, giurie, sanzioni)
- **0 Duro** — ammesso. Critica forte a idee, leggi, partiti.
- **1 Scaldato** — ammesso. Volgarità non rivolte a persone.
- **2 Insulto a utente** — bloccato all'invio con invito a riformulare. Se passa e viene segnalato: giuria.
- **3 Insulto d'odio** — per orientamento sessuale, origine, colore, religione, disabilità, genere, o appartenenza politica usata come insulto. Bloccato; se segnalato: giuria → sanzione.
- **4 Illecito** — minacce, auguri di morte, accuse di fatti non provati a persone reali, dati personali altrui, istigazione. Rimozione + coda admin (obbligo DSA).
Regola chiave: un'etichetta politica che descrive un'idea è ammessa ("è una proposta comunista"); usata per colpire una persona è livello 3. Figure pubbliche: critica alle azioni libera; insulto personale e accuse non provate no.

## Must-have v1
Auth OTP + onboarding con consensi; temi, problemi, riformulazioni, schede, proposte, voti, argomenti, ricerca full-text; Piazza e Bar; filtro pre-invio; motore notturno; segnalazioni, giurie, sanzioni, ricorsi; curatori a sorteggio; Agenda versionata; pagine di trasparenza; admin limitato; export e cancellazione account. Dettaglio per milestone in `docs/PLAN.md`.

## Fuori scope v1
Chatbot/LLM, SPID/CIE, notifiche push, app mobile, messaggi privati, profili pubblici, monetizzazione, design grafico (lo fa Manuel dopo).

## Vincoli
- Repo pubblico, licenza AGPL-3.0. Zero segreti nel repo.
- Niente Docker in locale: test DB in CI, app su progetto Supabase dev remoto.
- Legali: GDPR art. 9 (consenso esplicito: i voti su temi politici possono rivelare opinioni), DSA per contenuti illeciti. Testi in `content/legal/` con `[DA VERIFICARE CON LEGALE]`.
- Privacy by design: vedi principi 2, 3, 9 in `AGENTS.md`.

## Unknown aperti
| Domanda | Chi risponde | Blocca |
|---|---|---|
| Provider SMS per OTP e costo per messaggio | Manuel | M3 (in dev si usa numero di test Supabase) |
| Chiave Cloudflare Turnstile | Manuel | M3 (in dev chiavi di test) |
| Testi legali (privacy, termini, informativa art. 9, DPIA) | legale | beta, non lo sviluppo |
| Cancellazione account: contenuti pubblici cancellati o anonimizzati (default: anonimizzati) | legale | M3 (flag in config) |
| Lista iniziale `lexicon_terms` | Manuel | test reali del filtro (M2 usa termini fittizi nei test) |
| 3-5 temi iniziali con criterio esterno (ISTAT/Censis/Eurobarometro) + problemi + schede | Manuel | seed contenuti beta |
| Registrazione arengo.org, marchi UIBM/EUIPO, handle social | Manuel | lancio pubblico |
| Gruppo beta 50-200 persone | Manuel | beta |
