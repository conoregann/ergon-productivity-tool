# Deployment and authentication setup

## Supabase

1. Create a Supabase project and retain its project reference, URL, and publishable key. Keep database credentials and secret/service-role keys outside the repository and frontend.
2. With the Supabase CLI installed, run from this repository:

   ```sh
   supabase init
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   ```

   Local CLI configuration is checked in; skip `supabase init` for this checkout. The versioned migrations in this repository are the authoritative schema. Link only the intended project, never an unrelated existing database.

   For updates, inspect `supabase migration list --linked` and preview `supabase db push --linked --dry-run`, then apply pending migrations before running the updated frontend. The labels UI requires migration `20261009000200`; JSON portability requires `20261009000300`; scheduling requires `20261009000400`; task saves with deadline times require `20261009000500` (including label edits from the current frontend). The expanded board colour palette requires `20261009000600`. A pre-label snapshot is normalized for board reads, but the new writes still require the matching database functions.

3. Enable the GitHub provider under Authentication → Sign In / Providers. Create a GitHub OAuth application whose authorization callback URL is the callback shown by Supabase (`https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`). Enter its client ID and secret into Supabase, never into the React app.
4. Set the Supabase Site URL to the production Vercel origin. Add `http://localhost:5173` to the redirect allowlist for local development. Allow only specific controlled preview URLs when testing OAuth previews. The app requests its current origin as the post-auth redirect.
5. Set `.env.local` using `.env.example`. Restart Vite after changing environment variables.

Official references: [GitHub OAuth setup](https://supabase.com/docs/guides/auth/social-login/auth-github), [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Vercel

1. Import the public GitHub repository into the intended Vercel account/team. `vercel.json` configures the Vite build and response headers.
2. Use Node 22.x. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for each deployment environment. Values are embedded at build time; redeploy after changes.
3. Deploy `main`, then configure the resulting origin in Supabase's Site URL and redirect allowlist.
4. Confirm HTTPS, sign in with GitHub, reload to verify session persistence, and sign out. Use two users to verify each sees only their own rows. Create a board in the app and verify editing, movement, and archive/restore. Open the same board in two sessions and confirm stale edits preserve the draft and prompt a refresh.

The public repo and build configuration can be established without cloud secrets. A live deployment and real OAuth round trip require an actual Supabase project, GitHub OAuth application, and Vercel project.

## Release checks

Run local gates and confirm GitHub CI. Before releasing editable workflows, run against a full local/hosted Supabase instance: two-user read/write isolation for every table; stale-version edits; rollback on failed mutation; real OAuth redirect/reload/logout; and date-only deadlines versus UTC sessions around DST transitions. PWA and offline support are not part of this foundation.

## Hosted integration check

With `.env.local` configured and the Supabase CLI authenticated to the intended project, run `npm run test:live`. This creates two temporary password-authenticated users and checks persisted board/card/label writes, scheduling/preferences, JSON export/import with remapped relationships, HTTP 409 stale-write rejection, owner isolation, and access denial after logout. It removes both users and their owned data in a `finally` block. The admin key stays in the Node process and is never stored in frontend configuration. A cleanup failure reports the temporary user IDs for removal.

This check does not exercise the GitHub browser consent/callback or Vercel. Verify those manually: sign in with GitHub, reload the application, confirm the account and board remain available, sign out, and confirm private data disappears. Repeat on the production origin with a second GitHub account.

Browser workflow tests use an isolated simulated backend; database tests execute the migrations. Both are necessary, and neither substitutes for the hosted and real OAuth checks.
