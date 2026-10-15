"use client";

import { useState, useTransition } from "react";
import { supportProblem, voteReformulation } from "./actions";

export function SupportButton({ problemId, supported }: { problemId: string; supported: boolean }) {
  const [done, setDone] = useState(supported);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (done) return <p role="status">Hai sostenuto questo problema.</p>;
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await supportProblem(problemId);
            if (r.error) setError(r.error);
            else setDone(true);
          })
        }
        className="min-h-11 self-start border border-filo px-4 py-2"
      >
        Sostieni
      </button>
      {error && (
        <p role="alert" className="text-gomma-testo">
          {error}
        </p>
      )}
    </div>
  );
}

export function ReformulationVote({
  reformulationId,
  problemId,
  initial,
}: {
  reformulationId: string;
  problemId: string;
  initial: 1 | -1 | null;
}) {
  const [current, setCurrent] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const choose = (value: 1 | -1) =>
    start(async () => {
      const r = await voteReformulation(reformulationId, problemId, value);
      if (r.error) setError(r.error);
      else {
        setError(null);
        setCurrent(value);
      }
    });
  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-label="Quale testo preferisci" className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={current === 1} disabled={pending} onClick={() => choose(1)} className="min-h-11 border border-filo px-3 py-2">
          Preferisco questa versione
        </button>
        <button type="button" aria-pressed={current === -1} disabled={pending} onClick={() => choose(-1)} className="min-h-11 border border-filo px-3 py-2">
          Preferisco il testo attuale
        </button>
      </div>
      {error && (
        <p role="alert" className="text-gomma-testo">
          {error}
        </p>
      )}
    </div>
  );
}
