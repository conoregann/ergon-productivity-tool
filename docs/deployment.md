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

   `supabase init` creates the local CLI configuration; review and commit it if adopting local Supabase development. The versioned migration in this repository is the authoritative schema. Apply it to a new project, not an unrelated existing database.

3. Enable the GitHub provider under Authentication → Sign In / Providers. Create a GitHub OAuth application whose authorization callback URL is the callback shown by Supabase (`https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`). Enter its client ID and secret into Supabase, never into the React app.
4. Set the Supabase Site URL to the production Vercel origin. Add `http://localhost:5173` to the redirect allowlist for local development. Allow only specific controlled preview URLs when testing OAuth previews. The app requests its current origin as the post-auth redirect.
5. Set `.env.local` using `.env.example`. Restart Vite after changing environment variables.

Official references: [GitHub OAuth setup](https://supabase.com/docs/guides/auth/social-login/auth-github), [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Vercel

1. Import the public GitHub repository into the intended Vercel account/team. `vercel.json` configures the Vite build and response headers.
2. Use Node 22.x. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for each deployment environment. Values are embedded at build time; redeploy after changes.
3. Deploy `main`, then configure the resulting origin in Supabase's Site URL and redirect allowlist.
4. Confirm HTTPS, sign in with GitHub, reload to verify session persistence, and sign out. Use two users to verify each sees only their own rows. Seed an owned board via the Supabase dashboard to verify the current read-only board view.

The public repo and build configuration can be established without cloud secrets. A live deployment and real OAuth round trip require an actual Supabase project, GitHub OAuth application, and Vercel project.

## Release checks

Run local gates and confirm GitHub CI. Before releasing editable workflows, run against a full local/hosted Supabase instance: two-user read/write isolation for every table; stale-version edits; rollback on failed mutation; real OAuth redirect/reload/logout; and date-only deadlines versus UTC sessions around DST transitions. PWA and offline support are not part of this foundation.
