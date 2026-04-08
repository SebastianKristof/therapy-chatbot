# AskDrKristof

AskDrKristof is a Vite + React client for guided reflective chat flows. The frontend now calls local `/api` endpoints, and those endpoints use Vercel AI Gateway so the provider key stays server-side and the active model is selected through environment variables.

## Stack

- React 19
- Vite 6
- TypeScript
- Tailwind CSS 4
- Vercel AI Gateway via the AI SDK (`ai`)

## Local Dev

Prerequisites:

- Node.js 22.x or newer
- npm 11.x or newer
- A Vercel AI Gateway API key

Setup:

1. Install dependencies with `npm install`
2. Create `.env.local` in the repo root
3. Add `AI_GATEWAY_API_KEY=your_key_here` to `.env.local`
4. Add `AI_GATEWAY_MODEL=google/gemini-3-flash` to `.env.local`
5. Start the app with `npm run dev`

Notes:

- The dev server prefers port `3000` and will automatically move to the next free port if `3000` is already in use.
- Local `npm run dev` includes Vite middleware that serves `/api/chat` and `/api/summary`, so you do not need `vercel dev` just to test the app locally.
- Without `AI_GATEWAY_API_KEY`, the UI still loads locally, but chat requests return a configuration message instead of calling the gateway.
- Change `AI_GATEWAY_MODEL` to switch providers or models without editing app code.

## Checks

- `npm run lint` runs TypeScript type-checking
- `npm run build` creates a production build in `dist/`

## Project Shape

- [`src/App.tsx`](/Users/seb/git_personal/ask-dr-kristof/src/App.tsx) controls onboarding, mode selection, and chat flow
- [`src/components/`](/Users/seb/git_personal/ask-dr-kristof/src/components) contains the UI screens and message components
- [`src/services/aiGatewayService.ts`](/Users/seb/git_personal/ask-dr-kristof/src/services/aiGatewayService.ts) sends browser requests to the local API layer
- [`server/askDrKristofService.ts`](/Users/seb/git_personal/ask-dr-kristof/server/askDrKristofService.ts) centralizes prompt construction and Vercel AI Gateway calls
- [`api/`](/Users/seb/git_personal/ask-dr-kristof/api) contains the Vercel serverless endpoints used in deployment
- [`design/`](/Users/seb/git_personal/ask-dr-kristof/design) contains the PRD drafts added for product planning
