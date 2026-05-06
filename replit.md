# Huddle Pro

A full-stack sports team management app for coaches, built with React+Vite and Express.

## Architecture

**Monorepo** (pnpm workspaces):
- `artifacts/teamhub` — React+Vite frontend (`@workspace/teamhub`), preview path `/`
- `artifacts/api-server` — Express API server (`@workspace/api-server`), preview path `/api`
- `lib/db` — Drizzle ORM + PostgreSQL schema (`@workspace/db`)
- `lib/api-spec` — OpenAPI spec + Orval codegen config (`@workspace/api-spec`)
- `lib/api-client-react` — Generated React Query hooks (`@workspace/api-client-react`)
- `lib/api-zod` — Generated Zod validation schemas (`@workspace/api-zod`)
- `lib/object-storage-web` — Object storage upload client lib (`@workspace/object-storage-web`)

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
- `teams` — id, name, sport, season, description, coach_name, avatar_color, image_url, location, player_count, join_code, created_by (FK→users), archived_at, archived_by, archived_reason, timestamps
- `players` — id, team_id (FK→teams), name, number, position, email, phone, date_of_birth, notes, status
- `events` — id, team_id (FK→teams), title, type (7-type enum: training/league_game/friendly_game/tournament/celebration/meeting/other), location, starts_at, ends_at, notes, timestamps
- `attendance` — id, event_id (FK→events), player_id (FK→players), status, notes, updated_at
- `tasks` — id, team_id (FK→teams), title, description, assigned_to_player_id, due_date, status, priority, timestamps
- `messages` — id, team_id (FK→teams), sender_name, sender_role, content, pinned, created_at
- `users` — id, clerk_id (unique), email, name, role, language, account_status (active/suspended/deleted), deleted_at, deleted_by, deletion_reason, suspended_at, suspended_by, suspension_reason, notifications prefs, timestamps
- `admin_audit_log` — id, admin_id, action, target_user_id, target_team_id, metadata (jsonb), created_at
- `platform_invitations` — id, token (UUID), email, invited_role, invited_by_user_id, status, notes, expires_at, accepted_at, email_sent_at, created_at
- `notifications` — id, user_id (FK→users), type, title, body, read, related_id, related_type, created_at
- `team_members` — id, team_id (FK→teams), user_id (FK→users), role (coach/player/assistant), created_at
- `files` — id, uploader_id, team_id, filename, original_name, mime_type, size, url, related_type, related_id, created_at
- `team_invitations` — id, token (UUID), team_id, invited_by_user_id, invite_type (email/link), email (nullable), phone (nullable), invited_role (default "player"), status, expires_at, accepted_at, email_sent_at, created_at

## API Routes

All under `/api/` base path. See `artifacts/api-server/src/routes/index.ts` for the full list. Key additions:

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/teams/:teamId/coaches | List coaching staff (team_members) |
| POST | /api/teams/:teamId/coaches/invite | Invite coach via team_invitations |
| PATCH | /api/teams/:teamId/coaches/:userId/role | Change coach role |
| DELETE | /api/teams/:teamId/coaches/:userId | Remove coach |
| POST | /api/teams/:teamId/transfer-ownership | Transfer team ownership |
| POST | /api/teams/:teamId/archive | Archive team |
| POST | /api/teams/:teamId/unarchive | Unarchive team |

## Frontend Pages

- `/` — Landing page (public); authenticated users redirect to `/dashboard`
- `/sign-in/*?` — Clerk sign-in (themed dark navy)
- `/sign-up/*?` — Clerk sign-up (themed dark navy)
- `/dashboard` — Scoreboard hero card + stats (auth required)
- `/teams` — Team list with create-team dialog (auth required)
- `/teams/:teamId` — Team detail with 7 tabs: Squad, Schedule, Tasks, Messages, Albums, Docs, **Management** (auth required)
- `/calendar` — Month grid + upcoming sidebar + day detail panel; type filter row (auth required)
- `/settings` — Profile, language, notification prefs, security (auth required)
- `/member/:joinCode` — Public read-only player view (no auth)
- `/invite/:token` — Invitation acceptance page with email/account mismatch guard
- `/admin/invitations` — Admin invitations management (auth + admin required)

## i18n

Language switcher in Settings: English, Hebrew (RTL), Spanish.
- Context: `artifacts/teamhub/src/lib/i18n.tsx` — `I18nProvider`, `useI18n()`, `Language` type
- Stored in `localStorage` and synced to the DB user record
- RTL support via `document.dir` and `flex-row-reverse` on layout
- Sections: nav, common, squads, teamDetail, teamInvite, events, tasks, messages, settings, files, **management**, **whatsapp**, admin, notifications, invite

## Notifications

In-app notification bell (top-right) polling every 30s. Notifications are now fired automatically on event/task/message creation.
- `createNotification()` helper in `artifacts/api-server/src/routes/notifications.ts`
- Triggered in: events POST, tasks POST, messages POST (notifies all team_members)

## Event Types (7)

`training` | `league_game` | `friendly_game` | `tournament` | `celebration` | `meeting` | `other`
- Card-grid picker in create/edit form; color + icon per type
- Calendar filter row persisted in localStorage
- Old `practice`→`training`, `game`→`league_game` migrated via SQL

## Team Management Tab

`artifacts/teamhub/src/pages/team-management.tsx` — tab within team-detail.
- Coaching staff list with role badges (Owner/Head Coach/Assistant)
- Invite coach via email or generate link
- Change coach role, remove coach (owner only)
- Transfer ownership, archive team, delete team with phrase confirmation (owner only)
- Join code display + copy

## Player Invite Revamp

`artifacts/teamhub/src/components/team/players-tab.tsx`
- Single `emailOrPhone` field + two action buttons (Send Email / Generate Link)
- Link result modal with WhatsApp / Copy Text / Email share options
- WhatsApp icon shown on player cards for players with a phone number
- `normalizePhone` + `getWhatsAppUrl` utilities in same file

## File Uploads

Base64 upload endpoint. `FileUploader` component in `artifacts/teamhub/src/components/file-uploader.tsx`.
- Max 10MB per file; supports images, videos, documents

## Design

Huddle aesthetic — dark navy stadium theme:
- `background: hsl(226, 40%, 7%)` — deep navy; `primary: hsl(22, 100%, 60%)` — ignition orange
- Font display: Bebas Neue + Oswald; body: Inter
- Tailwind v4 with `@tailwindcss/vite` plugin (`optimize: false` for Clerk compat)

## Key Config

- React override in `pnpm-workspace.yaml` forces single React 19.1.0 instance (needed for Clerk)
- Clerk layer declared in `index.css` before tailwindcss import
- `vite.config.ts` dedupe includes `@clerk/react`, `@clerk/shared`
- After OpenAPI spec changes, always run: `pnpm --filter @workspace/api-spec run codegen`

## Gotchas

- Event type enum lives in `lib/db/src/schema/events.ts` AND `lib/api-spec/openapi.yaml` — keep both in sync, then run codegen
- `team_invitations` now has `phone` and `invited_role` columns — schema push required after any schema change
- Albums route has pre-existing TS errors (string | string[] params) — unrelated to app features, doesn't affect runtime
