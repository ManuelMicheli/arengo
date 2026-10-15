// Numero di cellulare italiano in formato E.164 (+393…). Il numero resta solo in auth.users.
import { z } from "zod";

export const phoneSchema = z
  .string()
  .transform((s) => s.replace(/[\s.\-()]/g, ""))
  .transform((s) => (s.startsWith("0039") ? `+39${s.slice(4)}` : /^3\d+$/.test(s) ? `+39${s}` : s))
  .pipe(z.string().regex(/^\+393\d{8,9}$/, "Inserisci un numero di cellulare italiano valido."));

export const otpCodeSchema = z.string().trim().regex(/^\d{6}$/, "Il codice è di 6 cifre.");
