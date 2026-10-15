// Schemi dei testi scritti dagli utenti. I limiti coincidono con i CHECK delle tabelle
// (migrazione 20261013100000_core_schema): se cambiano lì, vanno cambiati qui.
import { z } from "zod";

const text = (label: string, max: number) =>
  z
    .string({ error: `${label}: campo obbligatorio.` })
    .trim()
    .min(1, `${label}: campo obbligatorio.`)
    .max(max, `${label}: al massimo ${max} caratteri.`);

const optionalText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${label}: al massimo ${max} caratteri.`)
    .optional()
    .transform((v) => (v ? v : undefined));

export const LIMITS = {
  problemTitle: 120,
  problemBody: 1000,
  problemAffected: 300,
  factStatement: 400,
  proposalWhat: 300,
  proposalHow: 1200,
  proposalCost: 600,
  proposalRisks: 600,
  proposalForeign: 600,
  argumentBody: 400,
  sourceUrl: 500,
  sourceTitle: 200,
} as const;

export const SOURCE_KINDS = ["istituzionale", "primaria", "studio", "stampa"] as const;
export const SOURCE_KIND_LABELS: Record<(typeof SOURCE_KINDS)[number], string> = {
  istituzionale: "Istituzionale",
  primaria: "Fonte primaria",
  studio: "Studio",
  stampa: "Stampa",
};

const uuid = z.uuid("Riferimento non valido.");
const sourceUrl = z
  .string()
  .trim()
  .max(LIMITS.sourceUrl, "Indirizzo della fonte troppo lungo.")
  .regex(/^https?:\/\/\S+$/, "La fonte deve essere un indirizzo web che inizia con http:// o https://.");

export const problemSchema = z.object({
  topic_id: uuid,
  title: text("Titolo", LIMITS.problemTitle),
  body: text("Descrizione", LIMITS.problemBody),
  affected: text("Chi riguarda", LIMITS.problemAffected),
});

export const reformulationSchema = z.object({
  problem_id: uuid,
  title: text("Titolo", LIMITS.problemTitle),
  body: text("Descrizione", LIMITS.problemBody),
});

export const factSchema = z.object({
  problem_id: uuid,
  statement: text("Fatto", LIMITS.factStatement),
  source_url: sourceUrl,
  source_title: text("Titolo della fonte", LIMITS.sourceTitle),
  source_publisher: optionalText("Editore", LIMITS.sourceTitle),
  source_kind: z.enum(SOURCE_KINDS, { error: "Scegli il tipo di fonte." }),
});

export const proposalSchema = z
  .object({
    problem_id: uuid,
    what: text("Cosa", LIMITS.proposalWhat),
    how: text("Come", LIMITS.proposalHow),
    cost_and_funding: text("Costo e copertura", LIMITS.proposalCost),
    risks: text("Rischi", LIMITS.proposalRisks),
    foreign_example: optionalText("Esempio estero", LIMITS.proposalForeign),
    foreign_source_url: z.string().trim().optional().transform((v) => (v ? v : undefined)),
    foreign_source_title: optionalText("Titolo della fonte", LIMITS.sourceTitle),
    foreign_source_kind: z
      .union([z.enum(SOURCE_KINDS), z.literal("")])
      .optional()
      .transform((v) => (v ? v : undefined)),
  })
  .superRefine((p, ctx) => {
    if (!p.foreign_example) return;
    if (!p.foreign_source_url || !p.foreign_source_title || !p.foreign_source_kind) {
      ctx.addIssue({ code: "custom", message: "L'esempio estero ha bisogno di una fonte: indirizzo, titolo e tipo." });
    } else if (!sourceUrl.safeParse(p.foreign_source_url).success) {
      ctx.addIssue({ code: "custom", message: "La fonte deve essere un indirizzo web che inizia con http:// o https://." });
    }
  });

export const argumentSchema = z.object({
  proposal_id: uuid,
  side: z.enum(["pro", "contro"], { error: "Scegli se è a favore o contro." }),
  body: text("Argomento", LIMITS.argumentBody),
});

export const voteSchema = z.object({
  item_id: uuid,
  value: z.coerce.number().pipe(z.union([z.literal(-1), z.literal(0), z.literal(1)])),
});
