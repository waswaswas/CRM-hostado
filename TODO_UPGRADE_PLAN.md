# To-Do Module Upgrade Plan

## A) Existing To-Do Module Boundaries

| Layer | Location | Notes |
|-------|----------|--------|
| **UI** | `app/todo/page.tsx` | Single client page: list picker, task list, task detail panel, CreateListDialog, ListSettingsDialog. Uses `useFeaturePermissions()` for `todo`, `getUserRole()` for owner/admin. |
| **Server/actions** | `app/actions/todo.ts` | All CRUD: getTodoLists, getTodoTasks, createTodoList, joinTodoListByCode, updateTodoList, deleteTodoList, createTodoTask, updateTodoTask, deleteTodoTask, createTodoSubtask, toggleTodoSubtask, createTodoComment, createTodoAttachment. No explicit list-member check; RLS enforces. |
| **DB** | Supabase: `todo_lists`, `todo_list_members`, `todo_tasks`, `todo_task_*`. RLS via `migration_todo_lists.sql` + `FIX_TODO_LISTS_RLS_RECURSION.sql` (helpers: get_todo_list_organization_id, get_todo_list_created_by, user_is_todo_list_member). |
| **Permissions** | Org-level: `organization_permissions.feature = 'todo'`; `hasFeaturePermission(orgId, 'todo')`. List-level: RLS (owner/admin see all org lists; others see only lists they’re in via `todo_list_members`). |
| **Invitation** | `join_todo_list_by_code(code)` RPC in Supabase; `joinTodoListByCode(code)` in actions. |

## B) App Patterns (Reuse)

| Concern | How it’s done |
|---------|----------------|
| **Notifications** | `notifications` table: `owner_id`, `type` ('email','reminder','tag_removed','other'), `title`, `message`, `related_id`, `related_type`, `metadata`, `organization_id`. `createNotification()` in `app/actions/notifications.ts`. |
| **Deep-links** | `components/notifications/notifications-list.tsx`: `getNotificationLink()` maps `related_type` + `related_id` to route (e.g. `email` → `/emails/:id`, `reminder` → `/dashboard`, `client` → `/clients/:id`). Add `todo_task` → `/todo?list=:listId` or similar. |
| **Background** | Cron routes under `app/api/cron/`: e.g. `check-overdue-reminders`, `check-tag-removals`. Use `CRON_SECRET` in Authorization header. No job queue; use same pattern for reminder delivery. |
| **Real-time** | None found; refresh after mutations via `revalidatePath('/todo')` and client refetch. |
| **File uploads** | Attachments: `todo_task_attachments` stores `file_url`; UI uses paste URL. Other features use `app/actions/storage.ts` + Supabase storage. |
| **Auditing** | `todo_task_activity` table (task_id, user_id, action, metadata, created_at). Not heavily used in current UI; can extend for time corrections. |

## C) Files to Touch (by phase)

- **Phase 1**: `supabase/` (new migration), `app/actions/todo.ts`, `app/todo/page.tsx`, `types/database.ts` (optional types).
- **Phase 2**: `app/actions/todo.ts` (member + assignee checks), RLS/migrations if needed, `app/todo/page.tsx` (assignee dropdown = list members).
- **Phase 3**: New migration `todo_task_reminders`, `app/actions/` (reminders + delivery), cron or client-side delivery, `app/todo/page.tsx` (Remind me UI), `components/notifications/` (link for `todo_task`).
- **Phase 4**: New migrations (time_entries, timer_sessions), `app/actions/todo.ts` (time APIs), `app/todo/page.tsx` (timer + manual + list + corrections).
- **Phase 5**: Optional real-time or refresh strategy; no new tables.

## D) DB Migrations to Add

| Phase | Migration | Content |
|-------|-----------|--------|
| 1 | `migration_todo_projects.sql` | `todo_projects` table; `todo_tasks.project_id` nullable FK. |
| 3 | `migration_todo_task_reminders.sql` | `todo_task_reminders` table. |
| 4 | `migration_todo_time_tracking.sql` | `todo_task_time_entries`, `todo_task_timer_sessions`. |

## E) Implementation Order

1. **Phase 1** – Projects + filtering (this document’s first implementation).
2. **Phase 2** – Permissions + assignment hardening (list-member checks, assignee ∈ list members).
3. **Phase 3** – Personal task reminders (table, delivery, UI, notification link).
4. **Phase 4** – Time tracking (timer, manual, corrections, activity).
5. **Phase 5** – Collab/real-time only if needed.

---

*Phase 1 implementation: see below (DB → server → UI).*
