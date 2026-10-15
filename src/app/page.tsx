import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-col gap-2 p-4">
      <h1 className="text-2xl font-bold">Arengo</h1>
      <p>Discutere di politica per trovare soluzioni condivise.</p>
      <nav className="flex gap-4">
        <Link href="/login" className="underline">
          Accedi
        </Link>
        <Link href="/account" className="underline">
          Account
        </Link>
        <Link href="/privacy" className="underline">
          Privacy
        </Link>
      </nav>
    </main>
  );
}
