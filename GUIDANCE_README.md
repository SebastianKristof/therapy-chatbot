# Guidance System (Super Simple)

This is the easiest way to "teach" the assistant how you answer real questions.

## What this does

- You add your own Q/A examples in one JSON file.
- The app checks each user message against those examples.
- If a match is very strong and marked `verbatim`, it returns your exact stored answer.
- If a match is strong and marked `adapt`, it uses your example as a pattern and writes a tailored response.

## 1) Create your guidance file

Create this file:

- `materials/guidance.json`

Fast start:

1. Copy `config/guidance.example.json`
2. Paste it into `materials/guidance.json`
3. Edit with your own real questions and answers

## 2) Entry format

Each entry looks like this:

```json
{
  "id": "short-unique-id",
  "mode": "ask_experience",
  "behavior": "verbatim",
  "question": "The kind of user question this should match",
  "answer": "How you want the assistant to answer",
  "followUpChips": [
    { "label": "Short chip", "prompt": "Full follow-up prompt" }
  ]
}
```

Notes:

- `mode`: one of `reflect`, `trigger`, `reinforce`, `prepare`, `ask_process`, `ask_experience`, `chat`, or `any`.
- `behavior`:
  - `verbatim` = return your stored answer directly when match is high.
  - `adapt` = use your answer as a template/style, but tailor to the user.
- `followUpChips` is optional (recommended for `verbatim`).

## 3) Run your app

No extra build step is needed for guidance.

Just run:

```bash
npm run dev
```

The server reloads guidance when `materials/guidance.json` changes.

## 4) Tune matching (optional)

In `.env.local`:

- `GUIDANCE_VERBATIM_THRESHOLD=0.90` (higher = stricter exact-answer matching)
- `GUIDANCE_ADAPT_THRESHOLD=0.78` (higher = fewer adapt matches)
- `GUIDANCE_MATCH_LIMIT=3` (max adapt examples used per turn)

## Quick practical workflow

1. Collect real user questions.
2. Write how you’d answer them.
3. Mark truly fixed answers as `verbatim`.
4. Mark style/template answers as `adapt`.
5. Test in chat, then tighten thresholds if it over-matches.
