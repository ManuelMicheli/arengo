"use client";

// Tre scelte di pari peso (d'accordo / contrario / passo), sempre modificabili. Resa minima: la casella
// con la croce a matita la disegna la sessione design sostituendo solo l'aspetto dei pulsanti.
import { useState, useTransition } from "react";

export type VoteValue = -1 | 0 | 1;
const FIRST_VOTE_KEY = "arengo_primo_voto";
const OPTIONS: { value: VoteValue; label: string }[] = [
  { value: 1, label: "D'accordo" },
  { value: -1, label: "Contrario" },
  { value: 0, label: "Passo" },
];

export function VoteButtons({
  initial,
  vote,
  onVoted,
}: {
  initial: VoteValue | null;
  vote: (value: VoteValue) => Promise<{ error?: string }>;
  onVoted?: (value: VoteValue) => void;
}) {
  const [current, setCurrent] = useState<VoteValue | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [firstVote, setFirstVote] = useState(false);

  function choose(value: VoteValue) {
    startTransition(async () => {
      const result = await vote(value);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setCurrent(value);
      onVoted?.(value);
      // Al primo voto di sempre, una sola volta: preferenza locale del browser, non va al server.
      try {
        if (!localStorage.getItem(FIRST_VOTE_KEY)) {
          localStorage.setItem(FIRST_VOTE_KEY, "1");
          setFirstVote(true);
        }
      } catch {
        // Archiviazione del browser non disponibile: la nota resta comunque nella pagina della proposta.
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-label="Il tuo voto" className="flex gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={current === o.value}
            disabled={pending}
            onClick={() => choose(o.value)}
            className="min-h-11 min-w-11 flex-1 border border-filo px-3 py-2 aria-pressed:border-grafite-6b aria-pressed:font-semibold"
          >
            {o.label}
          </button>
        ))}
      </div>
      {firstVote && <p role="status">Nessuno vede come hai votato: contano solo i totali.</p>}
      {current === 0 && <p className="text-sm text-grafite-2b">Passi, va benissimo. Anche questo aiuta il calcolo.</p>}
      <p className="text-sm text-grafite-2b">Puoi cambiarlo quando vuoi: stanotte contiamo quello che c&apos;è.</p>
      {error && (
        <p role="alert" className="text-gomma-testo">
          {error}
        </p>
      )}
    </div>
  );
}
