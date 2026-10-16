# Changelog

All notable project changes are recorded here.

## [Unreleased]

### Milestone 0 — Audit and baseline

- Audited the repository, Git history, source layout, APIs, and documentation.
- Confirmed the current baseline commit is `10311d5`.
- Added durable project documentation: `AGENTS.md`, `MEMORY.md`, `PRD.md`, and `TRD.md`.
- Recorded baseline checks: dependency installation passed; lint passed with one warning; production build currently fails on undeclared graph node coordinates.
- Added environment setup guidance without committing secrets.

### Milestone 1 — UI/UX refinement

- Fixed the production TypeScript error by declaring optional force-graph node coordinates.
- Refined chat and graph layouts for responsive desktop and mobile use.
- Added working navigation between Memory Chat and Graph Explorer.
- Added prompt chips, multiline composer behavior, keyboard guidance, accessible labels, focus styles, and clearer loading/error/empty states.
- Added a functional graph refresh/retry action and improved node details and legend styling.
- Updated product metadata and shared visual tokens.
- Validation passed: lint completed with the existing unused-helper warning; production build passed; local `/` and `/graph` smoke tests returned HTTP 200; missing-config API responses remained safe HTTP 500 errors.

### Milestone 2 — Entity identity and duplicate prevention

- Added pure identity helpers for Unicode normalization, type-scoped canonical keys, exact names, aliases, and ambiguity-safe short-name matching.
- Updated Gemini extraction to accept explicit aliases and existing graph aliases.
- Preserved existing exact entity keys while using type-scoped keys for new entities.
- Skipped ambiguous person entities and their uncertain relationships instead of guessing.
- Deduplicated entities and typed relationships before writes; retained Cypher `MERGE` for graph-level edge idempotency.
- Parameterized raw memory writes and respected `FALKORDB_GRAPH_NAME` in the active chat path.
- Added six repeatable Node regression tests covering identity matching and duplicate prevention.
- Validation passed: `npm test`, `npm run lint`, and `npm run build`.

### Milestone 3 — Graph persistence quality and provenance

- Added shared FalkorDB configuration, graph-name, and user-scope normalization helpers.
- Added traceable memory IDs, source/timestamp metadata, `User-HAS_MEMORY` ownership links, and `Memory-MENTIONS-Entity` provenance links.
- Added entity ownership and provenance properties to typed relationships.
- Scoped new entity keys by user ID to prevent cross-user `MERGE` collisions while preserving legacy compatibility keys.
- Updated chat, graph, and diagnostic routes to use the shared configuration contract and preserve legacy default-scope data without destructive migration.
- Added controlled graph-query integration tests for configuration, scoping, memory writes, entity ownership, provenance links, typed relationships, and retrieval parameters.
- Validation passed: 12 tests, lint, and production build.

### Milestone 4 — Graph-powered retrieval

- Added bounded, user-scoped graph evidence retrieval from recent memories through `MENTIONS` and one entity-relationship hop.
- Grouped duplicate graph rows per memory and included connected entity and relationship facts in the chat prompt.
- Preserved the existing chat response fields and added `graphEvidenceUsed` for observability.
- Added regression coverage for query scoping, bounded limits, duplicate grouping, ordering, and relationship evidence.

### Milestone 5 — Memory correction and forgetting

- Added `POST /api/memory` with exact `memoryId` targeting for correction and forgetting.
- Corrections update the active memory while preserving the prior content in a `MemoryRevision` node.
- Forgetting uses reversible soft deletion and hides source relationships from retrieval and graph exploration without deleting graph data.
- Forgetting requires `confirmed: true` and rejects missing, stale, or cross-user memory IDs.

### Milestone 6 — Conversational context

- Added bounded conversation-turn sanitization for recent user and assistant messages.
- Retained returned memory IDs on client user turns so follow-ups can identify the exact prior memory candidate.
- Added explicit pronoun and implicit-reference guidance to extraction and response prompts.
- Ambiguous references now require clarification instead of an inferred graph target.
- Added regression tests for context limits, memory ID preservation, pronoun detection, and no-referent safety.

### Graph-aware memory retrieval — first tool-using milestone

- Added fixed, read-only `search_memories` and `find_entity_relationships` tools over the existing FalkorDB schema.
- Added strict tool-name and argument validation, normalized user scoping, and a maximum of four tool executions per chat request.
- Returned graph tool evidence to Gemini before answer generation, including explicit empty and ambiguous outcomes.
- Changed memory, entity, mention, and relationship writes to return confirmation rows before reporting success.
- Added tests for relationship retrieval, missing information, ambiguous names, malformed/unknown tools, and user-scope parameters.

### Stage 1 — Audit and stabilize the integrated stack

- Audited the current `main` baseline after the full-stack integration was merged by PR #10.
- Fixed a confirmed graph-isolation gap: graph evidence and `search_memories` now scope mentioned entities to the requesting user, retaining unowned legacy entities only in the `default` compatibility scope.
- Added regression assertions for entity ownership in graph evidence and tool-search queries.
- Validation passed: 24 tests, lint, production build, and `git diff --check`.
- Live Gemini/FalkorDB smoke tests remain blocked because credentials are not configured in this environment.

### Stage 2 — Validated document and image uploads

- Added an in-memory multipart upload pipeline with byte-bounded request streaming, five-file/20 MB total/10 MB per-file limits, normalized MIME checks, signatures, malformed-file checks, and server-only Gemini vision extraction.
- Added PDF text extraction with page references and scanned-PDF OCR; DOCX headings/paragraphs/tables; PPTX headings/text/tables in presentation order with slide references; Markdown headings/tables; quoted CSV tables; and PNG/JPEG/WEBP decoding plus Gemini image descriptions/OCR.
- Added ZIP expansion/entry caps, a 16-megapixel image decoding limit, 20,000 extracted characters per file, no-store upload responses, and client previews, progress/errors, attachment removal, and chat submission.
- Uploaded bytes remain in memory; only extracted content is written as a `document` memory when the user sends it. Attachment contents are explicitly treated as untrusted source data in Gemini prompts.
- Replaced Mammoth with direct OOXML parsing, avoiding the vulnerable legacy parser dependency.
- Focused upload tests cover supported formats, malformed and spoofed inputs, limits, slide/page references, scanned-PDF and image vision hooks, multipart size-bounding, and prompt-injection framing.
- Added a short-lived HMAC-signed extraction token so image and scanned-PDF vision work is reused when a preview is sent to chat instead of running twice. Tokens are expiry-checked, tamper-resistant, size-bounded, and never store original upload bytes.
- Validation passed after a clean `npm ci`: 36 tests, lint, production build, and `git diff --check`.
- `npm audit` reports five pre-existing high-severity findings in the lint dependency tree; the suggested fix is a major-version downgrade, so it was not applied. Live Gemini/FalkorDB tests still require credentials.

### Stage 3 — Resilient general knowledge and graph memory

- Made FalkorDB optional for general-knowledge answers; connection timeouts, retrieval failures, and memory-write failures no longer discard a valid Gemini response.
- Added separate graph and retrieval status fields to chat responses and explicit no-fabrication guidance when personal memory evidence is unavailable.
- Added a selective persistence policy so ordinary general-knowledge turns are not written as durable memories, while explicit personal-memory requests and document summaries remain eligible.
- Added configurable `GEMINI_CHAT_MODEL` and `GEMINI_VISION_MODEL` overrides and focused policy regression tests.

### Planned next

- Configure valid Gemini and FalkorDB credentials in the target runtime and run non-destructive live smoke tests.
- Address the request-level identity limitation with a real authentication provider before production multi-user use.
- Review the five high-severity npm audit findings without applying the major-version downgrade suggested by `npm audit fix`.
