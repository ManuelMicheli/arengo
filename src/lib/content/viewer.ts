// Chi sta guardando la pagina: ospite, registrazione incompleta, o utente che può votare.
// Solo per la UX: il controllo vero lo fanno le RPC (assert_can_vote / assert_can_write_user).
import { cookies } from "next/headers";
import { SEED_COOKIE } from "@/lib/seed-order";
import { createUserClient } from "@/lib/supabase/server";

export type ViewerState = "anonymous" | "incomplete" | "deleted" | "complete";

export async function getViewer() {
  const supabase = await createUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let state: ViewerState = "anonymous";
  if (user) {
    const { data } = await supabase.rpc("my_onboarding_status");
    state = data === "complete" || data === "deleted" || data === "incomplete" ? data : "incomplete";
  }
  const seed = (await cookies()).get(SEED_COOKIE)?.value ?? "senza-seed";
  return { supabase, user, state, seed };
}
