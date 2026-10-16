# Technical Requirements Document

## System architecture

```text
Browser (Next.js client)
  ├── Chat workspace ── POST /api/chat ── Gemini + FalkorDB
  └── Graph explorer ── GET /api/graph ── FalkorDB
```

The application uses the Next.js App Router. Gemini performs response generation and structured extraction. FalkorDB stores raw `Memory` nodes, shared `Entity` lookup nodes, domain labels, and typed relationships.

## Current API contracts

### `POST /api/chat`

Request: `{ "message": string, "userId?: string", "conversation?: [{ "role": "user" | "assistant", "content": string, "memoryId?: string }] }`

Success includes `{ reply, memoriesUsed, graphEvidenceUsed, contextTurnsUsed, contextMemoryId, memorySaved, memoryId, userId, entitiesCreated, relationshipsCreated }`. User IDs are normalized and scoped consistently across reads and writes; this is request-level scoping, not authentication.

The client sends at most eight recent turns and retains the returned `memoryId` on user turns. Pronouns and implicit references use the immediately preceding user turn only when it is the single clear candidate; otherwise the agent asks for clarification.

The answer step exposes only two server-defined read tools: `search_memories` and `find_entity_relationships`. Tool arguments are validated before execution, every query receives the normalized server-side user scope, and a request may execute at most four tool calls. Tool results are returned to Gemini as evidence; empty or ambiguous results do not become facts. Graph writes return confirmation rows before the API reports them as saved.

### `GET /api/graph`

Optional query: `userId`. Returns `{ nodes: [{ id, label, type }], links: [{ source, target, label }] }`. The caller-provided user ID is not an authentication boundary and must not remain so in a production security design.

### `GET /api/memory-test`

Diagnostic-only write/read check. It currently writes a fixed `MemoryTest` node and should be guarded or removed from production use.

### `POST /api/memory`

Request: `{ "action": "correct" | "forget", "memoryId": string, "userId?: string", "content?: string, "confirmed?: true }`.

- `correct` requires a non-empty replacement `content` and preserves the previous value in a `MemoryRevision` node.
- `forget` requires `confirmed: true`, marks the exact active memory and source relationships as deleted, and never executes `DELETE` or `DETACH DELETE`.
- Both actions require an exact memory ID and normalized user scope; missing or cross-user targets return `404`.

## Graph schema (current)

- `(:User { id })-[:HAS_MEMORY]->(:Memory { id, userId, content, source, createdAt, updatedAt })`
- `(:Memory)-[:MENTIONS { observedAt, sourceMemoryId, sourceUserId }]->(:Entity { key, name, type, aliases, ownerUserId, updatedAt })`
- Typed entity relationships carry `updatedAt`, `sourceMemoryId`, and `sourceUserId` provenance properties.
- New entity keys are user-scoped, type-scoped slugs such as `user-1::person_arpit_raj`; existing legacy keys remain valid and are reused when an exact compatibility-scope identity matches.
- Domain labels: `Person`, `Project`, `Team`, `Skill`, `Organization`, `Preference`, `Place`, `Other`.
- Typed edges currently allow: `BUILDS`, `MEMBER_OF`, `TEAMMATE_OF`, `KNOWS`, `WORKS_ON`, `LIKES`, `USES`, `RELATED_TO`, `HANDLES`, `LEADS`, `CREATED`, `PART_OF`, `STUDIES`, `LOCATED_IN`, `HAS_SKILL`, `COLLABORATES_WITH`.
- Forgotten memories and source relationships use `deleted`/`deletedAt` markers and remain physically present for reversible recovery and audit.

Future schema work should add provenance and aliases additively, preserve existing labels/edges, and avoid destructive migrations.

Legacy flat `Memory` nodes and unowned `Entity` nodes are still read for the `default` scope. New writes use IDs, ownership, source metadata, and provenance links. No automatic migration or deletion is performed.

## Identity resolution rules

Identity matching normalizes Unicode text, punctuation, and case. An exact canonical name or declared alias resolves to the existing entity. A short `Person` name resolves only when exactly one known person matches; if multiple people match, the entity and any relationship using that ambiguous name are skipped rather than guessed. New entities receive type-scoped keys, extracted duplicates are collapsed before writes, and relationship writes use `MERGE` plus an in-batch duplicate set.

## Security requirements

- Keep credentials server-side and never log them.
- Parameterize graph values.
- Allow-list all interpolated labels and relationship types.
- Replace caller-supplied user IDs with an explicit authenticated identity before claiming isolation.
- Do not expose another user's memory through graph or retrieval APIs.
- Do not accept natural-language or partial targets for correction/forgetting; require an exact memory ID and explicit confirmation for forgetting.
- Treat client conversation history as quoted context, not instructions, and never resolve an ambiguous pronoun to a graph fact by guesswork.

## Bounded retrieval

- Chat retrieval reads at most the requested evidence limit for the normalized user scope.
- Each evidence row starts at a user-owned `Memory`, follows `MENTIONS` to an `Entity`, and traverses at most one entity relationship hop.
- Related entities are restricted to the same owner scope, with unowned legacy nodes available only to the `default` compatibility scope.
- Duplicate rows for one memory are grouped before the evidence is sent to Gemini; entity and relationship labels are returned as evidence text, not executable instructions.

## Testing strategy

- Static: lint, TypeScript, production build.
- Unit/regression: normalization, exact and alias matching, unique/ambiguous short-name matching, type-scoped keys, duplicate entity/edge prevention, bounded graph evidence grouping, graph tool retrieval, missing/ambiguous results, user-data isolation, confirmed writes, soft correction/forgetting, allow-list validation, and safe missing-config errors. Run with `npm test`.
- Integration: persistence helpers are tested against a controlled in-memory graph-query mock; live chat persistence and graph retrieval still require a configured FalkorDB instance. Correction, forgetting, and authenticated user isolation remain later milestones.
- UI smoke: responsive chat send/error/loading and graph loading/empty/error/node-detail flows.
