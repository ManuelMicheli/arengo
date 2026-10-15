// Lettura di platform_config (pubblica in sola lettura). Le soglie stanno solo lì, mai nel codice.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";

export async function readConfig(client: SupabaseClient<Database>, key: string): Promise<Json> {
  const { data, error } = await client.from("platform_config").select("value").eq("key", key).maybeSingle();
  if (error || !data) throw new Error("config_missing");
  return data.value;
}
