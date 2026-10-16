<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Graph Memory Agent — Agent Guide

## Project

Graph Memory Agent is a Next.js App Router application for the Graph Hacks hackathon. It combines Gemini responses with FalkorDB-backed memories and a `react-force-graph-2d` explorer.

## Commands

```bash
npm ci
npm run lint
npm run build
npm test
npm run dev
```

The repository has a Node.js test script. Add focused regression tests when changing graph identity, persistence, retrieval, correction, or user scoping.

## Architecture

- `app/page.tsx`: client chat workspace and message state.
- `app/graph/page.tsx`: client graph explorer and node details.
- `app/api/chat/route.ts`: Gemini request handling, provenance-aware memory persistence, entity extraction, canonical-name resolution, and typed relationship writes.
- `app/api/upload/route.ts` and `lib/file-extraction.ts`: bounded in-memory multipart uploads, file validation, local parsers, image/PDF Gemini vision extraction, and structured extraction previews.
- `app/api/graph/route.ts`: FalkorDB graph read API for memory and entity nodes/links.
- `app/api/memory-test/route.ts`: diagnostic graph write/read route; keep it out of production workflows.
- `app/globals.css`: global visual tokens and base styles.

## Safety and data rules

- Never delete graph data or run destructive migrations without explicit approval.
- Never commit `.env` files, API keys, passwords, access tokens, or generated secrets.
- Do not merge people solely because their first names match. Reuse a canonical person only when the match is unique; otherwise ask for clarification.
- User identity must be explicit and user-scoped; do not treat `default` as real authentication.
- Retrieve and cite relevant graph evidence before claiming a memory.
- Validate dynamic labels and relationship types with allow-lists; parameterize values.
- Preserve existing API contracts unless a change is documented and tested.

## Git workflow

Each completed milestone gets a dedicated branch, focused commit(s), documentation updates, checks, and a pushed reviewable branch/PR. Do not merge to `main` without approval.

## Current verified baseline (2026-10-12)

- `main` includes the full feature stack through PR #10 and the Stage 1 audit fix from PR #11; Stage 2 upload work is on `feature/multimodal-agent`.
- `npm ci`, `npm test` (35 passed), `npm run lint`, and `npm run build` passed on the Stage 2 branch.
- `git diff --check` passed; the tracked-file scan found no committed secrets or environment files (only `.env.example`).
- Live Gemini/FalkorDB checks could not be run because the required environment variables are absent from this environment. File uploads are bounded and processed in memory, but chat/upload routes still require authentication and rate limiting before public multi-user deployment.
- `npm audit` reports five high-severity findings in the existing lint dependency tree; the suggested automatic fix downgrades `eslint-config-next` across a major version and was not applied. The new upload dependencies add no audit findings.

See `MEMORY.md`, `TRD.md`, and `CHANGELOG.md` for the maintained project record.
