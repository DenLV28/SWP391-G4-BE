# docs/tech_stack — AI Task Completion Logs

Convention for post-task logging. After completing a tech stack improvement task, create `<task-name>.md` here.

## Format

```markdown
# <task-name>
date: YYYY-MM-DD
status: complete|partial|blocked
files_changed:
  - path/to/file1
  - path/to/file2
env_vars_added:
  - VAR_NAME (where: vercel|railway|github|.env)
migrations_added:
  - supabase/migrations/<timestamp>_<name>.sql
blockers: none|<description>
notes: <1-2 sentence summary of what was done>
```

## Rules

- One file per task, named to match the `.agents/skills/<task>/` folder
- Optimized for AI reading — minimal prose, structured data only
- Include exact file paths, env var names, migration filenames
- Status `partial` must list what remains under `blockers`
