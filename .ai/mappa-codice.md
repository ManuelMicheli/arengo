# Mappa del codice

Generata da `pnpm ai:map`: non modificare a mano. Consultare solo con Grep.

## Rotte

- `/` (page) → src/app/page.tsx

## Tabelle e viste (da migrazioni)

- `private.filter_strikes` → supabase/migrations/20261013100400_content_filter.sql
- `public.argument_ratings` → supabase/migrations/20261013100000_core_schema.sql
- `public.argument_utility` → supabase/migrations/20261013100200_views_config.sql
- `public.arguments_public` → supabase/migrations/20261013100200_views_config.sql
- `public.arguments` → supabase/migrations/20261013100000_core_schema.sql
- `public.bar_messages` → supabase/migrations/20261013100000_core_schema.sql
- `public.bar_public` → supabase/migrations/20261013100200_views_config.sql
- `public.config_changelog` → supabase/migrations/20261013100000_core_schema.sql
- `public.filter_block_stats` → supabase/migrations/20261013100400_content_filter.sql
- `public.lexicon_terms` → supabase/migrations/20261013100400_content_filter.sql
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

- engine/src/core/consensus.ts: belowShareFlags, classify, computeItemResults, groupLabel, isStablePonte, pAgree
- engine/src/core/engine.ts: EngineResult, runEngine
- engine/src/core/groups.ts: OpinionGroups, formJuryPanels, stratifiedDraw
- engine/src/core/index.ts
- engine/src/core/kmeans.ts: ChooseKResult, KMeansResult, chooseK, kmeans, silhouette
- engine/src/core/matrix.ts: Eligible, VoteMatrix, buildCenteredMatrix, selectEligible
- engine/src/core/pca.ts: project2D
- engine/src/core/prng.ts: Rng, hashString, mulberry32, rngFromSeed, shuffle
- engine/src/core/reputation.ts: computeReputation
- engine/src/core/types.ts: Classification, ClusterStat, EngineConfig, EngineInput, EngineOutput, GroupAgreement, InsufficientReason, ItemResult, JuryPanel, PrivateOutput, PublicOutput, ReputationEvent, ReputationScore, RunClassification, Vote, VoteValue
- engine/src/core/validate.ts: assertValidAccountAges, assertValidConfig, assertValidHistory, assertValidJuryEligible, assertValidReputationEvents, assertValidVotes
- engine/test/consensus.test.ts
- engine/test/engine.synthetic.test.ts
- engine/test/fixtures.ts: SEED_CONFIG
- engine/test/groups.test.ts
- engine/test/matrix.test.ts
- engine/test/pca-kmeans.test.ts
- engine/test/privacy.test.ts
- engine/test/prng.test.ts
- engine/test/seed-config.test.ts
- engine/test/synthetic.ts: BASE_OPTIONS, ExactItem, SyntheticData, SyntheticOptions, generateExact, generatePolarized
- scripts/ai-map.mjs: buildMap, extractExports, extractTables, isEntrypoint, listFiles, routeFromFile
- scripts/ai-map.test.mjs
- scripts/check-changed.mjs
- src/app/layout.tsx: RootLayout, metadata
- src/app/page.tsx: Home
- src/lib/moderation/check-content.test.ts
- src/lib/moderation/check-content.ts: CheckResult, LexiconEntry, RuleId, SeverityLevel, checkContent, isTargetingPerson
- src/lib/moderation/guard.test.ts
- src/lib/moderation/guard.ts: ContentType, GuardResult, ModerationDeps, RULE_MESSAGES, guardContent, pauseMessage
- src/lib/moderation/normalize.ts: foldCase, normalizeText
- src/types/database.ts: CompositeTypes, Constants, Database, Enums, Json, Tables, TablesInsert, TablesUpdate

## File grandi (non leggere interi: Grep o Read con offset/limit)

- LICENSE
- docs/PLAN.md
- pnpm-lock.yaml
- src/types/database.ts
