import { describe, expect, it } from "vitest";
import { checkContent, compileLexicon, type FilterParams, type LexiconEntry } from "./check-content";
import { normalizeJoinedText, normalizeText } from "./normalize";

// Solo termini fittizi: mai insulti reali nel codice.
const LEXICON: LexiconEntry[] = [
  { term: "parolaccia1", level: 2 },
  { term: "etichettax", level: 2 }, // etichetta politica fittizia: sta a L2
  { term: "odiotermine", level: 3 },
  { term: "88", level: 3 }, // termine numerico
  { term: "minaccia * finta", level: 4 }, // frase con jolly
];

const PARAMS: FilterParams = { targetWindowWords: 4, letterJoinMinRun: 3 };
const check = (text: string) => checkContent(text, { lexicon: LEXICON, params: PARAMS });

describe("normalize", () => {
  it("minuscole e accenti", () => {
    expect(normalizeText("ÒdioTérmine")).toBe("odiotermine");
  });
  it("rimuove i caratteri invisibili (\\p{Cf})", () => {
    expect(normalizeText("odio​termine")).toBe("odiotermine");
    expect(normalizeText("odio­ter⁠mi﻿ne")).toBe("odiotermine");
  });
  it("leet solo nei token con lettere", () => {
    expect(normalizeText("0d10t3rm1n3")).toBe("odiotermine");
    expect(normalizeText("$pec1@le")).toBe("speciale");
    expect(normalizeText("nel 1988 erano 88")).toBe("nel 1988 erano 88");
  });
  it("doppie ridotte solo sulle lettere", () => {
    expect(normalizeText("odiooooteeermineee 1100")).toBe("odiotermine 1100");
  });
  it("unisce le lettere singole solo con lo stesso separatore", () => {
    expect(normalizeJoinedText("o.d.i.o.t.e.r.m.i.n.e")).toBe("odiotermine");
    expect(normalizeJoinedText("è o.d.i.o.t.e.r.m.i.n.e")).toBe("e odiotermine");
    expect(normalizeJoinedText("o-d.i_o")).toBe("o d i o");
  });
  it("la forma senza fusioni resta intatta", () => {
    expect(normalizeText("c'è l'idea e a o i")).toBe("c e l idea e a o i");
    expect(normalizeText("è a me che parli")).toBe("e a me che parli");
  });
});

describe("checkContent", () => {
  it("lessico vuoto: tutto passa", () => {
    expect(checkContent("odiotermine", { lexicon: [], params: PARAMS })).toEqual({ ok: true });
  });

  it("livello 3 bloccato con invisibili, separatori, leet, accenti e ripetizioni", () => {
    for (const text of [
      "odio​termine",
      "è o.d.i.o.t.e.r.m.i.n.e",
      "o d i o t e r m i n e",
      "0d10t3rm1n3!",
      "Òdiotérmine",
      "odioooterminee",
      "che odiotermine questa legge",
    ]) {
      expect(check(text)).toEqual({ ok: false, level: 3, rule: "insulto_odio" });
    }
  });

  it("nessuna fusione spuria: frase normale non bloccata", () => {
    expect(check("c'è l'idea e a o i")).toEqual({ ok: true });
  });

  it("termine numerico del lessico", () => {
    expect(check("ciao 88")).toMatchObject({ ok: false, level: 3 });
    expect(check("nel 1988")).toEqual({ ok: true });
    expect(check("ciao 8")).toEqual({ ok: true });
  });

  it("frase con jolly = esattamente una parola", () => {
    expect(check("una minaccia molto finta")).toEqual({ ok: false, level: 4, rule: "contenuto_illecito" });
    expect(check("una minaccia finta")).toEqual({ ok: true });
    expect(check("una minaccia davvero molto finta")).toEqual({ ok: true });
  });

  it("vince il livello più alto", () => {
    expect(check("sei un parolaccia1, odiotermine, minaccia molto finta")).toMatchObject({ level: 4 });
  });

  it("livello 2 senza destinatario è livello 1 (ammesso)", () => {
    expect(check("che parolaccia1 di legge")).toEqual({ ok: true });
  });

  it("livello 2 rivolto a una persona è bloccato", () => {
    for (const text of [
      "sei un parolaccia1",
      "sei proprio una parolaccia1",
      "sei solo un parolaccia1",
      "sei parolaccia1",
      "Tu sei parolaccia1",
      "voi siete parolaccia1",
      "siete dei parolaccia1",
      "siete delle parolaccia1",
      "vai a quel paese parolaccia1",
      "@mario_rossi parolaccia1",
    ]) {
      expect(check(text), text).toEqual({ ok: false, level: 2, rule: "insulto_a_utente" });
    }
  });

  it("formula lontana dal termine: nessun blocco", () => {
    expect(check("Sei un genio, ma questa legge è una parolaccia1")).toEqual({ ok: true });
  });

  it("etichetta politica: bloccata solo se rivolta a una persona", () => {
    expect(check("sei un etichettax")).toEqual({ ok: false, level: 2, rule: "insulto_a_utente" });
    expect(check("è una proposta etichettax")).toEqual({ ok: true });
    expect(check("è una proposta comunista")).toEqual({ ok: true });
  });

  it("parole che contengono un termine non sono bloccate", () => {
    expect(check("odioterminesimo")).toEqual({ ok: true });
  });

  it("menzione non valida (email) non conta come destinatario", () => {
    expect(check("scrivimi a mario@example parolaccia1")).toEqual({ ok: true });
  });

  it("la regola non contiene il testo né il termine", () => {
    expect(JSON.stringify(check("sei un parolaccia1"))).not.toContain("parolaccia1");
  });

  it("voci del lessico non valide ignorate", () => {
    const bad: LexiconEntry[] = [{ term: "* *", level: 3 }, { term: "", level: 3 }];
    expect(checkContent("testo qualsiasi", { lexicon: bad, params: PARAMS })).toEqual({ ok: true });
  });

  it("il lessico si compila una volta per versione", () => {
    expect(compileLexicon(LEXICON)).toBe(compileLexicon(LEXICON));
    expect(compileLexicon([...LEXICON])).not.toBe(compileLexicon(LEXICON));
  });
});
