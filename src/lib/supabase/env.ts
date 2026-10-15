// Variabili d'ambiente di Supabase (elenco in .env.example). Errori espliciti se mancano.

export function publicSupabaseEnv(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("supabase_env_missing");
  return { url, key };
}

export function secretSupabaseKey(): string {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("supabase_secret_missing");
  return key;
}
