# Come compilare il lessico del filtro

Il lessico è l'elenco di parole e frasi che il filtro blocca **prima** dell'invio di un messaggio. È riservato: lo vede solo l'admin. Ogni modifica passa da una funzione che chiede una motivazione; il registro pubblico mostra data, azione, livello e motivazione, **mai il termine**.

In questo file non ci sono insulti reali: gli esempi usano parole inventate.

## I livelli (Scala di severità, vedi `docs/BRIEF.md`)

| Livello | Cosa mettere | Quando blocca |
|---|---|---|
| 2 — Insulto a utente | insulti generici; etichette (anche politiche) che diventano offensive se rivolte a qualcuno | solo se il messaggio si rivolge a una persona: "tu sei", "sei un/una/uno", "sei proprio un", "sei solo un", "sei <termine>", "voi siete", "siete dei/delle", "vai a", oppure una menzione `@handle`, entro 4 parole dal termine (`filter_target_window_words`) |
| 3 — Insulto d'odio | insulti per orientamento sessuale, origine, colore, religione, disabilità, genere | sempre |
| 4 — Illecito | minacce, auguri di morte, istigazione | sempre |

Livello 0 (critica dura) e 1 (volgarità non rivolte a persone) non vanno nel lessico: sono ammessi.

## Etichette politiche

Si mettono **solo a livello 2**. "È una proposta *etichettax*" passa; "sei un *etichettax*" viene bloccato. Il filtro non può capire quando un'etichetta è usata come insulto d'odio (livello 3): quello lo valuta la giuria su segnalazione.

## Come si scrive una voce

- Solo lettere minuscole senza accenti, numeri e spazi singoli: `parolaccia`, `frase di prova`.
- `*` vale **esattamente una parola qualsiasi**: `minaccia * finta` blocca "minaccia molto finta", non "minaccia finta" né "minaccia davvero molto finta". Per coprire più lunghezze servono più voci.
- Niente espressioni regolari: vengono rifiutate.
- Massimo 200 caratteri.

## Cosa fa da solo il filtro

Prima del confronto, testo e lessico vengono normalizzati:

- minuscole, senza accenti e senza caratteri invisibili;
- numeri al posto delle lettere dentro le parole: `0d1o` diventa `odio` (`0→o 1→i 3→e 4→a 5→s 7→t @→a $→s`);
- lettere ripetute ridotte a una sola: `brutttto` diventa `bruto`;
- lettere singole separate dallo stesso segno vengono riunite: `p.a.r.o.l.a` diventa `parola` (almeno 3 lettere, `filter_letter_join_min_run`).

Quindi non serve scrivere le varianti con numeri, accenti o lettere ripetute.

## Cosa NON fa

- **Confronta parole intere.** `parola` non blocca `parolaccia` né `parolone`.
- **Non riconosce plurali, femminili e coniugazioni.** Vanno elencati uno per uno: `parolaccio`, `parolaccia`, `parolacci`, `parolacce`.
- I numeri da soli restano numeri: la voce `88` blocca "88", non "1988" né "8".

## Termini ambigui

Evita parole che sono anche nomi comuni, cognomi o luoghi: bloccherebbero frasi innocue. Se una parola è offensiva solo in un certo contesto, scrivi la **frase** invece della parola singola (es. `sei un * parolaccia`).

## Pausa di scrittura

Dopo `filter_l3_blocks_pause` blocchi di livello 3 o 4 nelle ultime `filter_strike_window_hours` ore, l'utente non può scrivere per `filter_pause_minutes` minuti. Ogni nuovo blocco grave dentro la finestra fa ripartire la pausa. Non vengono salvati né il testo né il termine che ha causato il blocco.
