"use client";

// Mazzo del giorno (D4): una proposta alla volta, voto subito, risultati dopo il voto (D2), poi "Avanti".
// Il mazzo finisce davvero: niente caricamento infinito.
import Link from "next/link";
import { useState } from "react";
import { ProposalResultsView } from "@/components/proposal-results";
import { VoteButtons } from "@/components/vote-buttons";
import type { ProposalResults } from "@/lib/content/results";
import { voteProposal } from "./proposte/[id]/actions";

export type DeckCard = { proposal_id: string; problem_title: string; topic_title: string; what: string };

export function Deck({ cards }: { cards: DeckCard[] }) {
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<ProposalResults | null>(null);

  if (cards.length === 0) {
    return (
      <section className="flex flex-col gap-2">
        <p>Hai votato tutte le proposte dei temi che segui.</p>
        <Link href="/temi" className="self-start underline">
          Aggiungi un tema
        </Link>
      </section>
    );
  }
  if (index >= cards.length) {
    return (
      <section className="flex flex-col gap-2">
        <p className="text-xl">Per oggi hai finito. Stanotte contiamo i voti.</p>
        <Link href="/temi" className="self-start underline">
          Continua per tema
        </Link>
      </section>
    );
  }

  const card = cards[index]!;
  return (
    <section className="flex flex-col gap-4" aria-label="Mazzo del giorno">
      <p className="text-sm text-grafite-2b tabular-nums">
        {index + 1} di {cards.length} · {card.topic_title}
      </p>
      <p className="text-sm text-grafite-2b">{card.problem_title}</p>
      <h2 className="font-serif text-2xl">{card.what}</h2>
      <Link href={`/proposte/${card.proposal_id}`} className="self-start text-sm underline">
        Come, costo, rischi e argomenti
      </Link>
      <VoteButtons
        key={card.proposal_id}
        initial={null}
        vote={async (value) => {
          const r = await voteProposal(card.proposal_id, value);
          if (r.results) setResults(r.results);
          return { error: r.error };
        }}
      />
      {results && (
        <>
          <ProposalResultsView results={results} />
          <button
            type="button"
            onClick={() => {
              setResults(null);
              setIndex(index + 1);
            }}
            className="min-h-11 self-start border border-filo px-4 py-2"
          >
            Avanti
          </button>
        </>
      )}
    </section>
  );
}
