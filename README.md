# AskDrKristof

I built this as a study in how a conversational assistant can use a small, inspectable knowledge base during a reflective exchange. I wanted to see whether it could select a useful source for the current turn and let a reviewer inspect what informed the response.

The project uses fictional examples and design notes for inspection. Its deployed interface has a separate client onboarding flow. For a technical walkthrough, use the repository and local development setup below.

## How the retrieval works

~~~mermaid
flowchart TD
    A["New message"] --> C["Build the model request"]
    A --> R["Retrieve relevant source passages"]
    R --> C
    B["Rolling conversation summary"] --> C
    C --> D["Gateway model response"]
~~~

The server keeps the gateway key out of the browser. It retrieves passages from a LlamaIndex.TS index and combines them with a rolling conversation summary when constructing the request. The source passages, retrieval scores, and corpus metadata are available in the local debug view. The app also accepts voice input through a separate transcription route.

A fictional example to try locally is “I keep asking friends to decide whether I should take the new job.” Inspect which passages a turn retrieved and whether the reply helps the person think through the choice. A retrieved passage alone tells you little about the quality of the reply, so read both.

## Run locally

Use Node.js 22+ and npm 11+.

~~~sh
npm ci
cp .env.example .env.local
npm run dev
~~~

Set `AI_GATEWAY_API_KEY` and choose a model using [`.env.example`](.env.example) when you want to send chat requests. The development server serves the UI and local chat routes. Voice transcription uses `OPENAI_API_KEY`.

### Inspect or rebuild the index

The [example corpus](knowledge_sources/design_split/) contains policy, mode playbooks, examples, and interface copy derived from the [project design notes](design/). These commands regenerate and ingest it.

~~~sh
npm run prepare:design-knowledge
npm run ingest:design-knowledge
~~~

For a different corpus, keep your source files in a local `materials/` directory and run `npm run ingest:materials`. The ingestion command needs credentials for the configured embedding provider. Its defaults are described in [`.env.example`](.env.example).

To inspect retrieval while developing, enable `RAG_DEBUG=true` locally and send a fictional message. The debug panel shows the retrieved source passages and scores. The [guidance guide](GUIDANCE_README.md) explains how to supply curated question-and-answer examples. [`vercel.json`](vercel.json) shows how the built index is bundled with serverless endpoints.

## Checks

~~~sh
npm run lint
npm run build
~~~

The client uses React and Vite. The server code in [`server/`](server/) owns request construction and provider calls. The handlers in [`api/`](api/) expose the routes used by the deployment.
