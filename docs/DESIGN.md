# Design — Arengo

Sistema visivo "La politica a matita". Token in `src/app/globals.css`, font in `src/app/fonts/`.
Le pagine le disegna Manuel: questo file fissa le regole, non i layout.

## Idea
Ogni idea attraversa tre materiali, e lo stato si riconosce dal materiale, non da un'etichetta.

| Stato | Materiale | Resa |
|---|---|---|
| Proposta in discussione | matita | testo in `grafite-4b`, piccolo segno a matita accanto allo stato |
| Proposta ponte | evidenziatore | una fascia per gruppo d'opinione, nei colori `ev-*` |
| Nell'Agenda | penna | testo in `inchiostro`, timbro con versione e data |

## Regole
- **La griglia è perfetta, la mano no.** Carta: griglia, allineamenti e spaziature rigorosi. Mano: pochi segni a matita, l'unica cosa imperfetta.
- **La matita segna, non scrive.** Grana, filtro grafite e scrittura a mano (`font-mano`) solo su segni (croce del voto, cerchi, sottolineature, stanghette, arco del logo). Testi da leggere sempre nitidi.
- **Un segno per schermata.** Se ce ne sono due, uno va tolto.
- **I bordi sono fili.** 1px `filo`. Niente card con ombra, niente pillole colorate ovunque.
- **Il colore è un evento.** Gli evidenziatori compaiono solo quando un gruppo approva qualcosa.
- **Due voci.** La piattaforma in `font-sans` (Bricolage Grotesque); i testi scritti dagli utenti in `font-serif` (Newsreader).

## Gruppi d'opinione e colore
I colori `ev-*` si assegnano ai gruppi in ordine a ogni run del motore (A giallo, B rosa, C verde, D arancio, E azzurro). Non indicano orientamento, non si salvano associati agli utenti (principio 2) e non vanno mai usati per partiti o persone.

## Illustrazioni
Tavole a grafite su bianco, senza colore, testo, marchi o simboli politici. Poggiano su `lastra` con didascalia, in `mix-blend-mode: multiply`. Mai ritagliate dentro una card o sotto un testo.

## Da evitare
Tricolore e bandiere, rosso contro blu, colori di partito, like e contatori di popolarità, feed infinito, grigi e colori di default di Tailwind.
