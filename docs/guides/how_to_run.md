See [index.md](index.md) for the docs routing map.

## How to run (from package.json)
- `npm run dev` - start Vite dev server (**port 8080**; see [vite.config.ts](../../vite.config.ts)). The script invokes Vite via `node ./node_modules/vite/bin/vite.js` so Windows shells that do not resolve `node_modules/.bin` still work.
- If you use **pnpm** (see `packageManager` in [package.json](../../package.json)), prefer `pnpm dev` — pnpm wires local binaries reliably.
- `npm run build` - production build
- `npm run build:dev` - development build mode
- `npm run preview` - preview production build
- `npm run lint` - ESLint
- `npm run test` - Vitest run once
- `npm run test:watch` - Vitest watch

## Environment variables (Supabase + Vite)
The app reads Supabase from **Vite** env vars (must be prefixed with `VITE_` to reach the browser):

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Project URL, e.g. `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase **anon** public key (Dashboard → Settings → API) |
| `VITE_STUDENT_AGENT_URL` | Optional. Base URL of the **Python FastAPI** student agent (no trailing slash). Leave unset in local dev to use the Vite proxy to `127.0.0.1:8010`. **Required for production** on Vercel if the sidebar should call a hosted agent (see [student_workspace_agent.md](student_workspace_agent.md)). |

Copy [.env.example](../../.env.example) to `.env` and fill in the values. Since demo mode has been completely removed, these environment variables are strictly required to initialize the Supabase client and run the application.

**Do not** put the Google OAuth **client secret** in any `VITE_*` variable (it would be exposed in the client bundle). Configure Google under **Supabase Dashboard → Authentication → Providers → Google**.

## Google Cloud Console (Web OAuth client)
Use these when creating or editing the OAuth 2.0 **Web application** client that you attach to Supabase Google provider.

**Authorized JavaScript origins** (match the Vite dev port **8080**):
- `http://localhost:8080`
- `http://127.0.0.1:8080`
- `https://<your-production-domain>` (when deployed)
- `https://teamfair.company` (current production custom domain)
- `https://teamfair.vercel.app` (Vercel preview/fallback domain)

**Authorized redirect URIs** (OAuth code returns to **Supabase**, not your app origin):
- `https://<project-ref>.supabase.co/auth/v1/callback`  
  Use the same host as `VITE_SUPABASE_URL`.

**Supabase Dashboard → Authentication → URL configuration**
- **Site URL:** e.g. `http://localhost:8080` for local dev.
- **Redirect URLs:** include `http://localhost:8080/**` (and production URLs) so OAuth can return to paths such as `/login?role=...`.

## Supabase database migrations
SQL migrations live under [supabase/migrations](../../supabase/migrations/). Apply them to your hosted (or local) Postgres via the Supabase SQL editor, `supabase db push`, or your team’s migration workflow.

Order matters; examples in this repo:
1. `20260512120000_teamfair_core.sql` - enums, `public.users` (extends `auth.users`), groups, members, tasks, logs, AI evaluations, auth sync triggers, RLS enabled, grants.
2. `20260515100000_teamfair_rls.sql` - RLS policies (lecturer / student / admin scoping).
3. `20260516100000_users_profile_completed_and_signup_role.sql` - `profile_completed`, updated `handle_new_user`, `set_signup_role` RPC for Google sign-up role selection.
4. `20260517120000_persist_dashboard_state.sql` - persisted dashboard metadata and UI tables for task approval/deadline/priority/evidence, activity logs, student reports, materials, lecturer scores, lecturer-student reviews, and verified badges.
5. `20260519120000_chat_messages.sql` - chat history table for the AI assistant sidebar, scoped by `(user_id, group_id)` with RLS so users only read/write their own messages.
6. `20260520120000_security_hardening.sql` - database trigger and check constraints to reinforce role validation.
7. `20260522120000_persistent_calendar.sql` - calendar_events table to persist student calendar scheduling.
8. `20260522130000_notifications_schema.sql` - notifications table with RLS to support the custom Mail notification system.
9. `20260523120000_project_management_rls.sql` - relaxed RLS policies for groups insertion/selection/modification and joining project groups.
10. `20260525120000_security_rls_fixes.sql` - security hardening RLS migration containing fixes for calendar access, notifications forge vulnerabilities, and lecturer project view/escalation bugs.
11. `20260527150000_name_cooldown.sql` - name cooldown persistence and restrictions.
12. `20260527160000_member_management_rpcs.sql` - member role update and leader resignation RPCs.
13. `20260529120000_project_sharing.sql` - `project_invites` and `join_requests` tables to support invite code sharing and join request workflow, complete with RLS policies, constraints, indexes, and grants.
14. `20260529130000_allow_users_insert_self.sql` - `users_insert_self` RLS policy and `set_signup_role` RPC function hardening to automatically restore missing/deleted profile rows in `public.users`.
15. `20260529140000_delete_account_rpc.sql` - self-service account deletion and cascade updates.
16. `20260529150000_invite_rls_fixes.sql` - secure invite counter update RPC and group leader membership insert RLS fix.


Enable **Email** and **Google** under **Authentication → Providers** in Supabase to match the login UI.

### Simple deploy checklist
1. Run every SQL migration above in Supabase, in order, if the database does not already have them.
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to Vercel project environment variables.
3. Push the code to GitHub.
4. Let Vercel redeploy from GitHub.

If the SQL migration is skipped, Vercel can still render the app, but real logged-in dashboard data may fail to load/save because the database tables/columns are missing.

## Python AI Agent Server

The Python agent package mirrors the React student dashboard to allow deterministic reasoning and snapshots via tools.

### Prerequisites & Dependencies
All code is located in the **`python/`** directory.
```bash
cd python
pip install -r student_workspace_agent/requirements.txt
```

### Run the CLI Agent
To run a direct instruction on the store snapshot from the command line:
```bash
python -m student_workspace_agent -m "Your instruction"
```

### Start the local FastAPI Server
To start the server for local Vite dashboard integration (runs on port **8010**):
```bash
python -m uvicorn student_workspace_agent.server:app --host 127.0.0.1 --port 8010
```

### Deploy the Python Agent
The agent can be deployed as a container from the **`python/`** directory. The included [python/Dockerfile](../../python/Dockerfile) installs `student_workspace_agent/requirements.txt`, runs the FastAPI app with Uvicorn on `0.0.0.0`, and reads the hosting platform's `PORT` env var (default `8010` when no platform port is provided).

Recommended production target: **Railway**.

1. Create a Railway service from the GitHub repository.
2. Set the service **Root Directory** to `python/`.
3. Use `Dockerfile` as the Dockerfile path.
4. Configure `/health` as the health check path.
5. Add runtime variables on Railway:
   - `OPENROUTER_API_KEY`
   - `OPENROUTER_HTTP_REFERER=https://teamfair.company`
   - `OPENROUTER_X_TITLE=Teamfair`
   - `STUDENT_AGENT_CORS_ORIGINS=https://teamfair.company,https://www.teamfair.company,https://teamfair.vercel.app,http://localhost:8080,http://127.0.0.1:8080`
   - If the Railway public domain target port is manually set to `8010`, also add `PORT=8010`. Otherwise, leave `PORT` unset and let Railway inject/expose its own port.
6. After Railway creates the public HTTPS URL, add it to Vercel as `VITE_STUDENT_AGENT_URL=https://teamfair.up.railway.app` with no trailing slash, then redeploy the frontend.

The student agent sidebar sends the current Supabase access token as an `Authorization: Bearer ...` header when a session exists. The current Python server uses CORS and request validation but does not yet validate that token server-side.

### Windows Terminal Note
If Vietnamese character parsing displays incorrectly in your terminal console, ensure your active terminal shell's stdout encoding is configured to UTF-8.

