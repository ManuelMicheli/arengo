# Mappa del codice

Generata da `pnpm ai:map`: non modificare a mano. Consultare solo con Grep.

## Rotte

- `/` (page) → src/app/page.tsx

## Tabelle e viste (da migrazioni)

- `public.argument_ratings` → supabase/migrations/20261013100000_core_schema.sql
- `public.argument_utility` → supabase/migrations/20261013100200_views_config.sql
- `public.arguments_public` → supabase/migrations/20261013100200_views_config.sql
- `public.arguments` → supabase/migrations/20261013100000_core_schema.sql
- `public.bar_messages` → supabase/migrations/20261013100000_core_schema.sql
- `public.bar_public` → supabase/migrations/20261013100200_views_config.sql
- `public.config_changelog` → supabase/migrations/20261013100000_core_schema.sql
- `public.piazza_messages` → supabase/migrations/20261013100000_core_schema.sql
- `public.piazza_public` → supabase/migrations/20261013100200_views_config.sql
- `public.piazza_tallies` → supabase/migrations/20261013100200_views_config.sql
- `public.piazza_votes` → supabase/migrations/20261013100000_core_schema.sql
- `public.platform_config` → supabase/migrations/20261013100000_core_schema.sql
- `public.problem_facts` → supabase/migrations/20261013100000_core_schema.sql
- `public.problem_reformulation_votes` → supabase/migrations/20261013100000_core_schema.sql
- `public.problem_reformulations` → supabase/migrations/20261013100000_core_schema.sql
- `public.problem_supports` → supabase/migrations/20261013100000_core_schema.sql
- `public.problems_public` → supabase/migrations/20261013100200_views_config.sql
- `public.problems` → supabase/migrations/20261013100000_core_schema.sql
- `public.profiles` → supabase/migrations/20261013100000_core_schema.sql
- `public.proposal_tallies` → supabase/migrations/20261013100200_views_config.sql
- `public.proposal_votes` → supabase/migrations/20261013100000_core_schema.sql
- `public.proposals_public` → supabase/migrations/20261013100200_views_config.sql
- `public.proposals` → supabase/migrations/20261013100000_core_schema.sql
- `public.sources` → supabase/migrations/20261013100000_core_schema.sql
- `public.topics` → supabase/migrations/20261013100000_core_schema.sql

## File → export

- engine/test/smoke.test.ts
- scripts/ai-map.mjs: buildMap, extractExports, extractTables, isEntrypoint, listFiles, routeFromFile
- scripts/ai-map.test.mjs
- scripts/check-changed.mjs
- src/app/layout.tsx: RootLayout, metadata
- src/app/page.tsx: Home
- src/types/database.ts

## File grandi (non leggere interi: Grep o Read con offset/limit)

- LICENSE
- pnpm-lock.yaml
- src/types/database.ts
