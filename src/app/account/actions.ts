"use server";

import { redirect } from "next/navigation";
import { createUserClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export type DeleteState = { error?: string };

export async function deleteAccount(_prev: DeleteState, form: FormData): Promise<DeleteState> {
  if (form.get("confirm") !== "on") return { error: "Conferma la cancellazione spuntando la casella." };
  const supabase = await createUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  // Prima il DB (voti via pseudo, Bar, anonimizzazione), poi l'utente di Auth (cascade su profilo e strike).
  const { error } = await service.rpc("delete_account", { user_id: user.id });
  if (error) return { error: "Cancellazione non riuscita. Riprova." };
  // Logout prima di eliminare l'utente di Auth: dopo, il token non è più revocabile e il cookie resterebbe.
  await supabase.auth.signOut();
  const { error: authError } = await service.auth.admin.deleteUser(user.id);
  if (authError) return { error: "Dati cancellati, ma l'accesso non è stato rimosso. Contatta il supporto." };
  redirect("/?account=eliminato");
}
