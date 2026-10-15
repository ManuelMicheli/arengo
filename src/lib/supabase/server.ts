// Client Supabase con la sessione dell'utente (cookie), per Server Component, Server Action e Route Handler.
// Le scritture dei cookie falliscono nei Server Component: lì la sessione la rinfresca proxy.ts.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { publicSupabaseEnv } from "./env";

export async function createUserClient() {
  const cookieStore = await cookies();
  const { url, key } = publicSupabaseEnv();
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Server Component: cookie in sola lettura.
        }
      },
    },
  });
}
