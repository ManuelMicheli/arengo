"use client";

// Form per le Server Action di scrittura. Invia senza il reset automatico di React 19: dopo un errore
// (anche un blocco del filtro) il testo resta nel campo, solo nel browser. Il server non lo rimanda mai.
import { startTransition, useActionState, type FormEvent, type ReactNode } from "react";
import type { WriteState } from "@/lib/content/write";

export function ActionForm({
  action,
  submitLabel,
  successMessage,
  children,
  className = "flex flex-col gap-4",
}: {
  action: (prev: WriteState, form: FormData) => Promise<WriteState>;
  submitLabel: string;
  successMessage?: string;
  children: ReactNode;
  className?: string;
}) {
  const [state, dispatch, pending] = useActionState(action, {} as WriteState);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(() => dispatch(form));
  }

  return (
    <form onSubmit={onSubmit} className={className}>
      {children}
      {state.error && (
        <p role="alert" className="text-gomma-testo">
          {state.error}
        </p>
      )}
      {state.ok && successMessage && <p role="status">{successMessage}</p>}
      <button type="submit" disabled={pending} className="self-start border border-filo px-4 py-2">
        {submitLabel}
      </button>
    </form>
  );
}
