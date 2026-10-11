# Reconnect PrepPilot to its current Lovable Cloud database

## Finding
The project's active backend is `sfqistvphltajnflugaa` (confirmed in the managed environment settings). Three files still hard-code the old, non-existent project `klwhrtyrniprkiswtlqb`, and the build forces those values into the browser bundle, so the published site talks to a dead address.

## Changes
1. `vite.config.ts` — remove the hard-coded old URL/key/project fallbacks and the `define` override, so the build uses the managed `VITE_SUPABASE_*` values for the active project.
2. `src/lib/supabase.ts` — replace the old fallback URL/key with the active project URL and its publishable (anon) key; keep env values taking priority.
3. `supabase/config.toml` — this file is managed automatically; confirm it reflects the active project (no manual edit unless it is stale and the platform regenerates it).
4. Server side already reads `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` / service role from the runtime, which point at the active project — no change.

No new database, no migrations, no data deletion.

## Verification
- Search confirms no remaining references to the old project.
- Build succeeds; built client assets contain only the active project URL.
- Sign-up and sign-in tested against the preview with a throwaway account; dashboard loads.
- Publish, then confirm the live site's assets reference the active project and the page loads.
