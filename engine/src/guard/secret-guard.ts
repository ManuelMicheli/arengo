// Guardia di avvio del runner (M6): in produzione il motore rifiuta di partire se il segreto dei pseudo
// è il valore di test di supabase/seed.sql. Il controllo vero lo fa il DB (RPC pseudo_secret_is_test,
// solo service role): qui arriva solo il booleano, mai il segreto.

export type SecretGuardEnv = Readonly<Record<string, string | undefined>>;

export function isProductionEnv(env: SecretGuardEnv): boolean {
  return env.ARENGO_ENV === "production" || env.VERCEL_ENV === "production";
}

export async function assertProductionSecret(env: SecretGuardEnv, isTestSecret: () => Promise<boolean>): Promise<void> {
  if (!isProductionEnv(env)) return;
  let isTest: boolean;
  try {
    isTest = await isTestSecret();
  } catch {
    throw new Error("Guardia segreto: impossibile verificare vote_pseudo_secret in produzione; avvio interrotto.");
  }
  if (isTest) {
    throw new Error(
      "Guardia segreto: vote_pseudo_secret è il valore di test di supabase/seed.sql. Avvio in produzione rifiutato (vedi supabase/AGENTS.md).",
    );
  }
}
