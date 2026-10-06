# Dashboard Heuristic Evaluator

Upload a dashboard screenshot and get a scored heuristic review: an overall score, a score per rubric layer, every issue pinned on the screenshot with severity (Nielsen 1–4), evidence and a fix, plus strengths to keep. Export as Markdown or JSON.

Google Gemini (`gemini-3.8-flash`, on Google's free tier) reviews the image against the rubric in `lib/rubric.ts`.

## Run it on your computer

You need [Node.js](https://nodejs.org) 20 or newer and a free Gemini API key from https://aistudio.google.com/apikey (sign in with a Google account and click **Create API key**; no card needed).

```bash
npm install
cp .env.example .env.local      # on Windows: copy .env.example .env.local
# open .env.local and paste your key after GEMINI_API_KEY=
npm run dev
```

Open http://localhost:3000, drop in a screenshot (or paste one with Ctrl+V) and press **Evaluate screen**. A review takes about a minute.

## Editing the heuristics

Everything the evaluator checks lives in `lib/rubric.ts`: layers (Core usability, Dashboard design, Data viz integrity, Accessibility) plus domain packs (Finance, Enterprise, Infographic) that only apply to that dashboard type. Add, remove or reword heuristics there; no other code needs to change.

## Putting it online

The easiest host is [Vercel](https://vercel.com) (free tier works):

1. Push this folder to a GitHub repository.
2. In Vercel, **Add New → Project**, import the repository.
3. Under **Environment Variables** add `GEMINI_API_KEY`, and also `ACCESS_CODE` (any password) so strangers can't use up your free quota.
4. Deploy. Visitors either enter the access code or paste their own free Gemini key.

If you leave `GEMINI_API_KEY` unset on the server, every visitor uses their own key and there is nothing for you to manage.

## About the free tier

- No cost, but Google caps how many requests a key can make per minute and per day. When the cap is hit the app says so; it resets on its own.
- On the free tier Google may use uploaded screenshots to improve its products. Don't upload confidential client dashboards with a free key.
- Turning on billing for the key in Google AI Studio removes both limits, at a small per-review cost.

## Files

- `app/page.tsx` – upload screen and report view
- `app/api/evaluate/route.ts` – receives the screenshot and calls the evaluator
- `lib/evaluate.ts` – the prompt and the Gemini API call
- `lib/rubric.ts` – the heuristics
- `lib/schema.ts` – the shape of a report
