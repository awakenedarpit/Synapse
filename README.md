# Synapse — Persistent Graph Memory for AI Agents

Synapse is a personal knowledge workspace for AI conversations. Instead of treating every chat as a blank slate, it turns useful details into linked memories, retrieves relevant context when you ask a question, and lets you explore the connections in a visual graph.

Built with **Next.js, TypeScript, signed guest sessions, FalkorDB, and configurable AI-provider fallback** for the Graph Hacks hackathon.

## Why Synapse?

AI conversations are useful, but important details can get scattered across chats and documents. Synapse is designed to preserve the context behind your work and make it easier to find again.

- **Remember useful context** — save relevant conversation details as graph-backed memories.
- **Connect the dots** — extract people, projects, teams, skills, and other entities with typed relationships.
- **Ask context-aware questions** — retrieve user-scoped graph evidence and use it to inform answers.
- **Explore your knowledge visually** — inspect memory entities and their connections in the graph explorer.
- **Bring documents into the conversation** — upload supported files, review extraction previews, and send their extracted text to the agent.
- **Choose an AI provider strategy** — configure Gemini, Groq, and OpenRouter in a preferred order; providers without keys are skipped and eligible failures can fall back to the next provider.
- **Use a familiar workspace** — responsive chat UI, light/dark themes, conversation history in the browser, with automatic guest-session initialization.

## Product overview

| Area | What it does |
| --- | --- |
| Chat workspace | Chat with the agent, start conversations, use starter prompts, and attach supported documents or images. |
| Graph explorer | Visualize stored nodes and relationships, refresh graph data, and select nodes to inspect their details. |
| Memory layer | Persist useful facts, resolve entities, track relationship provenance, and retrieve bounded graph evidence. |
| File extraction | Validate files, extract text and structure, and show a preview before the content is sent. |
| Authentication | Public guest mode uses a signed, HttpOnly, SameSite cookie. Server routes derive scope only from the verified guest identity. |

## Tech stack

- **Web application:** Next.js App Router, React, TypeScript
- **Styling:** Tailwind CSS and custom responsive styles
- **Authentication:** HMAC-signed guest sessions
- **Graph database:** FalkorDB
- **AI:** Gemini, Groq, and OpenRouter provider configuration
- **Graph visualization:** `react-force-graph-2d`
- **Document processing:** PDF.js, JSZip, CSV parsing, XML parsing, and Sharp

## Getting started

### Prerequisites

- Node.js 22.13 or newer
- npm
- At least one configured chat AI provider
- A reachable FalkorDB instance for graph-backed memory features

### 1. Clone and install

```bash
git clone https://github.com/awakenedarpit/Synapse.git
cd Synapse
npm ci
```

### 2. Create your local environment file

Copy the example file:

**macOS / Linux**
```bash
cp .env.example .env.local
```

**Windows PowerShell**
```powershell
Copy-Item .env.example .env.local
```

Open `.env.local` and fill in the values described below. Keep this file local: **never commit it or paste secrets into public issues, chat messages, or screenshots.**

### 3. Configure environment variables

| Variable | Required? | Purpose |
| --- | --- | --- |
| `GUEST_SESSION_SECRET` | Required | At least 32 random server-only characters used to sign seven-day guest cookies. |
| `PUBLIC_APP_URL` | Optional | Canonical deployed origin used for request-origin validation. |
| `GEMINI_API_KEY` | Optional if another chat provider is configured; needed for image/scanned-PDF extraction | Gemini chat fallback and vision-based extraction. |
| `GROQ_API_KEY` | Optional | Enables Groq in the configured provider order. |
| `OPENROUTER_API_KEY` | Optional | Enables OpenRouter in the configured provider order. |
| `AI_PROVIDER_PRIORITY` | Optional | Provider order, e.g. `gemini,groq,openrouter`. |
| `GEMINI_CHAT_MODEL` | Optional | Gemini chat model override. |
| `GROQ_CHAT_MODEL` | Optional | Groq chat model override. |
| `OPENROUTER_CHAT_MODEL` | Optional | OpenRouter chat model override. |
| `GEMINI_VISION_MODEL` | Optional | Gemini vision model used for images and scanned PDFs. |
| `UPLOAD_TOKEN_SECRET` | Recommended in production | Stable random secret used to sign short-lived upload-preview tokens. |
| `FALKORDB_HOST` | Required for graph memory | FalkorDB hostname. |
| `FALKORDB_PORT` | Usually `6379` | FalkorDB port. |
| `FALKORDB_USERNAME` | Depends on deployment | FalkorDB username, if required. |
| `FALKORDB_PASSWORD` | Depends on deployment | FalkorDB password. Keep it private. |
| `FALKORDB_GRAPH_NAME` | Optional | Graph name; defaults to `memory_agent`. |
| `FALKORDB_TLS` | Optional | Set `true` for FalkorDB Cloud/TLS endpoints; defaults to `false` for local plain TCP. |
| `UPSTASH_REDIS_REST_URL` | Recommended in production | Upstash Redis REST endpoint for durable serverless rate limiting. |
| `UPSTASH_REDIS_REST_TOKEN` | Recommended in production | Upstash Redis REST token; keep it private. |

Use model identifiers that are currently enabled for your provider account. Do not prefix server-only credentials with `NEXT_PUBLIC_`.

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

- **Chat workspace:** `/`
- **Graph explorer:** `/graph`

For local and Vercel deployments, set `GUEST_SESSION_SECRET` and the graph/AI variables in the hosting environment, then redeploy. The browser automatically creates or resumes a seven-day guest session. Clearing cookies or switching browsers creates a new isolated guest graph. Configure the optional Upstash variables for durable rate limiting across Vercel instances; without them, a bounded in-memory fallback protects a single instance only.

## Supported uploads

The chat workspace accepts:

- PDF
- DOCX and PPTX
- TXT, Markdown, and CSV
- JPG/JPEG, PNG, and WEBP

Before sending, Synapse displays an extraction preview where available, including headings, tables, extracted text, and PDF-page or presentation-slide references. Text-based PDFs are parsed locally; scanned PDFs and images use the server-side Gemini vision model.

Current application limits:

- Up to **5 files per selection**
- **10 MB per file** and **20 MB combined**
- Up to **100 PDF pages or presentation slides**
- Up to **30 MB** of expanded Office archive data
- Up to **16 megapixels** per image
- Extracted text capped at **20,000 characters per file**

Uploads are processed in memory rather than written to local disk. When you send a message with an attachment, its extracted content can be saved as a document-source memory in the configured graph.

## How it works

1. You chat with Synapse or send a supported document.
2. The server validates the request and verifies the signed guest-session cookie.
3. The configured AI provider generates a response and, when appropriate, extracts entities and relationships.
4. Useful memories and their provenance are stored in FalkorDB under the verified guest identity's scope.
5. Later questions retrieve bounded graph evidence to help the agent answer with relevant context.
6. The graph explorer presents stored entities and relationships so you can inspect how information connects.

The graph is intended to make context inspectable—not to make every generated answer automatically true. Check important answers against their source material.

## Development and verification

Run the project's checks before submitting changes:

```bash
npm run lint
npm test
npm run build
```

Live AI and FalkorDB behavior depends on valid external credentials and reachable services. Unit/regression tests do not replace testing against your own configured deployment.

## Security and privacy notes

- Guest sessions are the public authentication mechanism. Protected server routes verify the signed cookie and derive graph ownership from the verified guest identity.
- AI and database credentials must remain server-side.
- Upload-preview tokens are signed, short-lived, and tied to the authenticated user.
- Graph retrieval is bounded and user-scoped; request-body or query-string user IDs must not be used as authorization.
- Memory correction and forgetting should target exact memory IDs. Forgetting is designed around reversible deletion markers rather than destructive graph deletion.
- Do not expose the diagnostic `/api/memory-test` route as a public production workflow.
- Before public, high-volume use, configure deployment-level rate limiting and review provider quotas, data retention, and access policies.

## Project structure

```text
app/
  api/
    chat/          # AI chat and graph-backed memory workflow
    graph/         # Graph data for the explorer
    memory/        # Memory correction and forgetting
    memory-test/   # Diagnostic graph read/write check
    upload/        # Validated file extraction and preview tokens
  graph/           # Interactive graph explorer
  page.tsx         # Chat workspace
  layout.tsx       # App shell and page metadata
lib/
  auth.ts          # Shared server-side guest identity verification
  file-extraction.ts
.env.example       # Safe environment-variable template
```

## Contributing

Issues and focused pull requests are welcome. Please include relevant regression tests for changes to memory identity, graph persistence, retrieval, user scoping, uploads, or memory correction/forgetting. Never include real credentials or personal memory data in examples or test fixtures.

## License

No license file is currently included. Unless a license is added, reuse and redistribution are not granted by default.
