# Apply migrations to hosted Supabase

Run these steps from this repository. They update the database used by your hosted Ergon app. The SQL files are already written; `db push` applies pending files and records their versions.

## 1. Open the repository in Terminal

```sh
cd "/Users/conoregan/Library/Mobile Documents/com~apple~CloudDocs/iCloud Downloads/Documents/Projects/ergon-productivity-tool"
```

## 2. Check Node and the Supabase CLI

```sh
node --version
npx supabase --version
```

Use Node 22 for this project. If `npx` asks to install Supabase, accept. You can use `supabase` instead of `npx supabase` throughout if the CLI is already installed globally. See the [official CLI setup guide](https://supabase.com/docs/guides/local-development/cli/getting-started).

This repository already includes `supabase/config.toml`, so initialization is complete.

## 3. Find the correct Supabase project

Open the Supabase dashboard and select the project used by Ergon. Copy the project reference from the dashboard URL:

```text
https://supabase.com/dashboard/project/YOUR_PROJECT_REF
```

Check that the project's API URL matches `VITE_SUPABASE_URL` in your local `.env.local` and Vercel environment settings. The project reference is the identifier in `https://YOUR_PROJECT_REF.supabase.co`, unless you use a custom domain.

## 4. Sign in and link the repository

```sh
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
```

Replace `YOUR_PROJECT_REF` with the real reference. Complete the browser login. If prompted for a database password, enter your Supabase project's database password, rather than your GitHub or Supabase account password. Enter credentials in the prompt instead of storing them in the repository.

## 5. Inspect migration history

```sh
npx supabase migration list --linked
```

The Local column lists files in this repository; Remote lists versions already applied to the linked database. A local version with a blank Remote column is pending. The sharing migration is `20261009000700_board_sharing.sql`; any earlier pending migrations must also be applied. See the [official migration-list reference](https://supabase.com/docs/reference/cli/supabase-migration-list).

If tables already exist but their migration history is missing, or the remote history contains versions absent from this checkout, stop and reconcile the history before continuing. Save the output for diagnosis. Do not force migration history changes or reset the hosted database to bypass the mismatch.

## 6. Preview the pending migrations

```sh
npx supabase db push --linked --dry-run
```

This prints which migrations would run without applying them. Review the listed SQL files and confirm that you linked the intended project. An up-to-date database needs no migration push. See the [official db-push reference](https://supabase.com/docs/reference/cli/supabase-db-push).

## 7. Apply the migrations

```sh
npx supabase db push --linked
```

Review the pending list and confirm when prompted. Wait for the success message. This applies pending migrations in order and records them in the remote migration history; it does not reset the database. If it fails, retain the error and inspect migration history before retrying.

## 8. Verify completion

```sh
npx supabase migration list --linked
```

All local versions through `20261009000700` should now have matching Remote entries. In Supabase's Table Editor, `board_shares` should exist with RLS enabled. It is normal for it to be empty until an owner enables sharing.

Generated TypeScript database types are already committed. Applying the existing migrations does not require regenerating them or changing frontend keys.

## 9. Deploy and verify the app

Deploy the committed frontend after the database update. If Vercel deploys automatically from `main`, push the commits after the migration succeeds:

```sh
git push origin main
```

Check the deployment in Vercel. If you already pushed before migrating, redeploy the latest commit after the migration succeeds. Then:

1. Open a board and select **Share board**.
2. Select **Anyone with the link — viewer** and open the link in a private browser window. Viewing should work without signing in.
3. Change access to **Anyone with the link — editor**. Sign in as a second user and verify task editing; board settings and sharing must remain owner-only.
4. Set access to **Private**. Reload the shared link and verify that the board is unavailable.
5. Enable sharing again and verify that the new link works while the old link remains unavailable.
6. Confirm that other private boards and personal calendar data remain inaccessible to the second user.

Future updates use steps 5–9 once this checkout is linked. A new checkout or a different Supabase project needs linking again.
