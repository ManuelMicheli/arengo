// M3: login OTP (numeri di test in supabase/config.toml), onboarding obbligatorio, export, cancellazione,
// rate limit OTP. Seriale: il limite per IP è condiviso da tutti i test.
import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

async function login(page: Page, phone: string) {
  await page.goto("/login");
  await page.getByLabel("Numero di cellulare").fill(phone);
  await page.getByRole("button", { name: "Invia il codice" }).click();
  await page.getByLabel("Codice").fill("123456");
  await page.getByRole("button", { name: "Accedi" }).click();
}

test("login con numero di test porta all'onboarding; senza onboarding si torna lì", async ({ page }) => {
  await login(page, "3000000001");
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.goto("/account");
  await expect(page.getByText("Disponibile dopo aver completato la registrazione.")).toBeVisible();
});

test("onboarding: conferme obbligatorie, poi export e cancellazione", async ({ page }) => {
  await login(page, "3000000002");
  await expect(page).toHaveURL(/\/onboarding$/);
  // Checkbox non preselezionate
  for (const box of await page.getByRole("checkbox").all()) await expect(box).not.toBeChecked();

  await page.getByLabel("Nome utente (pubblico)").fill("utente_e2e");
  await page.getByRole("checkbox", { name: /almeno 18 anni/ }).check();
  await page.getByRole("checkbox", { name: /accetto le regole/ }).check();
  await page.getByRole("button", { name: "Completa la registrazione" }).click();
  await expect(page.locator("main [role=alert]")).toContainText("consenso art. 9");

  await page.getByRole("checkbox", { name: /Acconsento/ }).check();
  await page.getByRole("button", { name: "Completa la registrazione" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/account");
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Scarica i miei dati" }).click();
  const file = await (await download).path();
  const data = JSON.parse(await (await import("node:fs/promises")).readFile(file, "utf8"));
  expect(data.profile.handle).toBe("utente_e2e");
  expect(JSON.stringify(data)).not.toContain("3000000002");

  await page.getByRole("checkbox", { name: /definitiva/ }).check();
  await page.getByRole("button", { name: "Cancella il mio account" }).click();
  await expect(page).toHaveURL(/account=eliminato/);
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login$/);
});

test("oltre il limite di richieste OTP per IP → 429", async ({ page }) => {
  // Numeri diversi fuori da test_otp: ogni richiesta conta per l'IP (Arengo) e non tocca il limite
  // per numero di Supabase; l'invio fallisce (provider fittizio) finché scatta il nostro limite.
  await page.goto("/login");
  let status: string | null = null;
  for (let i = 0; i < 10 && status !== "429"; i++) {
    await page.getByLabel("Numero di cellulare").fill(`33300000${10 + i}`);
    await page.getByRole("button", { name: "Invia il codice" }).click();
    const alert = page.locator("main [role=alert]");
    await expect(alert).toBeVisible();
    status = await alert.getAttribute("data-status");
  }
  expect(status).toBe("429");
  await expect(page.locator("main [role=alert]")).toContainText("Troppe richieste");
});
