// M4: ospite → login con ritorno, temi seguiti dopo l'onboarding (D3), mazzo con risultati (D2, D4),
// voto e argomenti su una proposta, nuovo problema, ricerca. Dati di partenza in global-setup.ts.
import { expect, test, type Page } from "@playwright/test";
import { E2E } from "./global-setup";

test.describe.configure({ mode: "serial" });

const PHONE = "3000000004";

async function enterCode(page: Page, phone: string) {
  await page.getByLabel("Numero di cellulare").fill(phone);
  await page.getByRole("button", { name: "Invia il codice" }).click();
  await page.getByLabel("Codice").fill("123456");
  await page.getByRole("button", { name: "Accedi" }).click();
}

test("ospite legge, entra per votare, sceglie i temi e usa il mazzo", async ({ page }) => {
  await page.goto(`/proposte/${E2E.proposalA}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Residenze universitarie pubbliche");
  await page.getByRole("link", { name: "Entra con il tuo numero" }).first().click();
  await expect(page).toHaveURL(new RegExp(`/login\\?next=%2Fproposte%2F${E2E.proposalA}`));
  await enterCode(page, PHONE);

  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Nome utente (pubblico)").fill("utente_m4");
  await page.getByRole("checkbox", { name: /almeno 18 anni/ }).check();
  await page.getByRole("checkbox", { name: /accetto le regole/ }).check();
  await page.getByRole("checkbox", { name: /Acconsento/ }).check();
  await page.getByRole("button", { name: "Completa la registrazione" }).click();

  await expect(page).toHaveURL(/\/temi\?benvenuto=1$/);
  await expect(page.getByText("Lo sai solo tu, e non entra nel calcolo.")).toBeVisible();
  const row = page.getByRole("listitem").filter({ hasText: "Casa (e2e)" });
  await row.getByRole("button", { name: "Segui" }).click();
  await expect(row.getByRole("button", { name: "Segui già" })).toBeVisible();
  await page.getByRole("link", { name: "Continua" }).click();

  const deck = page.getByRole("region", { name: "Mazzo del giorno" });
  await expect(deck).toBeVisible();
  await expect(deck.getByText(/1 di 2/)).toBeVisible();
  await deck.getByRole("button", { name: "D'accordo" }).click();
  await expect(deck.getByRole("button", { name: "D'accordo" })).toHaveAttribute("aria-pressed", "true");
  await expect(deck.getByText(/Pochi voti per ora/)).toBeVisible();
  await deck.getByRole("button", { name: "Avanti" }).click();
  await expect(deck.getByText(/2 di 2/)).toBeVisible();
  await deck.getByRole("button", { name: "Passo" }).click();
  await deck.getByRole("button", { name: "Avanti" }).click();
  await expect(page.getByText("Per oggi hai finito. Stanotte contiamo i voti.")).toBeVisible();
});

test("proposta: voto modificabile, argomento e valutazione", async ({ page }) => {
  // Nuovo login dopo aver tolto i cookie: torna alla proposta (next). Attesa per il limite per numero di Supabase.
  await page.waitForTimeout(6000);
  await page.goto(`/login?next=${encodeURIComponent(`/proposte/${E2E.proposalB}`)}`);
  await enterCode(page, PHONE);
  await expect(page).toHaveURL(new RegExp(`/proposte/${E2E.proposalB}$`));

  await expect(page.getByRole("button", { name: "Passo" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Contrario" }).click();
  await expect(page.getByRole("button", { name: "Contrario" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Nessuno vede come hai votato: contano solo i totali.")).toBeVisible();

  await page.getByRole("radio", { name: "Contro" }).check();
  await page.getByLabel("Il tuo argomento").fill("Un bonus fa salire gli affitti invece di abbassarli.");
  await page.getByRole("button", { name: "Aggiungi l'argomento" }).click();
  await expect(page.getByText("Un bonus fa salire gli affitti invece di abbassarli.").first()).toBeVisible();
  const item = page.getByRole("listitem").filter({ hasText: "Un bonus fa salire" });
  await item.getByRole("button", { name: "Utile", exact: true }).click();
  await expect(item.getByRole("button", { name: "Utile", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("nuovo problema in raccolta e ricerca in italiano", async ({ page }) => {
  await page.waitForTimeout(6000);
  await page.goto(`/login?next=${encodeURIComponent(`/temi/${E2E.topicSlug}`)}`);
  await enterCode(page, PHONE);
  await expect(page).toHaveURL(new RegExp(`/temi/${E2E.topicSlug}$`));

  await page.getByRole("link", { name: "Segnala un problema" }).click();
  await page.getByLabel("In una frase, qual è il problema?").fill("Mancano alloggi popolari nei capoluoghi");
  await page.getByLabel("Cosa succede, con fatti e numeri se li hai.").fill("Le liste di attesa durano anni.");
  await page.getByLabel("Chi ne subisce le conseguenze?").fill("Famiglie a basso reddito");
  await page.getByRole("button", { name: "Pubblica il problema" }).click();
  await expect(page).toHaveURL(/\/problemi\/[0-9a-f-]+\?nuovo=1$/);
  await expect(page.getByText(/Il tuo problema è in raccolta/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Sostieni" })).toBeVisible();

  await page.goto("/cerca?q=casa");
  await expect(page.getByRole("link", { name: "Affitti delle case troppo alti per chi studia" })).toBeVisible();
});
