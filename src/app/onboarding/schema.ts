import { z } from "zod";
import { HANDLE_MAX_LENGTH, HANDLE_MIN_LENGTH } from "@/lib/handle";

const checked = (message: string) => z.literal("on", { error: message });

export const onboardingSchema = z.object({
  adult: checked("Devi dichiarare di essere maggiorenne."),
  rules: checked("Devi accettare le regole e la Scala di severità."),
  consent_art9: checked("Senza il consenso art. 9 non puoi votare né scrivere."),
  rules_version: z.string().min(1),
  handle: z
    .string()
    .trim()
    .regex(
      new RegExp(`^[A-Za-z0-9_]{${HANDLE_MIN_LENGTH},${HANDLE_MAX_LENGTH}}$`),
      `Il nome utente va da ${HANDLE_MIN_LENGTH} a ${HANDLE_MAX_LENGTH} caratteri: lettere, numeri e _.`,
    ),
});
