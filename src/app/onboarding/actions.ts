"use server";

import { redirect } from "next/navigation";
import { guardContent } from "@/lib/moderation/guard";
import { createModerationDeps } from "@/lib/moderation/supabase-deps";
import { createUserClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { onboardingSchema } from "./schema";

// `values`: React azzera il form dopo ogni invio; il form li usa come default per non far ripartire da capo.
export type OnboardingValues = { handle: string; adult: boolean; rules: boolean; consent_art9: boolean };
export type OnboardingState = { error?: string; values?: OnboardingValues };

const RPC_ERRORS: Record<string, string> = {
  handle_taken: "Questo nome utente è già in uso.",
  rules_version_mismatch: "Le regole sono state aggiornate: ricarica la pagina e rileggile.",
  consent_required: "Servono tutte e tre le conferme.",
  onboarding_already_complete: "Hai già completato la registrazione.",
  account_deleted: "Questo account è stato cancellato.",
  invalid_value: "Nome utente non valido.",
};

export async function completeOnboarding(_prev: OnboardingState, form: FormData): Promise<OnboardingState> {
  const supabase = await createUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const values: OnboardingValues = {
    handle: String(form.get("handle") ?? "").slice(0, 40),
    adult: form.get("adult") === "on",
    rules: form.get("rules") === "on",
    consent_art9: form.get("consent_art9") === "on",
  };
  const parsed = onboardingSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, values };
  const { handle, rules_version } = parsed.data;

  const service = createServiceClient();
  // Il nome utente è un testo pubblico: passa dal filtro. Mai loggato se bloccato.
  const guard = await guardContent(
    handle,
    "handle",
    createModerationDeps({ userClient: supabase, serviceClient: service, userId: user.id }),
  );
  // Handle bloccato dal filtro: non lo rimandiamo indietro.
  if (!guard.ok) return { error: guard.message, values: { ...values, handle: "" } };

  const { error } = await service.rpc("complete_onboarding", {
    user_id: user.id,
    handle,
    rules_version,
    adult: true,
    consent_art9: true,
  });
  if (error) {
    const known = Object.keys(RPC_ERRORS).find((code) => error.message.includes(code));
    return { error: known ? RPC_ERRORS[known] : "Registrazione non riuscita. Riprova.", values };
  }
  redirect("/");
}
