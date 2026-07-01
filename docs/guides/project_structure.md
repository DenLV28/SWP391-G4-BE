# Project Structure (Teamfair)

See [index.md](index.md) for the docs routing map.

This document is a map of the codebase and the main files you will likely touch first.

## How to run (from package.json)
- `npm run dev` - start Vite dev server (port 8080)
- `npm run build` - production build
- `npm run build:dev` - development build mode
- `npm run preview` - preview production build
- `npm run lint` - ESLint
- `npm run test` - Vitest run once
- `npm run test:watch` - Vitest watch

For environment variables, Supabase migrations, and Google OAuth console values, see [how_to_run.md](how_to_run.md).

## Entry points and routing
- [index.html](../../index.html) - root HTML, mounts `#root` and loads the main bundle.
- [src/main.tsx](../../src/main.tsx) - React root with `createRoot`.
- [src/App.tsx](../../src/App.tsx) - app providers + routing.

Provider order and protected routes are documented in [entry_points_routing.md](entry_points_routing.md).

Routes (summary):
- `/` -> [src/pages/Landing.tsx](../../src/pages/Landing.tsx)
- `/start` -> [src/pages/RoleSelection.tsx](../../src/pages/RoleSelection.tsx)
- `/login` -> [src/pages/Login.tsx](../../src/pages/Login.tsx)
- `/dashboard-student` -> [src/components/ProtectedRoute.tsx](../../src/components/ProtectedRoute.tsx) -> [src/pages/StudentDashboard.tsx](../../src/pages/StudentDashboard.tsx)
- `/dashboard-lecturer` -> [src/components/ProtectedRoute.tsx](../../src/components/ProtectedRoute.tsx) -> [src/pages/LecturerDashboard.tsx](../../src/pages/LecturerDashboard.tsx)
- `*` -> [src/pages/NotFound.tsx](../../src/pages/NotFound.tsx)

## State, data, auth, and i18n
See [state_and_data.md](state_and_data.md) for `TeamContext`, `AuthContext`, Supabase client, and database RLS notes.

## Backend (Supabase)
- [supabase/migrations](../../supabase/migrations/) - Postgres schema, triggers on `auth.users`, RLS policies, RPC `set_signup_role`.
- [.env.example](../../.env.example) - `VITE_SUPABASE_*` and Google / Supabase URL configuration notes.

## Pages (top-level views)
- [src/pages/Landing.tsx](src/pages/Landing.tsx) - marketing/hero landing page with language switcher.
- [src/pages/RoleSelection.tsx](src/pages/RoleSelection.tsx) - select student vs lecturer.
- [src/pages/Login.tsx](src/pages/Login.tsx) - Google OAuth and email sign-in / sign-up (Supabase Auth), role-based redirect when authenticated.
- [src/pages/StudentDashboard.tsx](src/pages/StudentDashboard.tsx) - student workspace with tasks, calendar, evaluation, materials, badges, and activity log.
- [src/pages/LecturerDashboard.tsx](src/pages/LecturerDashboard.tsx) - lecturer workspace with group overview, reports, rubric, evaluations, exports, materials, and activity log.
- [src/pages/NotFound.tsx](src/pages/NotFound.tsx) - 404 view.

## Auth and session gating
- [src/context/AuthContext.tsx](src/context/AuthContext.tsx) - Supabase session and `public.users` profile row (`refreshProfile`, `signOut`).
- [src/lib/supabaseClient.ts](src/lib/supabaseClient.ts) - `createClient` and `isSupabaseConfigured`.
- [src/lib/dashboardPath.ts](src/lib/dashboardPath.ts) - maps `public.users.role` to student vs lecturer dashboard paths.
- [src/components/ProtectedRoute.tsx](src/components/ProtectedRoute.tsx) - wraps dashboards; enforces an authenticated Supabase session when Supabase is configured.

## Core layout and navigation
- [src/components/DashboardShell.tsx](src/components/DashboardShell.tsx) - shared layout with sidebar rail + header + content area.
- [src/components/DashboardSidebar.tsx](src/components/DashboardSidebar.tsx) - left nav, groups items into primary/secondary, handles mobile collapse.
- [src/components/DashboardHeader.tsx](src/components/DashboardHeader.tsx) - top bar, language switcher, exit action (signs out Supabase session when used from dashboards).
- [src/components/DashboardTabs.tsx](src/components/DashboardTabs.tsx) - tab switcher used for local section navigation.

## Student workspace feature map
Primary entry: [src/pages/StudentDashboard.tsx](src/pages/StudentDashboard.tsx)
- Task work and status flow
  - [src/components/KanbanBoard.tsx](src/components/KanbanBoard.tsx) - drag and drop Kanban, evidence uploads.
- Calendar and timeline
  - [src/components/ProjectCalendar.tsx](src/components/ProjectCalendar.tsx) - month/week views, event creation, task deadline sync.
- Contribution and fairness
  - [src/components/ContributionAnalytics.tsx](src/components/ContributionAnalytics.tsx) - charts, score card, warnings.
  - [src/components/StudentReportModal.tsx](src/components/StudentReportModal.tsx) - report a member to lecturer.
  - [src/components/feature-groups/AIChatWidget.tsx](src/components/feature-groups/AIChatWidget.tsx) - guided help and summaries.
- Materials
  - [src/components/MaterialsSection.tsx](src/components/MaterialsSection.tsx) - upload and list materials (student view).
- Verified badges
  - [src/components/feature-groups/VerifiedBadgesSection.tsx](src/components/feature-groups/VerifiedBadgesSection.tsx) - show awarded badges.

## Lecturer workspace feature map
Primary entry: [src/pages/LecturerDashboard.tsx](src/pages/LecturerDashboard.tsx)
- Group overview and analytics
  - [src/components/ContributionAnalytics.tsx](src/components/ContributionAnalytics.tsx)
- Reports and rubric
  - [src/components/LecturerReports.tsx](src/components/LecturerReports.tsx) - student reports and review actions.
  - [src/components/RubricManager.tsx](src/components/RubricManager.tsx) - rubric upload and grading UI.
- Lecturer student review and badges
  - [src/components/feature-groups/LecturerStudentEvaluationPanel.tsx](src/components/feature-groups/LecturerStudentEvaluationPanel.tsx)
- Export and materials
  - [src/components/ExportReport.tsx](src/components/ExportReport.tsx) - CSV/XLS export utility.
  - [src/components/MaterialsSection.tsx](src/components/MaterialsSection.tsx) - upload and delete materials (lecturer view).

## Shared feature components
- [src/components/LanguageSwitcherButton.tsx](src/components/LanguageSwitcherButton.tsx) - language toggle button used in header and pages.
- [src/components/NavLink.tsx](src/components/NavLink.tsx) - wrapper around `react-router-dom` `NavLink`.

## UI primitives (shadcn + Radix)
- [src/components/ui](src/components/ui) - shared UI primitives and wrappers. Examples include:
  - Buttons, inputs, dialogs, selects, toasts, tabs, sidebar, table, etc.
  - Most app UI is composed from these primitives.

## Styling and themes
- [src/index.css](src/index.css) - Tailwind layers, CSS variables, fonts, gradients, and utility classes.
- [tailwind.config.ts](tailwind.config.ts) - theme tokens and color system.
- [postcss.config.js](postcss.config.js) - Tailwind + autoprefixer.
- [src/App.css](src/App.css) - Vite starter styles (currently not imported by default).

## Tooling and configuration
- [package.json](package.json) - scripts and dependencies (includes `@supabase/supabase-js` for auth and API).
- [vite.config.ts](vite.config.ts) - Vite config, React SWC plugin, path alias `@` -> `src`, dev server port 8080.
- [eslint.config.js](eslint.config.js) - ESLint setup for TS/React.
- [tsconfig.json](tsconfig.json) - base TS config and path aliases.
- [tsconfig.app.json](tsconfig.app.json) - app TS config.
- [tsconfig.node.json](tsconfig.node.json) - Vite config TS settings.
- [vitest.config.ts](vitest.config.ts) - Vitest setup.
- [components.json](components.json) - shadcn UI configuration.

## Tests
- [src/test/example.test.ts](src/test/example.test.ts) - example test.
- [src/test/setup.ts](src/test/setup.ts) - test setup and `matchMedia` mock.

## Public assets
- [public/robots.txt](public/robots.txt) - crawler rules.

## Generated output
- `dist/` - build output (generated by Vite).
- `node_modules/` - dependencies.
