# 0001 — Single application with Supabase

Status: accepted

Use the requested React/TypeScript/Vite stack with Supabase directly. A root application avoids workspace tooling without a second package. Feature folders keep presentation and data operations distinct without creating layers for unused features.

Use the official Vite scaffold's Oxlint, TypeScript, Prettier, Vitest, and Playwright as quality gates. Choose the calendar only after testing external dragging, resizing, timezone/DST handling, mobile agenda, keyboard alternatives, bundle size, and licensing.

GitHub OAuth uses Supabase PKCE and persistent sessions. Query caches are cleared on identity changes to avoid carrying private data between users. No service-role key may enter the frontend.
