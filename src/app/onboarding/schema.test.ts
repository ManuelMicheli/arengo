import { describe, expect, it } from "vitest";
import { onboardingSchema } from "./schema";

const base = { adult: "on", rules: "on", consent_art9: "on", rules_version: "2026-10-v1", handle: "mario_r" };

describe("onboardingSchema", () => {
  it("accetta tutte le conferme e un handle valido", () => {
    expect(onboardingSchema.safeParse(base).success).toBe(true);
  });

  it("rifiuta se manca una conferma (checkbox non spuntata = campo assente)", () => {
    for (const key of ["adult", "rules", "consent_art9"] as const) {
      const rest: Partial<typeof base> = { ...base };
      delete rest[key];
      expect(onboardingSchema.safeParse(rest).success).toBe(false);
    }
  });

  it("rifiuta handle fuori formato", () => {
    for (const handle of ["ab", "a".repeat(21), "con spazio", "àccento", "a-b"]) {
      expect(onboardingSchema.safeParse({ ...base, handle }).success).toBe(false);
    }
  });
});

describe("handle riservati", () => {
  it("rifiuta nomi che imitano la gestione", () => {
    for (const handle of ["admin", "Admin_1", "arengo_staff", "Moderatore", "staff99"]) {
      expect(onboardingSchema.safeParse({ ...base, handle }).success).toBe(false);
    }
  });

  it("accetta nomi comuni", () => {
    expect(onboardingSchema.safeParse({ ...base, handle: "giulia_92" }).success).toBe(true);
  });
});
