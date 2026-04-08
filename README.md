# AskDrKristof

AskDrKristof is a Vite + React client for guided reflective chat flows. The frontend now calls local `/api` endpoints, and those endpoints use Vercel AI Gateway so the provider key stays server-side and the active model is selected through environment variables. Voice input uses the OpenAI API for transcription.

The chat backend also supports a LlamaIndex.TS knowledge layer for Dr. Kristof materials: ingest source files, persist an index locally, and retrieve only relevant chunks per user turn.

## Stack

- React 19
- Vite 6
- TypeScript
- Tailwind CSS 4
- Vercel AI Gateway via the AI SDK (`ai`)
- LlamaIndex.TS (`llamaindex`) for retrieval over indexed materials

## Local Dev

Prerequisites:

- Node.js 22.x or newer
- npm 11.x or newer
- A Vercel AI Gateway API key
- An OpenAI API key only if you use voice transcription or `EMBEDDING_PROVIDER=openai`

Setup:

1. Install dependencies with `npm install`
2. Create `.env.local` in the repo root
3. Add `AI_GATEWAY_API_KEY=your_key_here` to `.env.local`
4. Add `AI_GATEWAY_MODEL=google/gemini-3-flash` to `.env.local`
5. Add `EMBEDDING_PROVIDER=openai` (or `gateway`)
6. Add `OPENAI_API_KEY=your_openai_key_here` if using voice or `EMBEDDING_PROVIDER=openai`
7. Optionally set `OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe`
8. Start the app with `npm run dev`

Notes:

- The dev server prefers port `3000` and will automatically move to the next free port if `3000` is already in use.
- Local `npm run dev` includes Vite middleware that serves `/api/chat` and `/api/summary`, so you do not need `vercel dev` just to test the app locally.
- Without `AI_GATEWAY_API_KEY`, the UI still loads locally, but chat requests return a configuration message instead of calling the gateway.
- Without `OPENAI_API_KEY`, voice transcription is disabled; embeddings are also disabled if `EMBEDDING_PROVIDER=openai`.
- Change `AI_GATEWAY_MODEL` to switch providers or models without editing app code.
- Change `OPENAI_TRANSCRIPTION_MODEL` to swap transcription models without editing app code.

## Knowledge Base Ingestion (LlamaIndex.TS)

This project uses a retrieval-first approach for "trained on my materials":

- Keep the custom chat UX.
- Index your source materials once.
- Retrieve the most relevant chunks per turn.
- Combine retrieval context with rolling conversation memory.

### 1) Add source materials

Put text-like files under [`materials/`](/Users/seb/git_personal/ask-dr-kristof/materials) (supports `.txt`, `.md`, `.mdx`, `.markdown`, `.json`, `.csv`, `.html`, `.htm`).

### 2) Configure env values

In `.env.local`, set:

- `EMBEDDING_PROVIDER` (`openai` or `gateway`, default `openai`)
- `OPENAI_API_KEY` (required for embeddings when provider is `openai`)
- `AI_GATEWAY_API_KEY` or `EMBEDDING_GATEWAY_API_KEY` (required for embeddings when provider is `gateway`)
- optional `EMBEDDING_GATEWAY_BASE_URL` (defaults to `https://ai-gateway.vercel.sh/v1`)
- optional `MATERIALS_DIR`
- optional `KNOWLEDGE_INDEX_DIR`
- optional `KNOWLEDGE_EMBED_MODEL`
- optional `KNOWLEDGE_CHUNK_SIZE`
- optional `KNOWLEDGE_CHUNK_OVERLAP`
- optional `KNOWLEDGE_RETRIEVAL_TOP_K`
- optional `RAG_DEBUG` (`true` to always return retrieval debug details with `/api/chat`)
- optional `KNOWLEDGE_BASE_ENABLED`

See [`.env.example`](/Users/seb/git_personal/ask-dr-kristof/.env.example) for defaults.

### 3) Build the index

Run:

```bash
npm run ingest:materials
```

Optional overrides:

```bash
npm run ingest:materials -- --materials ./path/to/materials --index ./path/to/index
```

By default, index data is persisted under [`server/data/knowledge-index/`](/Users/seb/git_personal/ask-dr-kristof/server/data/knowledge-index) and used automatically by `/api/chat` retrieval.

`materials/*` is gitignored by default to reduce accidental commits of sensitive source content.

### 4) Chat with retrieval enabled

Start dev server and chat normally:

```bash
npm run dev
```

If no index exists (or retrieval is disabled), chat falls back to the existing prompt + rolling context summary behavior.

### RAG Debug (Verify Retrieval Turn-by-Turn)

To inspect exactly what was retrieved on each assistant response:

- set `RAG_DEBUG=true` in env, or
- open the app with `?ragDebug=1` in the URL

When enabled, assistant messages show a **RAG Debug** panel with source files, scores, corpus/rule metadata, and retrieved excerpts.

## Ingest Design PRDs (Split + Tagged)

If you want to ingest the `design/` PRDs using a structured RAG source layout:

1. Generate split, metadata-tagged source docs:

```bash
npm run prepare:design-knowledge
```

This creates [`knowledge_sources/design_split/`](/Users/seb/git_personal/ask-dr-kristof/knowledge_sources/design_split) with corpus folders:
- `policy`
- `mode_playbook`
- `examples`
- `ux_copy`

2. Ingest that generated folder:

```bash
npm run ingest:design-knowledge
```

Or manually ingest any folder:

```bash
npm run ingest:materials -- --materials ./knowledge_sources/design_split
```

## Production Deployment (Bundled Index on Vercel)

This repo is now configured to bundle the local knowledge index into deployed API functions via [`vercel.json`](/Users/seb/git_personal/ask-dr-kristof/vercel.json).

Workflow:

1. Rebuild the index locally after content changes:

```bash
npm run ingest:materials -- --materials ./knowledge_sources/design_split
```

2. Commit updated files under [`server/data/knowledge-index/`](/Users/seb/git_personal/ask-dr-kristof/server/data/knowledge-index)
3. Deploy to Vercel

This is a practical short-term setup. Every knowledge update requires re-ingest + redeploy.

## Curated Guidance (Q/A Examples + Verbatim Answers)

You can add a curated guidance file for stronger behavior than generic retrieval:

- `verbatim` entries: if a match is high-confidence, the app returns your exact stored answer.
- `adapt` entries: if a match is strong, the app uses your answer as a high-priority response pattern.

For a quick informal setup guide, see [GUIDANCE_README.md](/Users/seb/git_personal/ask-dr-kristof/GUIDANCE_README.md).

## Checks

- `npm run lint` runs TypeScript type-checking
- `npm run build` creates a production build in `dist/`

## Project Shape

- [`src/App.tsx`](/Users/seb/git_personal/ask-dr-kristof/src/App.tsx) controls onboarding, mode selection, and chat flow
- [`src/components/`](/Users/seb/git_personal/ask-dr-kristof/src/components) contains the UI screens and message components
- [`src/services/aiGatewayService.ts`](/Users/seb/git_personal/ask-dr-kristof/src/services/aiGatewayService.ts) sends browser requests to the local API layer
- [`src/services/openAiTranscriptionService.ts`](/Users/seb/git_personal/ask-dr-kristof/src/services/openAiTranscriptionService.ts) sends recorded audio to the local transcription API
- [`server/askDrKristofService.ts`](/Users/seb/git_personal/ask-dr-kristof/server/askDrKristofService.ts) centralizes prompt construction and Vercel AI Gateway calls
- [`server/openAiTranscriptionService.ts`](/Users/seb/git_personal/ask-dr-kristof/server/openAiTranscriptionService.ts) centralizes OpenAI transcription calls
- [`api/`](/Users/seb/git_personal/ask-dr-kristof/api) contains the Vercel serverless endpoints used in deployment
- [`design/`](/Users/seb/git_personal/ask-dr-kristof/design) contains the PRD drafts added for product planning
