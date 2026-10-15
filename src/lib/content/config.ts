// Soglie da platform_config per i testi delle pagine ("si apre con {problem_support_threshold} sostegni").
// Mai numeri fissi nel codice: se una chiave manca la pagina fallisce in modo esplicito.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export async function readNumbers<K extends string>(client: SupabaseClient<Database>, keys: readonly K[]): Promise<Record<K, number>> {
  const { data, error } = await client.from("platform_config").select("key, value").in("key", keys as readonly string[]);
  if (error) throw new Error("config_missing");
  const map = new Map(data.map((r) => [r.key, r.value]));
  const out = {} as Record<K, number>;
  for (const k of keys) {
    const v = map.get(k);
    if (typeof v !== "number") throw new Error("config_missing");
    out[k] = v;
  }
  return out;
}

export async function readRateLimits(client: SupabaseClient<Database>): Promise<Record<string, number>> {
  const { data, error } = await client.from("platform_config").select("value").eq("key", "rate_limits").maybeSingle();
  if (error || !data || typeof data.value !== "object" || data.value === null || Array.isArray(data.value)) {
    throw new Error("config_missing");
  }
  return data.value as Record<string, number>;
}
