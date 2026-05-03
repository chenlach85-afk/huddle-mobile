# TeamHub

A full-stack sports team management app for coaches, built with React+Vite and Express.

## Architecture

**Monorepo** (pnpm workspaces):
- `artifacts/teamhub` — React+Vite frontend (`@workspace/teamhub`), preview path `/`
- `artifacts/api-server` — Express API server (`@workspace/api-server`), preview path `/api`
- `lib/db` — Drizzle ORM + PostgreSQL schema (`@workspace/db`)
- `lib/api-spec` — OpenAPI spec + Orval codegen config (`@workspace/api-spec`)
- `lib/api-client-react` — Generated React Query hooks (`@workspace/api-client-react`)
- `lib/api-zod` — Generated Zod validation schemas (`@workspace/api-zod`)

## Authentication

Clerk Auth (Replit-managed). Provisioned via `setupClerkWhitelabelAuth()`.
- Secrets: `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`
- Proxy middleware: `artifacts/api-server/src/middlewares/clerkProxyMiddleware.ts`
- Auth routes: `POST /api/auth/sync`, `GET /api/auth/me`, `PATCH /api/auth/me`
- `requireAuth` middleware: `artifacts/api-server/src/middlewares/requireAuth.ts`
- User sync on sign-in: `UserSync` component automatically creates the DB user record

## Database

PostgreSQL via `DATABASE_URL` env var. Schema push: `pnpm --filter @workspace/db run push`

Tables:
- `teams` — id, name, sport, season, description, coach_name, avatar_color, image_url, location, player_count, join_code, timestamps
- `players` — id, team_id (FK→teams), name, number, position, email, phone, date_of_birth, notes, status
- `events` — id, team_id (FK→teams), title, type, location, starts_at, ends_at, notes, timestamps
- `attendance` — id, event_id (FK→events), player_id (FK→players), status, notes, updated_at
- `tasks` — id, team_id (FK→teams), title, description, assigned_to_player_id, due_date, status, priority, timestamps
- `messages` — id, team_id (FK→teams), sender_name, sender_role, content, pinned, created_at
- `users` — id, clerk_id (unique), email, name, role, language, notifications_enabled, email_notifications, push_notifications, calendar_reminder_minutes, timestamps
- `notifications` — id, user_id (FK→users), type, title, body, read, related_id, related_type, created_at
- `team_members` — id, team_id (FK→teams), user_id (FK→users), role, created_at
- `files` — id, uploader_id, team_id, filename, original_name, mime_type, size, url, related_type, related_id, created_at

## API Routes

All under `/api/` base path:

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/healthz | Health check |
| POST | /api/auth/sync | Create/get user record after Clerk sign-in |
| GET | /api/auth/me | Get current user settings |
| PATCH | /api/auth/me | Update user settings (language, notifications, etc.) |
| GET | /api/notifications | List user notifications (auth required) |
| PATCH | /api/notifications/:id/read | Mark notification read |
| PATCH | /api/notifications/read-all | Mark all notifications read |
| POST | /api/files/upload | Upload file as base64 (auth required) |
| GET | /api/files | List files by team/related |
| GET | /api/dashboard/summary | Aggregate stats |
| GET | /api/teams/:teamId/activity | Recent activity feed |
| GET/POST | /api/teams | List / create teams |
| GET/PATCH/DELETE | /api/teams/:teamId | Team CRUD |
| GET/POST | /api/teams/:teamId/players | List / add players |
| GET/PATCH/DELETE | /api/players/:playerId | Player CRUD |
| GET/POST | /api/teams/:teamId/events | List / create events |
| GET/PATCH/DELETE | /api/events/:eventId | Event CRUD |
| GET/POST | /api/events/:eventId/attendance | List / upsert attendance |
| GET/POST | /api/teams/:teamId/tasks | List / create tasks |
| PATCH/DELETE | /api/tasks/:taskId | Task CRUD |
| GET/POST | /api/teams/:teamId/messages | List / post messages |
| DELETE | /api/messages/:messageId | Delete message |
| GET | /api/member/:joinCode | Public member view |
| GET | /api/calendar | Calendar events with team info |

## Frontend Pages

- `/` — Landing page (public) with sign-in/sign-up CTAs; authenticated users redirect to `/dashboard`
- `/sign-in/*?` — Clerk sign-in (themed dark navy)
- `/sign-up/*?` — Clerk sign-up (themed dark navy)
- `/dashboard` — Scoreboard hero card + stats (auth required)
- `/teams` — Team list with create-team dialog (auth required)
- `/teams/:teamId` — Team detail with tabs: Roster, Schedule, Tasks, Messages (auth required)
- `/calendar` — Month grid + upcoming sidebar + day detail panel (auth required)
- `/settings` — Profile, language switcher, notification prefs, security/change password (auth required)
- `/member/:joinCode` — Public read-only player view (no auth)

## i18n

Language switcher in Settings: English, Hebrew (RTL), Spanish.
- Context: `artifacts/teamhub/src/lib/i18n.tsx` — `I18nProvider`, `useI18n()`, `Language` type
- Stored in `localStorage` and synced to the DB user record
- RTL support via `document.dir` and `flex-row-reverse` on layout

## Notifications

In-app notification bell (top-right) polling every 30s.
- `useNotifications()`, `useMarkNotificationRead()`, `useMarkAllRead()` hooks
- `createNotification()` helper in `artifacts/api-server/src/routes/notifications.ts`
- Types: task, event, message, general

## File Uploads

Base64 upload endpoint. Client-side `FileUploader` component in `artifacts/teamhub/src/components/file-uploader.tsx`.
- Max 10MB per file
- Supports images, videos, documents

## Design

Huddle aesthetic — dark navy stadium theme:
- `background: hsl(226, 40%, 7%)` — deep navy
- `primary: hsl(22, 100%, 60%)` — ignition orange
- Font display: Bebas Neue + Oswald; body: Inter
- CSS utilities: `.font-display`, `.jersey-tile`, `.hero-card`, `.stat-value`, `.stat-label`, `.section-label`
- Per-team color theming via `avatarColor`
- Tailwind v4 with `@tailwindcss/vite` plugin (`optimize: false` for Clerk compat)

## Key Config

- React override in `pnpm-workspace.yaml` forces single React 19.1.0 instance (needed for Clerk)
- Clerk layer declared in `index.css` before tailwindcss import
- `vite.config.ts` dedupe includes `@clerk/react`, `@clerk/shared`
