See [index.md](index.md) for the docs routing map.

## Entry points and routing
- [index.html](../../index.html) - root HTML, mounts `#root` and loads the main bundle.
- [src/main.tsx](../../src/main.tsx) - React root with `createRoot`.
- [src/App.tsx](../../src/App.tsx) - app providers + routing.

Provider nesting in [src/App.tsx](../../src/App.tsx) (outer to inner):
1. `QueryClientProvider`
2. `TooltipProvider`
3. `LanguageProvider`
4. `AuthProvider` ([src/context/AuthContext.tsx](../../src/context/AuthContext.tsx)) - Supabase session + `public.users` profile
5. `TeamProvider` - coordinates dashboard state and Supabase persistence
6. `BrowserRouter` + `Routes`

Routes defined in [src/App.tsx](../../src/App.tsx):
- `/` -> [src/pages/Landing.tsx](../../src/pages/Landing.tsx)
- `/login` -> [src/pages/Login.tsx](../../src/pages/Login.tsx) - Google OAuth, email sign-in / sign-up. Role and name onboarding are managed after login.
- `/dashboard-student` -> wrapped in [src/components/ProtectedRoute.tsx](../../src/components/ProtectedRoute.tsx) -> [src/pages/StudentDashboard.tsx](../../src/pages/StudentDashboard.tsx)
- `/dashboard-lecturer` -> `ProtectedRoute` -> [src/pages/LecturerDashboard.tsx](../../src/pages/LecturerDashboard.tsx)
- `*` -> [src/pages/NotFound.tsx](../../src/pages/NotFound.tsx)

**Protected dashboards:** When hitting dashboard routes, unauthenticated users are automatically redirected to `/login`. Since demo mode is completely disabled, valid auth credentials and environment variables are strictly required to access dashboards.

Utility:
- [src/pages/Index.tsx](../../src/pages/Index.tsx) - redirect helper (not mounted on the main route table above).
