"use client";

import { useState, useTransition } from "react";
import { rateArgument } from "./actions";

export function ArgumentRating({ argumentId, proposalId, initial }: { argumentId: string; proposalId: string; initial: boolean | null }) {
  const [current, setCurrent] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const choose = (useful: boolean) =>
    start(async () => {
      const r = await rateArgument(argumentId, proposalId, useful);
      if (r.error) setError(r.error);
      else {
        setError(null);
        setCurrent(useful);
      }
    });
  return (
    <div className="flex flex-col gap-1">
      <div role="group" aria-label="Questo argomento è utile?" className="flex gap-2 text-sm">
        <button type="button" aria-pressed={current === true} disabled={pending} onClick={() => choose(true)} className="min-h-11 border border-filo px-3">
          Utile
        </button>
        <button type="button" aria-pressed={current === false} disabled={pending} onClick={() => choose(false)} className="min-h-11 border border-filo px-3">
          Non utile
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-gomma-testo">
          {error}
        </p>
      )}
    </div>
  );
}
