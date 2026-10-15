"use server";

import { redirect } from "next/navigation";
import { guardContent } from "@/lib/moderation/guard";
import { createModerationDeps } from "@/lib/moderation/supabase-deps";
import { createUserClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { onboardingSchema } from "./schema";

export type OnboardingState = { error?: string };

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

  const parsed = onboardingSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { handle, rules_version } = parsed.data;

  const service = createServiceClient();
  // Il nome utente è un testo pubblico: passa dal filtro. Mai loggato se bloccato.
  const guard = await guardContent(
    handle,
    "handle",
    createModerationDeps({ userClient: supabase, serviceClient: service, userId: user.id }),
  );
  if (!guard.ok) return { error: guard.message };

  const { error } = await service.rpc("complete_onboarding", {
    user_id: user.id,
    handle,
    rules_version,
    adult: true,
    consent_art9: true,
  });
  if (error) {
    const known = Object.keys(RPC_ERRORS).find((code) => error.message.includes(code));
    return { error: known ? RPC_ERRORS[known] : "Registrazione non riuscita. Riprova." };
  }
  redirect("/");
}
