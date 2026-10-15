import type { Metadata } from "next";
import { LegalText } from "@/components/legal-text";
import { loadLegal } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy · Arengo" };

export default async function PrivacyPage() {
  const [privacy, consent] = await Promise.all([loadLegal("privacy"), loadLegal("consenso-art9")]);
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-3 p-4">
      <LegalText blocks={privacy} />
      <LegalText blocks={consent} />
    </main>
  );
}
