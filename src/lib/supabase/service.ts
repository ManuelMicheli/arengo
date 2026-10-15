// Client service role: solo lato server, solo per RPC riservate al server (record_filter_block,
// complete_onboarding, delete_account, pseudo_secret_is_test) e letture non esposte (lessico).
// L'utente passato alle RPC viene sempre da supabase.auth.getUser() lato server, mai dal client.

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { publicSupabaseEnv, secretSupabaseKey } from "./env";

export function createServiceClient() {
  if (typeof window !== "undefined") throw new Error("service_client_on_browser");
  const { url } = publicSupabaseEnv();
  return createClient<Database>(url, secretSupabaseKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
