import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createUserClient } from "@/lib/supabase/server";
import { DeleteForm } from "./delete-form";

export const metadata: Metadata = { title: "Account · Arengo" };

export default async function AccountPage() {
  const supabase = await createUserClient();
  const { data: status } = await supabase.rpc("my_onboarding_status");
  if (status === "anonymous") redirect("/login");

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-4">
      <h1 className="text-2xl font-semibold">Il tuo account</h1>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Scarica i tuoi dati</h2>
        <p>Un file JSON con profilo, contenuti che hai scritto e i tuoi voti.</p>
        {status === "complete" ? (
          <a href="/account/export" download className="underline">
            Scarica i miei dati
          </a>
        ) : (
          <p>Disponibile dopo aver completato la registrazione.</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Revoca del consenso e cancellazione</h2>
        <p>
          Revocare il consenso al trattamento dei voti (art. 9) significa cancellare l&apos;account: senza consenso non
          possiamo conservare i tuoi voti.
        </p>
        <ul className="list-disc pl-5">
          <li>Eliminati: voti, sostegni, valutazioni, messaggi del Bar, numero di telefono.</li>
          <li>Problemi, proposte, argomenti e messaggi della Piazza restano senza autore (&quot;utente eliminato&quot;).</li>
        </ul>
        <DeleteForm />
      </section>
    </main>
  );
}
