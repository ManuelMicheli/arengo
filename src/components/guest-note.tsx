import Link from "next/link";
import type { ViewerState } from "@/lib/content/viewer";

// Al posto dell'azione per chi non può ancora votare o scrivere: dice cosa fare, con ritorno alla pagina.
export function GuestNote({ state, next, action }: { state: ViewerState; next: string; action: string }) {
  if (state === "anonymous") {
    return (
      <p>
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="underline">
          Entra con il tuo numero
        </Link>{" "}
        per {action}.
      </p>
    );
  }
  if (state === "incomplete") {
    return (
      <p>
        <Link href="/onboarding" className="underline">
          Completa la registrazione
        </Link>{" "}
        per {action}.
      </p>
    );
  }
  return null;
}
