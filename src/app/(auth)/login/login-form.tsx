"use client";

import { useActionState } from "react";
import { Turnstile } from "@/components/turnstile";
import { sendOtp, verifyOtp, type LoginState } from "./actions";

const initial: LoginState = { step: "phone" };

export function LoginForm() {
  const [sent, send, sending] = useActionState(sendOtp, initial);
  const [verified, verify, verifying] = useActionState(verifyOtp, initial);
  const codeStep = sent.step === "code";

  if (!codeStep) {
    return (
      <form action={send} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          Numero di cellulare
          <input name="phone" type="tel" defaultValue={sent.phone ?? ""} autoComplete="tel" required className="border p-2" placeholder="333 123 4567" />
        </label>
        <Turnstile resetKey={sent} />
        {sent.error && (
          <p role="alert" data-status={sent.status}>
            {sent.error}
          </p>
        )}
        <button type="submit" disabled={sending} className="border p-2">
          Invia il codice
        </button>
      </form>
    );
  }

  return (
    <form action={verify} className="flex flex-col gap-3">
      <input type="hidden" name="phone" value={sent.phone} />
      <p>Abbiamo inviato un codice di 6 cifre al numero indicato.</p>
      <label className="flex flex-col gap-1">
        Codice
        <input name="code" inputMode="numeric" autoComplete="one-time-code" required className="border p-2" />
      </label>
      {verified.error && (
        <p role="alert" data-status={verified.status}>
          {verified.error}
        </p>
      )}
      <button type="submit" disabled={verifying} className="border p-2">
        Accedi
      </button>
    </form>
  );
}
