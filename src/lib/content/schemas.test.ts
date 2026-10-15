import { describe, expect, it } from "vitest";
import { argumentSchema, factSchema, LIMITS, problemSchema, proposalSchema, voteSchema } from "./schemas";

const id = "00000000-0000-4000-8000-000000000001";

describe("problemSchema", () => {
  it("accetta un problema completo e toglie gli spazi", () => {
    const r = problemSchema.parse({ topic_id: id, title: "  Affitti alti ", body: "b", affected: "c" });
    expect(r.title).toBe("Affitti alti");
  });

  it("rifiuta campi vuoti o troppo lunghi", () => {
    expect(problemSchema.safeParse({ topic_id: id, title: "   ", body: "b", affected: "c" }).success).toBe(false);
    expect(problemSchema.safeParse({ topic_id: id, title: "x".repeat(LIMITS.problemTitle + 1), body: "b", affected: "c" }).success).toBe(false);
  });
});

describe("factSchema", () => {
  const base = { problem_id: id, statement: "f", source_url: "https://istat.it/x", source_title: "Istat", source_kind: "istituzionale" };

  it("vuole la fonte con indirizzo http(s) e tipo ammesso", () => {
    expect(factSchema.safeParse(base).success).toBe(true);
    expect(factSchema.safeParse({ ...base, source_url: "" }).success).toBe(false);
    expect(factSchema.safeParse({ ...base, source_url: "javascript:alert(1)" }).success).toBe(false);
    expect(factSchema.safeParse({ ...base, source_kind: "blog" }).success).toBe(false);
  });
});

describe("proposalSchema", () => {
  const base = { problem_id: id, what: "w", how: "h", cost_and_funding: "c", risks: "r" };

  it("esempio estero facoltativo", () => {
    expect(proposalSchema.safeParse(base).success).toBe(true);
    expect(proposalSchema.safeParse({ ...base, foreign_example: "", foreign_source_kind: "" }).success).toBe(true);
  });

  it("l'esempio estero vuole una fonte valida", () => {
    expect(proposalSchema.safeParse({ ...base, foreign_example: "In Francia" }).success).toBe(false);
    expect(
      proposalSchema.safeParse({
        ...base,
        foreign_example: "In Francia",
        foreign_source_url: "ftp://x",
        foreign_source_title: "t",
        foreign_source_kind: "studio",
      }).success,
    ).toBe(false);
    expect(
      proposalSchema.safeParse({
        ...base,
        foreign_example: "In Francia",
        foreign_source_url: "https://insee.fr",
        foreign_source_title: "Insee",
        foreign_source_kind: "istituzionale",
      }).success,
    ).toBe(true);
  });
});

describe("argumentSchema e voteSchema", () => {
  it("lato pro/contro e testo obbligatorio", () => {
    expect(argumentSchema.safeParse({ proposal_id: id, side: "pro", body: "x" }).success).toBe(true);
    expect(argumentSchema.safeParse({ proposal_id: id, side: "forse", body: "x" }).success).toBe(false);
    expect(argumentSchema.safeParse({ proposal_id: id, side: "pro", body: "x".repeat(LIMITS.argumentBody + 1) }).success).toBe(false);
  });

  it("voto solo -1, 0, 1", () => {
    for (const value of [-1, 0, 1]) expect(voteSchema.safeParse({ item_id: id, value }).success).toBe(true);
    for (const value of [2, 0.5, "x"]) expect(voteSchema.safeParse({ item_id: id, value }).success).toBe(false);
  });
});
