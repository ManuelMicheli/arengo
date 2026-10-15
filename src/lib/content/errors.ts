// Messaggi per gli errori delle RPC (codici sollevati dalle funzioni SQL). Scritti come "cosa fare".
const MESSAGES: Record<string, string> = {
  not_authenticated: "Entra con il tuo numero per continuare.",
  onboarding_incomplete: "Completa la registrazione per votare e scrivere.",
  account_not_active: "Il tuo account è sospeso: per ora puoi leggere, ma non votare né scrivere.",
  account_deleted: "Questo account è stato cancellato.",
  writing_paused: "Hai una pausa di scrittura in corso: riprova più tardi.",
  daily_limit_reached: "Hai raggiunto il limite di oggi per questo tipo di contenuto. Riprova domani.",
  item_not_votable: "Questo contenuto non accetta più voti o contributi.",
  problem_not_active: "Si possono proporre soluzioni solo ai problemi aperti.",
  source_required: "Serve una fonte: indirizzo, titolo e tipo.",
  invalid_source: "Controlla la fonte: l'indirizzo deve iniziare con http:// o https:// e il tipo va scelto dall'elenco.",
  unknown_topic: "Questo tema non è disponibile.",
  invalid_value: "Controlla i campi e riprova.",
};

export function rpcErrorMessage(error: { message?: string } | null | undefined): string {
  const text = error?.message ?? "";
  const code = Object.keys(MESSAGES).find((c) => text.includes(c));
  return code ? MESSAGES[code]! : "Non è andata a buon fine. Riprova tra poco.";
}
