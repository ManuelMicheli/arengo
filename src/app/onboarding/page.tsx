import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LegalText } from "@/components/legal-text";
import { readConfig } from "@/lib/config";
import { loadLegal } from "@/lib/legal";
import { createUserClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Registrazione · Arengo" };

export default async function OnboardingPage() {
  const supabase = await createUserClient();
  const { data: status } = await supabase.rpc("my_onboarding_status");
  if (status === "anonymous") redirect("/login");
  if (status === "complete") redirect("/");
  if (status === "deleted") redirect("/account");

  const rulesVersion = await readConfig(supabase, "current_rules_version");
  if (typeof rulesVersion !== "string") throw new Error("config_invalid");
  const [rules, consent] = await Promise.all([loadLegal("regole"), loadLegal("consenso-art9")]);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">Completa la registrazione</h1>
      <p>Finché non completi questi tre passi puoi leggere, ma non votare né scrivere.</p>
      <OnboardingForm
        rulesVersion={rulesVersion}
        rules={<LegalText blocks={rules} headingOffset={1} />}
        consent={<LegalText blocks={consent} headingOffset={1} />}
      />
    </main>
  );
}
