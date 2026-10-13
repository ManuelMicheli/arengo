import { describe, expect, it } from "vitest";
import { checkContent, isTargetingPerson, type LexiconEntry } from "./check-content";
import { normalizeText } from "./normalize";

// Solo termini fittizi: mai insulti reali nel codice.
const LEXICON: LexiconEntry[] = [
  { term: "parolaccia1", level: 2, isPattern: false },
  { term: "odiotermine", level: 3, isPattern: false },
  // I pattern si applicano al testo normalizzato: niente doppie, accenti o maiuscole.
  { term: "minacia(?:re|to)? finta", level: 4, isPattern: true },
];

describe("normalizeText", () => {
  it("minuscole e accenti", () => {
    expect(normalizeText("ÒdioTérmine")).toBe("odiotermine");
  });
  it("leet", () => {
    expect(normalizeText("0d10t3rm1n3")).toBe("odiotermine");
    expect(normalizeText("$pec1@le")).toBe("speciale");
  });
  it("ripetizioni ridotte", () => {
    expect(normalizeText("odiooooteeermineee")).toBe("odiotermine");
  });
  it("lettere singole separate unite", () => {
    expect(normalizeText("o.d.i.o.t.e.r.m.i.n.e")).toBe("odiotermine");
    expect(normalizeText("o d i o t e r m i n e")).toBe("odiotermine");
    expect(normalizeText("o-d_i*o t.e.r.m.i.n.e")).toBe("odiotermine");
  });
  it("non unisce una o due lettere isolate", () => {
    expect(normalizeText("è a me che parli")).toBe("e a me che parli");
  });
});

describe("checkContent", () => {
  it("lessico vuoto: tutto passa", () => {
    expect(checkContent("qualsiasi testo odiotermine", { lexicon: [] })).toEqual({ ok: true });
  });

  it("livello 3 bloccato anche con separatori, leet, accenti e ripetizioni", () => {
    for (const text of ["sei proprio o.d.i.o.t.e.r.m.i.n.e", "0d10t3rm1n3!", "Òdiotérmine", "odioooterminee"]) {
      expect(checkContent(text, { lexicon: LEXICON })).toEqual({ ok: false, level: 3, rule: "insulto_odio" });
    }
  });

  it("livello 3 bloccato anche senza destinatario", () => {
    expect(checkContent("che odiotermine questa legge", { lexicon: LEXICON })).toMatchObject({ ok: false, level: 3 });
  });

  it("livello 4 via pattern", () => {
    expect(checkContent("ti faccio una minacciare finta", { lexicon: LEXICON })).toEqual({
      ok: false,
      level: 4,
      rule: "contenuto_illecito",
    });
  });

  it("vince il livello più alto", () => {
    expect(checkContent("sei un parolaccia1, odiotermine, minaccia finta", { lexicon: LEXICON })).toMatchObject({
      level: 4,
    });
  });

  it("livello 2 senza destinatario è livello 1 (ammesso)", () => {
    expect(checkContent("che parolaccia1 di legge", { lexicon: LEXICON })).toEqual({ ok: true });
  });

  it("livello 2 rivolto a una persona è bloccato", () => {
    for (const text of ["sei un parolaccia1", "Tu sei parolaccia1", "vai a quel paese parolaccia1", "@mario_rossi parolaccia1"]) {
      expect(checkContent(text, { lexicon: LEXICON })).toEqual({ ok: false, level: 2, rule: "insulto_a_utente" });
    }
  });

  it("parole che contengono un termine non sono bloccate", () => {
    expect(checkContent("odioterminesimo", { lexicon: LEXICON })).toEqual({ ok: true });
  });

  it("etichetta politica descrittiva ammessa", () => {
    expect(checkContent("è una proposta comunista", { lexicon: LEXICON })).toEqual({ ok: true });
    expect(checkContent("questa idea è da liberisti, discutiamone", { lexicon: LEXICON })).toEqual({ ok: true });
  });

  it("la regola non contiene il testo né il termine", () => {
    const r = checkContent("sei un parolaccia1", { lexicon: LEXICON });
    expect(JSON.stringify(r)).not.toContain("parolaccia1");
  });

  it("pattern non valido ignorato senza errori", () => {
    const broken: LexiconEntry[] = [{ term: "(", level: 3, isPattern: true }];
    expect(checkContent("testo qualsiasi", { lexicon: broken })).toEqual({ ok: true });
  });
});

describe("isTargetingPerson", () => {
  it("riconosce formule e menzioni", () => {
    expect(isTargetingPerson("sei una persona")).toBe(true);
    expect(isTargetingPerson("ciao @utente_x")).toBe(true);
    expect(isTargetingPerson("la proposta è debole")).toBe(false);
    expect(isTargetingPerson("scrivimi a mario@example")).toBe(false);
  });
});
