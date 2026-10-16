# Graph Memory Agent

Graph Memory Agent is a Next.js application for the Graph Hacks hackathon. It combines Gemini with FalkorDB to save raw memories, extract entities and typed relationships, answer from recent memory, and visualize the graph.

## Requirements

- Node.js 22.13+
- npm
- Gemini API credentials
- FalkorDB credentials and a reachable graph instance for personal-memory features

## Local setup

```bash
npm ci
cp .env.example .env.local
# Fill .env.local locally; never commit it.
npm run dev
```

Open <http://localhost:3000> for chat and <http://localhost:3000/graph> for the graph explorer.

## File uploads

The chat composer accepts PDF, DOCX, PPTX, TXT, Markdown, CSV, JPG/JPEG, PNG, and WEBP files. Extraction previews show available headings, tables, page/slide references, and extracted text before sending. PDF text is parsed locally; scanned PDFs and images use the server-side Gemini vision API. Office documents are read as OOXML/ZIP packages without executing macros.

Uploaded bytes are processed in memory and are not written to local disk. When a message is sent, the extracted file content is stored in FalkorDB as a document-source memory. Uploads are limited to five files, 10 MB per file, 20 MB combined, 100 PDF pages or slides per presentation, 30 MB of expanded Office archive data, and 16 megapixels per image. Extracted text is capped at 20,000 characters per file. Image and scanned-PDF extraction require `GEMINI_API_KEY` configured on the server; never expose it through a `NEXT_PUBLIC_` variable.

## Verification

```bash
npm run lint
npm run build
npm test
```

Gemini is required for chat, but FalkorDB is optional for general-knowledge questions. Personal-memory retrieval and persistence are best-effort: graph outages are reported separately and must not discard an otherwise valid Gemini answer. `GEMINI_CHAT_MODEL` and `GEMINI_VISION_MODEL` can be set to model identifiers enabled for the target Gemini account. See `AGENTS.md`, `MEMORY.md`, `PRD.md`, and `TRD.md` for architecture, safety rules, requirements, and verified status.

## Current status

The current implementation includes a responsive premium chat workspace with dark/light themes, graph-backed memory persistence and retrieval, selective persistence for memory-relevant turns, entity identity resolution, provenance-aware typed relationships, bounded Gemini graph tools, recent conversational context, exact-memory correction with revision history, reversible forgetting, and validated document/image uploads with extraction previews. The graph explorer includes refresh, loading, empty, error, and node-detail states.

**Important:** user scope is currently based on a normalized request-level `userId`, not an authenticated session. The chat/upload API routes do not yet enforce authenticated identities or rate limits; control access before public multi-user deployment. Configure an authentication provider before using this as a multi-user production service. The live Gemini and FalkorDB routes also require the environment variables in `.env.example`.
