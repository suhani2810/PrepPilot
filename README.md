# PrepPilot — From Resume to Ready

PrepPilot is an AI-powered adaptive mock interview platform. Candidates upload
their resume, configure a target role, and take an adaptive interview where an
LLM asks progressively harder or easier questions based on live evaluation of
each answer. After the session, PrepPilot returns a per-dimension score
breakdown, an overall readiness percentage, and a personalized learning
roadmap targeted at the candidate's weakest areas.

**Tagline:** From Resume to Ready.

## Feature overview

- Email/password auth (Supabase Auth)
- Resume upload (PDF, stored in a private Supabase bucket)
- AI resume intelligence — extracts a structured candidate profile
- Interview configuration (role, level, type, duration)
- Adaptive interview engine — each next question is generated from resume,
  role, difficulty, and running evaluation history
- 5-dimension answer evaluation: Accuracy, Clarity, Relevance, Problem
  Solving, Communication
- Final report — overall readiness %, radar chart, per-question dissection
- Personalized learning roadmap — priority focus areas, quick wins, ordered
  study steps, persisted per interview
- Dashboard + history with trend analytics
- Anti-cheat safeguards in the interview room (tab-blur detection, optional
  fullscreen enforcement, session countdown)

See [`FEATURE_STATUS.md`](./FEATURE_STATUS.md) for the truthful shipped-vs-not
matrix.

## Architecture

- **Framework:** [TanStack Start](https://tanstack.com/start) v1 (React 19 +
  Vite 7, SSR via Nitro).
- **Routing:** file-based under `src/routes/`. Authenticated routes live
  under `src/routes/_authenticated/` and are gated by `route.tsx`.
- **Server logic:** typed RPCs via `createServerFn` in
  `src/lib/*.functions.ts`. No Supabase Edge Functions.
- **Database & Auth:** Supabase (Postgres + Auth + Storage). Every user-scoped
  table has RLS enabled; every policy is scoped to `auth.uid()`.
- **Storage:** private `resumes` bucket with owner-scoped RLS.
- **AI:** provider-agnostic adapter in `src/lib/ai.server.ts` using
  `@ai-sdk/openai-compatible`. Primary: **Groq**. Optional fallback:
  **OpenRouter**. All LLM calls happen server-side inside server functions;
  no keys ever reach the browser.
- **PDF extraction:** `unpdf` (WASM, runs inside the SSR worker).

## Project layout

```
src/
  routes/                  file-based routes (TanStack)
    __root.tsx             root layout + head metadata
    index.tsx              landing page
    auth.tsx               sign-in / sign-up
    _authenticated/        gated app routes
      route.tsx            auth gate
      dashboard.tsx
      resume.tsx
      history.tsx
      interview.new.tsx
      interview.$interviewId.index.tsx     interview room
      interview.$interviewId.report.tsx    scored report
      interview.$interviewId.roadmap.tsx   learning roadmap
  lib/
    ai.server.ts           provider-agnostic LLM adapter (server-only)
    pdf.server.ts          PDF text extraction (server-only)
    interview.functions.ts createServerFn RPCs for the full interview loop
  integrations/supabase/   generated Supabase clients (do not edit)
  components/              shared UI primitives (shadcn + prep/)
supabase/
  migrations/              full schema, RLS, triggers, storage bucket
```

## Local setup

Prerequisites: **Node 20+** and either **npm**, **bun**, or **pnpm**.

```bash
git clone <your-fork-url> preppilot
cd preppilot
npm install          # or: bun install / pnpm install
cp .env.example .env # then fill in the values (see below)
npm run dev
```

The dev server listens on the port Vite picks (default `5173`).

## Environment variables

Copy `.env.example` to `.env` and fill in:

| Variable                        | Where            | Required | Purpose                                                |
| ------------------------------- | ---------------- | -------- | ------------------------------------------------------ |
| `VITE_SUPABASE_URL`             | browser + server | yes      | Supabase project URL for the browser client            |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | browser + server | yes      | Supabase anon/publishable key for the browser client   |
| `VITE_SUPABASE_PROJECT_ID`      | browser          | yes      | Supabase project ref                                   |
| `SUPABASE_URL`                  | server           | yes      | Same URL, used by SSR + server functions               |
| `SUPABASE_PUBLISHABLE_KEY`      | server           | yes      | Same anon key, used by SSR + server functions          |
| `SUPABASE_PROJECT_ID`           | server           | yes      | Same project ref                                       |
| `SUPABASE_SERVICE_ROLE_KEY`     | server           | yes      | Trusted interview writes; never expose to the browser  |
| `GROQ_API_KEY`                  | server           | yes\*    | Primary LLM provider; required for voice transcription |
| `OPENROUTER_API_KEY`            | server           | yes\*    | Fallback LLM provider                                  |
| `GROQ_MODEL`                    | server           | no       | Override default Groq model                            |
| `GROQ_TRANSCRIPTION_MODEL`      | server           | no       | Override the Groq voice transcription model            |
| `OPENROUTER_MODEL`              | server           | no       | Override default OpenRouter model                      |
| `AI_PROVIDER`                   | server           | no       | `groq` (default) or `openrouter`                       |

\* At least one AI provider key is required. Voice Interview always requires
`GROQ_API_KEY`; the OpenRouter fallback only covers text generation.

Server-only keys must **never** be prefixed with `VITE_` — that would ship
them to the browser. `.env`, `.env.local`, and all `.env.*.local` files are
git-ignored; only `.env.example` is tracked.

The service-role key is used only after the caller's access token and resource
ownership are verified. Apply every migration before deploying this version;
the security migration revokes direct candidate writes to scores, messages,
reports, profiles, and roadmaps.

## Database setup

All schema, indexes, triggers, functions, RLS policies, and the private
`resumes` storage bucket live in `supabase/migrations/`. Apply them in
filename order.

Easiest path — Supabase CLI:

```bash
npm i -g supabase
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase db push
```

Alternative: open the Supabase SQL editor and paste each file under
`supabase/migrations/` in order.

After migrations, verify in the Supabase dashboard:

- **Tables:** `profiles`, `candidate_profiles`, `interviews`,
  `interview_messages`, `evaluations`, `learning_roadmaps` — each with RLS
  enabled.
- **Storage:** private `resumes` bucket with owner-scoped policies.
- **Functions:** `tg_set_updated_at`, `handle_new_user`.
- **Trigger:** `on_auth_user_created` on `auth.users`.

Then in **Authentication → Providers** enable **Email**. For a frictionless
dev experience you can enable "Auto-confirm users"; disable it for production
and wire an SMTP provider. Add your local and production URLs under
**Authentication → URL Configuration → Redirect URLs**.

## Build & run

```bash
npm run dev        # local dev server (SSR)
npm run build      # production build (Vite + Nitro)
npm run preview    # preview the production build
npm run lint       # eslint
```

## Deployment

The build produces a standard Nitro output. The default preset targets
Cloudflare Workers, but any Nitro-compatible host works (Cloudflare, Vercel,
Netlify, Fly, Render, plain Node). Set every value from `.env` as a
**server-side environment variable** on your host. After deploying, add your
production URL under Supabase → Authentication → Redirect URLs.

For deeper porting notes, model swaps, and provider setup, see
[`EXPORT_SETUP.md`](./EXPORT_SETUP.md).

## Future work

- Voice / speech-to-text interview mode (planned; integration point kept
  clean — see `FEATURE_STATUS.md`).
- Live collaborative coding.
- Webcam-based behavior analysis.

## Creators

PrepPilot is designed & built by:

- **Divyam Madan** — [GitHub](https://github.com/Divyam-Madan) · [LinkedIn](https://www.linkedin.com/in/divyam-madan/)
- **Suhani Mahajan** — [GitHub](https://github.com/suhani2810) · [LinkedIn](https://www.linkedin.com/in/suhani-mahajan-2431b8328/)
