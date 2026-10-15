// Risultati di una proposta (D2): conteggi solo sopra soglia, sempre come testo (mai solo colore),
// e un argomento per lato. Nessuna classificazione prima della run del motore (M6).
import type { ProposalResults } from "@/lib/content/results";

const pct = (n: number, total: number) => `${Math.round((n / total) * 100)}%`;

export function ProposalResultsView({ results }: { results: ProposalResults }) {
  return (
    <section aria-label="Risultati" className="flex flex-col gap-3">
      {results.belowThreshold || results.total === null || results.total === 0 ? (
        <p className="text-grafite-2b">Pochi voti per ora: i risultati compaiono da {results.minVotes} voti.</p>
      ) : (
        <dl className="grid grid-cols-3 gap-2 tabular-nums">
          <div>
            <dt className="text-sm text-grafite-2b">D&apos;accordo</dt>
            <dd>{pct(results.agree ?? 0, results.total)}</dd>
          </div>
          <div>
            <dt className="text-sm text-grafite-2b">Contrari</dt>
            <dd>{pct(results.disagree ?? 0, results.total)}</dd>
          </div>
          <div>
            <dt className="text-sm text-grafite-2b">Passano</dt>
            <dd>{pct(results.pass ?? 0, results.total)}</dd>
          </div>
        </dl>
      )}
      {(results.topPro || results.topContro) && (
        <div className="flex flex-col gap-2">
          {results.topPro && (
            <blockquote className="border-l border-filo pl-3">
              <p className="text-sm text-grafite-2b">{results.ranked ? "L'argomento a favore più utile" : "Un argomento a favore"}</p>
              <p className="font-serif text-lg">{results.topPro.body}</p>
            </blockquote>
          )}
          {results.topContro && (
            <blockquote className="border-l border-filo pl-3">
              <p className="text-sm text-grafite-2b">{results.ranked ? "L'argomento contrario più utile" : "Un argomento contrario"}</p>
              <p className="font-serif text-lg">{results.topContro.body}</p>
            </blockquote>
          )}
        </div>
      )}
    </section>
  );
}
