"use client";

import { useActionState, type ReactNode } from "react";
import { completeOnboarding, type OnboardingState } from "./actions";

export function OnboardingForm({
  rulesVersion,
  rules,
  consent,
}: {
  rulesVersion: string;
  rules: ReactNode;
  consent: ReactNode;
}) {
  const [state, action, pending] = useActionState(completeOnboarding, {} as OnboardingState);
  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="rules_version" value={rulesVersion} />

      <fieldset className="flex flex-col gap-2 border p-3">
        <legend className="font-semibold">Passo 1 di 3 · Età</legend>
        <label className="flex gap-2">
          <input type="checkbox" name="adult" />
          Dichiaro di avere almeno 18 anni e di risiedere in Italia.
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-2 border p-3">
        <legend className="font-semibold">Passo 2 di 3 · Regole e Scala di severità</legend>
        <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">{rules}</div>
        <label className="flex gap-2">
          <input type="checkbox" name="rules" />
          Ho letto e accetto le regole e la Scala di severità.
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-2 border p-3">
        <legend className="font-semibold">Passo 3 di 3 · Consenso per i dati sulle opinioni politiche</legend>
        <div className="flex flex-col gap-2">{consent}</div>
        <label className="flex gap-2">
          <input type="checkbox" name="consent_art9" />
          Acconsento al trattamento dei miei voti come descritto sopra (art. 9 GDPR).
        </label>
      </fieldset>

      <label className="flex flex-col gap-1">
        Nome utente (pubblico)
        <input name="handle" required minLength={3} maxLength={20} pattern="[A-Za-z0-9_]+" className="border p-2" />
      </label>

      {state.error && <p role="alert">{state.error}</p>}
      <button type="submit" disabled={pending} className="border p-2">
        Completa la registrazione
      </button>
    </form>
  );
}
