# PrepPilot — Feature Status

Truthful snapshot of what is actually implemented in the current codebase.
Anything not on the "Implemented" list is not shipped.

## ✅ Implemented and demo-ready

| Feature                               | Where                                                     |
| ------------------------------------- | --------------------------------------------------------- |
| Email/password auth (sign up + in)    | `src/routes/auth.tsx`, Supabase Auth                      |
| Auth-gated app routes                 | `src/routes/_authenticated/route.tsx`                     |
| Landing page                          | `src/routes/index.tsx`                                    |
| Resume PDF upload → private storage   | `resumes` bucket (RLS, owner-scoped)                      |
| AI resume extraction → candidate JSON | `src/lib/interview.functions.ts` (`analyzeResume`)        |
| Editable candidate profile UI        | `src/routes/_authenticated/resume.tsx`                    |
| Interview configuration              | `src/routes/_authenticated/interview.new.tsx`             |
| Adaptive interview engine             | `submitAnswer` in `src/lib/interview.functions.ts`        |
| 5-dimension answer evaluation         | Accuracy, Clarity, Relevance, Problem Solving, Communication — persisted to `evaluations` |
| Real-time countdown + auto-end        | `src/routes/_authenticated/interview.$interviewId.index.tsx` |
| Anti-cheat (tab-blur, fullscreen)     | same file                                                 |
| Final report with radar + per-Q view  | `src/routes/_authenticated/interview.$interviewId.report.tsx` |
| Personalized learning roadmap         | `learning_roadmaps` table + `interview.$interviewId.roadmap.tsx` |
| Dashboard analytics (real data only)  | `src/routes/_authenticated/dashboard.tsx`                 |
| History timeline                      | `src/routes/_authenticated/history.tsx`                   |
| Provider-agnostic AI adapter          | `src/lib/ai.server.ts` (Groq primary, OpenRouter fallback) |
| Full RLS + storage policies           | `supabase/migrations/`                                    |
| Light/dark theme                      | `src/styles.css`                                          |

### Readiness score methodology

Deterministic. For a completed interview:

1. Every candidate answer is scored by the LLM on 5 dimensions (1–10 each).
2. The evaluation row's `overall_score` = arithmetic mean of the 5 dims.
3. Interview `readiness` (%) = mean of all evaluations' `overall_score` × 10.

No hidden weighting, no randomness. Recomputable from the `evaluations` table
alone.

## 🟡 Implemented but could use polish

- Cross-session weakness carryover (roadmap is per-interview; no aggregation
  across a user's history yet).
- Roadmap study links are LLM-generated titles, not curated URLs.
- Report empty-states exist but could show richer guidance when zero answers
  were submitted.

## 🚫 Not implemented / future scope

- **Voice / speech-to-text interview mode** — being developed separately.
  The integration point is intentionally clean: the voice module only needs
  to transcribe audio into a string and call the existing `submitAnswer`
  server function with `{ interviewId, answer: string }`. No change to
  `submitAnswer`'s contract, evaluation logic, or persistence is required.
- Live collaborative coding environment.
- Webcam-based behavior analysis.
- Gamification / leaderboards.
- Team / recruiter accounts.
- Email notifications and reminders.

## Voice module integration contract (for future work)

Keep the following stable so the voice module can drop in without touching
the interview core:

- **Input:** microphone stream captured in the browser.
- **Transcription:** perform STT in a new dedicated server function (e.g.
  `transcribeAudio`) or via a browser Web Speech API — server-side is
  preferred so the STT provider key stays server-only.
- **Submission:** call the existing `submitAnswer({ interviewId, answer })`
  server function with the transcript string. Do **not** modify its input
  shape, evaluation pipeline, or DB writes.
- **UI hook:** the interview room already exposes a voice-mode placeholder
  panel; wire the mic UI there and continue rendering the same message list.

Following this contract means the voice module is additive — no regressions
to the text interview loop.
