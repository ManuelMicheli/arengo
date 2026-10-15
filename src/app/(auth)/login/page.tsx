import type { Metadata } from "next";
import { safeNext } from "@/lib/safe-next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Accedi · Arengo" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const raw = (await searchParams).next;
  const next = safeNext(Array.isArray(raw) ? raw[0] : raw);
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">Accedi o registrati</h1>
      <p>
        Usiamo il numero di cellulare solo per verificare che ogni persona abbia un solo account. Il numero non è mai
        mostrato ad altri.
      </p>
      <LoginForm next={next === "/" ? undefined : next} />
    </main>
  );
}
