See [index.md](index.md) for the docs routing map.

## Core layout and navigation
- [src/components/DashboardShell.tsx](src/components/DashboardShell.tsx) - shared layout with sidebar rail + header + content area.
- [src/layouts/StudentLayout.tsx](src/layouts/StudentLayout.tsx) - centralized routing layout for student and leader roles, handling the `DashboardShell`, sidebar configuration, and role-based access checks.
- [src/components/DashboardSidebar.tsx](src/components/DashboardSidebar.tsx) - left nav, groups items into primary/secondary, handles mobile collapse.
- [src/components/DashboardHeader.tsx](src/components/DashboardHeader.tsx) - top bar, language switcher, exit (Supabase `signOut`). Layout order: `[leftSlot] [Logo] [rightSlot] [MailIcon] [LanguageSwitcher] [Exit]`. The student dashboard passes an AI (Sparkles) button via `rightSlot` to globally trigger the agent sidebar. It also mounts the `NotificationMailIcon` to show unread notifications in a Popover container.
- [src/components/NotificationMailIcon.tsx](src/components/NotificationMailIcon.tsx) - animated Mail/MailOpen icon displaying a pulsing red badge when unread notifications are present, wrapping a scrollable, click-to-read Popover notification list.
- [src/components/DashboardTabs.tsx](src/components/DashboardTabs.tsx) - tab switcher used for local section navigation.