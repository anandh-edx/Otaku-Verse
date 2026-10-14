# Otaku Verse

YOUR WORLD. YOUR ANIME. YOUR COMMUNITY.

React + TypeScript + Vite + Tailwind, backed by Supabase (Auth, Postgres + RLS, Realtime, Storage) and the AniList GraphQL API.

## Status (honest)

| Area | State |
|---|---|
| Supabase project `otaku-verse` (ap-south-1) | Exists. Schema, RLS, triggers, rate limits, storage buckets, realtime publication and seed data (6 communities, 7 chat rooms) are applied. |
| Frontend source | Written (all pages). **Not yet compiled, type-checked or run in a browser**: the build sandbox blocked npm. Only a syntax-only parse was done. |
| Cross-user / RLS tests | **Not run.** Follow the checklist below. |
| Google OAuth | Code is wired. Needs provider credentials in Supabase (see below). |
| Payments | Not implemented. Premium page is a labelled preview. |
| Deployment | Not deployed. |

## Run locally

```bash
npm install
cp .env.example .env     # public URL + publishable key only
npm run dev
npm run build            # fix any TypeScript errors first
```

Never put a `service_role` key in `.env` or the frontend.

## Supabase configuration

1. **URL / key**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (project settings > API).
2. **Auth > URL configuration**: set Site URL to your deployed origin and add redirect URLs:
   `http://localhost:5173/**`, `https://<your-domain>/**` (needed for `/onboarding`, `/reset-password`, `/home`).
3. **Google OAuth**: Google Cloud Console > OAuth client (Web). Authorized redirect URI:
   `https://wrflnptiugpvxdnhhbop.supabase.co/auth/v1/callback`. Paste client ID/secret into Auth > Providers > Google.
4. **Email verification**: Auth > Providers > Email > "Confirm email". Off = instant login after signup; on = signup shows "check your email". The UI handles both.
5. **Admin / moderator**: roles can't be set from the app. In the SQL editor:
   `update public.profiles set role = 'admin' where username_lower = 'yourname';` (the profile guard trigger blocks client changes).
6. **AniList**: no key needed for public queries (rate limit ~90 req/min; the UI shows a rate-limit message).

## Deploy (e.g. Vercel / Netlify / Cloudflare Pages)

- Build: `npm run build`, output `dist`. SPA fallback: rewrite all paths to `/index.html`.
- Env vars: the two `VITE_` values above only.

## Test checklist (do before launch)

1. Sign up with email; confirm profile row + `user_settings` created. Try a duplicate username (case-different) and a reserved one (`admin`).
2. Refresh: session restores. Sign out/in. Forgot-password > reset link > new password.
3. Two browsers, two accounts: send a message in `#global`; it appears live on the other and after refresh. Test typing indicator, reply, reaction, edit, delete, retry while offline.
4. DM + group creation; third account must NOT see their messages (try querying `messages` with that account's token).
5. Post / comment / like / bookmark / follow; spoiler hidden until clicked.
6. Block a user (their posts/messages disappear for you); report a post.
7. As a normal user, try `update profiles set role='admin'`, reading `content_reports` of others, `moderation_actions`: all must fail.
8. As moderator: hide content, warn, suspend (suspended user can't post), ban, appeal flow, audit log entries.
9. Mobile width (bottom nav) and desktop (sidebar); keyboard focus; offline banner.

## Known gaps / follow-ups

- Mention notifications call `rpc('notify')` from the client; that function may not be executable by `authenticated` (silently ignored). Better: handle mentions in the `post_notify` / comment triggers.
- Supabase security advisor flags SECURITY DEFINER functions callable via `/rest/v1/rpc`. RLS helpers need this; consider `revoke execute ... from anon` for everything except `check_username_available`, and review `mod_*` (they self-check `is_staff`).
- Typing indicators/presence use Realtime broadcast/presence (client-trusted, cosmetic only).
- Premium perks are not implemented beyond the badge flag; no payment provider configured.
