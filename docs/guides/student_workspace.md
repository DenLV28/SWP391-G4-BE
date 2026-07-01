See [index.md](index.md) for the docs routing map.

## Student workspace feature map

Primary entry: [src/layouts/StudentLayout.tsx](../../src/layouts/StudentLayout.tsx) wrapping all student routes (behind [ProtectedRoute](../../src/components/ProtectedRoute.tsx); see [state_and_data.md](state_and_data.md)). Student pages now render within this layout.

- Task work and status flow
  - [src/components/KanbanBoard.tsx](src/components/KanbanBoard.tsx) - drag and drop Kanban, evidence uploads.
  - **Dynamic Identity & Role Mapping**: The dashboard dynamically maps the student's name and role based on their active session. `currentUserName` is bound to the logged-in profile's `full_name`. The active student's role (`Leader` vs `Member`) is fetched directly from their row in the `group_members` table in Supabase, and the student's name is dynamically displayed in the sidebar's top-left corner subtitle.
  - **Leader Workspace Settings & Danger Zone**: Student Leaders have access to a dedicated collapsible "Danger Zone" section in their [Workspace Settings](src/components/SettingsModal.tsx). The Danger Zone features two key controls:
    - **Share my Project**: A placeholder action (currently inactive) designed to handle future public project mapping and guest collaborations.
    - **Delete my Project**: A destructive control that prompts the leader to type the exact name of their project as verification. Once confirmed, it triggers cascade deletion in Supabase (deleting the group and cascading through tasks, calendar events, logs, materials, chat messages, etc.) and performs a redirect back to `/` to refresh the user session.
  - **Task Creation Alerts**: When creating a new task, the student can check a "Notify team members" box. If selected, it triggers a real-time notification (via `sendNotification` from `NotificationContext`) to all other group peers.
- Calendar and timeline
  - [src/components/ProjectCalendar.tsx](src/components/ProjectCalendar.tsx) - month/week views, event creation, task deadline sync.
  - **Calendar Persistence**: Calendar events created by students (such as Meetings or Milestones) are persisted in real-time to the `public.calendar_events` database table in Supabase. These manual events merge seamlessly on the calendar view with automatically-generated task deadline events derived from the group's tasks. Access and mutation rights are secured via PostgreSQL Row-Level Security (RLS) policies.
- Contribution and fairness
  - [src/components/ContributionAnalytics.tsx](src/components/ContributionAnalytics.tsx) - charts, score card, warnings.
  - [src/components/StudentReportModal.tsx](src/components/StudentReportModal.tsx) - report a member to lecturer.
    - **Lecturer Alerts**: Submitting a peer review report automatically triggers an alert to the `"lecturer"` inbox, ensuring immediate visibility into peer conflicts.
  - [src/components/feature-groups/StudentAgentSidebar.tsx](src/components/feature-groups/StudentAgentSidebar.tsx) - AI assistant sidebar (OpenRouter agent server); triggered from the dashboard header Sparkles/AI button (global, visible on all tabs). Chat history persists via Supabase `chat_messages` table (scoped per group). After agent calls, a diff panel shows added/removed/modified tasks with Apply/Discard buttons. An auto-apply toggle (localStorage `agentAutoApply`) skips the panel. While the agent works, the touched section (KanbanBoard or ProjectCalendar) is locked via a `locked` prop with an overlay badge. See [student_workspace_agent.md](student_workspace_agent.md) and [state_and_data.md](state_and_data.md).
- Materials
  - [src/components/MaterialsSection.tsx](src/components/MaterialsSection.tsx) - upload and list materials (student view).
    - **Upload Alerts**: Provides a "Notify team members" checkbox during uploads. If selected, it alerts all other team peers via mail notification about the new document.
- Verified badges
  - [src/components/feature-groups/VerifiedBadgesSection.tsx](src/components/feature-groups/VerifiedBadgesSection.tsx) - show awarded badges.
