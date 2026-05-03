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

## Database

PostgreSQL via `DATABASE_URL` env var. Tables:
- `teams` — id, name, sport, season, description, coach_name, avatar_color, player_count, timestamps
- `players` — id, team_id (FK→teams), name, number, position, email, phone, date_of_birth, notes, status (active|inactive|injured), timestamps
- `events` — id, team_id (FK→teams), title, type (practice|game|meeting|other), location, starts_at, ends_at, notes, timestamps
- `attendance` — id, event_id (FK→events), player_id (FK→players), status (attending|not_attending|maybe|no_response), notes, updated_at
- `tasks` — id, team_id (FK→teams), title, description, assigned_to_player_id (FK→players), due_date, status (pending|in_progress|done), priority (low|medium|high), timestamps
- `messages` — id, team_id (FK→teams), sender_name, sender_role (coach|player|admin), content, pinned, created_at

Schema push: `pnpm --filter @workspace/db run push`

## API Routes

All under `/api/` base path:

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/healthz | Health check |
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

## Frontend Pages

- `/` — Dashboard: stat cards (teams/players/events/tasks), team breakdown, quick actions
- `/teams` — Team list with create-team dialog (color picker, sport selector)
- `/teams/:teamId` — Team detail with 4 tabs:
  - **Roster** — player cards with status (active/inactive/injured), add/edit/delete
  - **Schedule** — event cards by date, click to expand attendance tracking panel, add/edit/delete
  - **Tasks** — filterable by status, click status icon to cycle pending→in_progress→done, add/edit/delete
  - **Messages** — message feed with pinned support, composer with sender name/role

## Codegen

After modifying `lib/api-spec/src/openapi.yaml`:
```
pnpm --filter @workspace/api-spec run codegen
```
Then manually overwrite `lib/api-zod/src/index.ts` to only contain:
```ts
export * from "./generated/api";
```

## Design

- Font: Outfit (Google Fonts)
- Primary color: orange (`--primary: 25 95% 53%`)
- Background: near-white (`--background: 0 0% 98%`)
- Sidebar: white card, 60px wide on desktop
- All interactive elements have `data-testid` attributes

## Billing

Stripe integration was explicitly deferred by the user. Not implemented.
