"use client";

import { useState } from "react";
import { ProposalResultsView } from "@/components/proposal-results";
import { VoteButtons, type VoteValue } from "@/components/vote-buttons";
import type { ProposalResults } from "@/lib/content/results";
import { voteProposal } from "./actions";

// Voto con i risultati subito dopo (D2). Senza voto i risultati non si vedono: prima si sceglie.
export function ProposalVote({
  proposalId,
  initial,
  initialResults,
}: {
  proposalId: string;
  initial: VoteValue | null;
  initialResults: ProposalResults | null;
}) {
  const [results, setResults] = useState(initialResults);
  return (
    <div className="flex flex-col gap-4">
      <VoteButtons
        initial={initial}
        vote={async (value) => {
          const r = await voteProposal(proposalId, value);
          if (r.results) setResults(r.results);
          return { error: r.error };
        }}
      />
      {results && <ProposalResultsView results={results} />}
    </div>
  );
}
