# engine/ — motore di consenso

## Struttura
- `src/core/`: funzioni pure dell'algoritmo (stream E1). Nessun I/O, nessun accesso a DB, nessun log per utente.
- `src/run.ts` (M6): I/O con service role, legge voti per pseudo, chiama il core, scrive output aggregati.
- `test/`: Vitest (`pnpm --filter engine test`). `smoke.test.ts` è il test d'esempio di M0, sostituibile.

## Convenzioni
- Pacchetto pnpm `engine` (ESM, TypeScript strict, `noUncheckedIndexedAccess`). Dipendenze già installate: `ml-pca`. k-means, silhouette e PRNG (es. mulberry32) si scrivono a mano.
- Lo stream E1 non tocca `package.json`, lockfile, config globali, migrazioni.
- Determinismo: ogni casualità passa dal PRNG con seed in input; stesso input + seed → output deep-equal.
- Parametri sempre in input (da `platform_config`), mai costanti nel codice.
- Gruppi d'opinione solo in memoria: mai restituiti associati a pseudo/utente; i panel giuria escono senza etichetta di gruppo.
- Log solo aggregati (conteggi, k, silhouette), mai pseudo o user_id.
- Algoritmo documentato in `docs/ALGORITMO.md`: se cambi il codice, aggiorna il doc.
