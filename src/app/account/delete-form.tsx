"use client";

import { useActionState } from "react";
import { deleteAccount, type DeleteState } from "./actions";

export function DeleteForm() {
  const [state, action, pending] = useActionState(deleteAccount, {} as DeleteState);
  return (
    <form action={action} className="flex flex-col gap-2">
      <label className="flex gap-2">
        <input type="checkbox" name="confirm" />
        Ho capito: la cancellazione è definitiva.
      </label>
      {state.error && <p role="alert">{state.error}</p>}
      <button type="submit" disabled={pending} className="border p-2">
        Cancella il mio account
      </button>
    </form>
  );
}
