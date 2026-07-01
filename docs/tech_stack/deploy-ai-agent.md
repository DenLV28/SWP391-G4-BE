# deploy-ai-agent
date: 2026-06-03
status: repo-ready
files_changed:
  - python/Dockerfile (NEW)
  - python/.dockerignore (NEW)
  - python/student_workspace_agent/config.py
  - python/student_workspace_agent/server.py
  - src/components/feature-groups/StudentAgentSidebar.tsx
  - docs/guides/how_to_run.md
  - docs/guides/student_workspace_agent.md
  - docs/tech_stack/deploy-ai-agent.md (NEW)
env_vars_to_add:
  - OPENROUTER_API_KEY (Railway)
  - OPENROUTER_HTTP_REFERER=https://teamfair.company (Railway)
  - OPENROUTER_X_TITLE=Teamfair (Railway)
  - STUDENT_AGENT_CORS_ORIGINS=https://teamfair.company,https://www.teamfair.company,https://teamfair.vercel.app,http://localhost:8080,http://127.0.0.1:8080 (Railway)
  - PORT=8010 (Railway, only if the public domain target port is manually set to 8010)
  - VITE_STUDENT_AGENT_URL=https://teamfair.up.railway.app (Vercel)
blockers:
  - Live Railway service currently returns 502 "Application failed to respond" for /health and CORS preflight.
  - Docker daemon is installed locally but was not running, so the image could not be built locally in this session.
notes:
  - Railway is the selected first deployment target.
  - Docker startup reads PORT with a default of 8010 for local/container portability; do not mismatch Railway's domain target port and the runtime PORT variable.
  - Local Uvicorn startup from python/ responded with 200 {"status":"ok"} on /health.
  - The browser forwards the Supabase access token to the agent endpoint, but the Python server does not yet validate it.
