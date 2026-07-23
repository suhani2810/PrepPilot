# PrepPilot — Export & Self-Hosting Guide

This project was built inside the Lovable editor but has no runtime dependency
on Lovable infrastructure. You can clone it, point it at your own Supabase
project + an AI provider key (Groq or OpenRouter), and run it anywhere Node
runs.

## 1. Clone & install

```bash
git clone <your-fork-url> preppilot
cd preppilot
npm install    # or: bun install / pnpm install
```

Node 20+ recommended.

## 2. Create a Supabase project

1. Create a project at <https://supabase.com>.
2. In **Project Settings → API**, copy the **Project URL**, the **anon /
   publishable key**, and the **project ref**.

## 3. Apply the database schema

Every table, index, trigger, function, RLS policy, and the private `resumes`
storage bucket lives under `supabase/migrations/`. Apply them in order.

Easiest path — Supabase CLI:

```bash
npm i -g supabase
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase db push
```

Alternative: open the Supabase SQL editor and paste each file in
`supabase/migrations/` in filename order.

After migrations complete, verify in the Supabase dashboard:

- **Table editor** shows: `profiles`, `candidate_profiles`, `interviews`,
  `interview_messages`, `evaluations` — each with RLS enabled.
- **Storage** shows a private `resumes` bucket with the four owner-scoped
  policies on `storage.objects`.
- **Database → Functions** shows `tg_set_updated_at`, `handle_new_user`.
- **Authentication → Hooks / Triggers** — the `on_auth_user_created` trigger
  on `auth.users` is present (created by the migration).

## 4. Configure Supabase Auth

In **Authentication → Providers**:

- Enable **Email**. For a passwordless dev setup you may enable
  "Auto-confirm users" (skip email verification). Disable it for production
  and configure an SMTP provider.

In **Authentication → URL Configuration**:

- **Site URL**: `http://localhost:5173` for local dev, your production URL
  for deployment.
- **Redirect URLs**: add both `http://localhost:5173` and your production
  URL(s).

## 5. Get an AI provider key

You need **at least one** of:

- **Groq** (recommended, fastest) — <https://console.groq.com> → API Keys.
- **OpenRouter** (fallback / model variety) — <https://openrouter.ai/keys>.

Both providers expose OpenAI-compatible endpoints; the app's AI adapter uses
whichever key(s) you supply and can fail over between them.

## 6. Local environment

```bash
cp .env.example .env
```

Fill in the values you gathered above. Minimum required to boot the app:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
GROQ_API_KEY=...              # or OPENROUTER_API_KEY
```

`GROQ_API_KEY` / `OPENROUTER_API_KEY` are **server-only**. Do NOT prefix them
with `VITE_` — that would ship them to the browser.

## 7. Run

```bash
npm run dev       # local dev server
npm run build     # production build
npm run preview   # preview the production build locally
```

## 8. Deploy

The template builds a standard Nitro/Cloudflare-Workers-compatible output
under `.output/`. Any host that runs a Node/edge server works
(Cloudflare Workers, Vercel, Netlify, Fly, Render, a plain Node server).

Set all `.env` values as **server-side environment variables** in your host's
dashboard (never commit real values). After deploying, add your production URL
to Supabase → Authentication → URL Configuration → Redirect URLs.

## 9. Optional overrides

- `AI_PROVIDER=groq|openrouter` — pick primary provider.
- `GROQ_MODEL` / `OPENROUTER_MODEL` — override default model IDs.

## 10. Things this project does NOT need

- No Lovable API key.
- No Supabase edge functions (all server logic runs as TanStack
  `createServerFn`).
- No third-party email/SMS providers unless you want email verification.
