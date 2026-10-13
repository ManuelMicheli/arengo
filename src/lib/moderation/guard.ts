// Controllo pre-invio da usare nelle Server Action: pausa di scrittura → lessico → checkContent →
// registrazione del blocco (solo livello e tipo, mai il testo). Nessun log, nessun testo negli errori.

import { checkContent, type LexiconEntry, type RuleId, type SeverityLevel } from "./check-content";

export type ContentType =
  | "problem"
  | "reformulation"
  | "fact"
  | "proposal"
  | "argument"
  | "piazza"
  | "bar"
  | "handle"
  | "report";

export type ModerationDeps = {
  loadLexicon: () => Promise<readonly LexiconEntry[]>;
  /** Fine della pausa di scrittura dell'utente corrente, o null. */
  writingPausedUntil: () => Promise<Date | null>;
  /** Registra il blocco (statistiche + strike); restituisce la fine della pausa, o null. */
  recordBlock: (level: SeverityLevel, contentType: ContentType) => Promise<Date | null>;
};

export type GuardResult =
  | { ok: true }
  | { ok: false; reason: "paused"; pausedUntil: Date; message: string }
  | { ok: false; reason: "blocked"; level: SeverityLevel; rule: RuleId; pausedUntil: Date | null; message: string };

export const RULE_MESSAGES: Record<RuleId, string> = {
  insulto_a_utente:
    "Il messaggio contiene un insulto rivolto a una persona (Scala, livello 2). Critica le idee, non le persone: riformulalo e invialo di nuovo.",
  insulto_odio:
    "Il messaggio contiene un insulto d'odio (Scala, livello 3). Non può essere pubblicato: riformulalo senza colpire persone o gruppi.",
  contenuto_illecito:
    "Il messaggio contiene un contenuto illecito, come minacce o istigazione (Scala, livello 4). Non può essere pubblicato.",
};

const timeRome = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });

export function pauseMessage(until: Date): string {
  return `Hai raggiunto il limite di messaggi bloccati: potrai scrivere di nuovo alle ${timeRome.format(until)}.`;
}

export async function guardContent(text: string, contentType: ContentType, deps: ModerationDeps): Promise<GuardResult> {
  const pausedUntil = await deps.writingPausedUntil();
  if (pausedUntil) return { ok: false, reason: "paused", pausedUntil, message: pauseMessage(pausedUntil) };

  const result = checkContent(text, { lexicon: await deps.loadLexicon() });
  if (result.ok) return { ok: true };

  const newPause = await deps.recordBlock(result.level, contentType);
  const message = newPause ? `${RULE_MESSAGES[result.rule]} ${pauseMessage(newPause)}` : RULE_MESSAGES[result.rule];
  return { ok: false, reason: "blocked", level: result.level, rule: result.rule, pausedUntil: newPause, message };
}
