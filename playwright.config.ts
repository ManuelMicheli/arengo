// Test e2e: girano solo nel job CI `e2e` (Supabase locale con OTP di test). Non sul portatile.
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: "http://127.0.0.1:3000", locale: "it-IT", timezoneId: "Europe/Rome", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: { command: "pnpm start", url: "http://127.0.0.1:3000", reuseExistingServer: false, timeout: 120_000 },
});
