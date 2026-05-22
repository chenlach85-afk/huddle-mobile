-- ============================================================
-- Huddle Pro — Supabase initial schema migration
-- Apply via: Supabase Dashboard > SQL Editor, or supabase db push
-- ============================================================

-- Enable pgcrypto for gen_random_uuid()
create extension if not exists pgcrypto;

-- ============================================================
-- TABLES
-- ============================================================

create table if not exists users (
  id             serial primary key,
  clerk_id       text not null unique,          -- stores Supabase auth.users.id (UUID)
  email          text not null,
  name           text not null,
  role           text not null default 'coach'  check (role in ('coach', 'player', 'admin')),
  language       text not null default 'en'     check (language in ('en', 'he', 'es')),
  notifications_enabled      boolean not null default true,
  email_notifications        boolean not null default true,
  push_notifications         boolean not null default false,
  calendar_reminder_minutes  text    not null default '30',
  account_status text not null default 'active' check (account_status in ('active', 'suspended', 'deleted')),
  deleted_at     timestamptz,
  deleted_by     integer,
  deletion_reason text,
  suspended_at   timestamptz,
  suspended_by   integer,
  suspension_reason text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists teams (
  id           serial primary key,
  name         text not null,
  sport        text not null,
  season       text,
  description  text,
  coach_name   text not null,
  avatar_color text not null default '#3b82f6',
  image_url    text,
  location     text,
  player_count integer not null default 0,
  join_code    text not null default gen_random_uuid()::text,
  created_by   integer references users(id) on delete set null,
  archived_at  timestamptz,
  archived_by  integer,
  archived_reason text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists players (
  id            serial primary key,
  team_id       integer not null references teams(id) on delete cascade,
  name          text not null,
  number        integer,
  position      text,
  email         text,
  phone         text,
  date_of_birth text,
  notes         text,
  status        text not null default 'active' check (status in ('active', 'inactive', 'injured')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists events (
  id                      serial primary key,
  team_id                 integer not null references teams(id) on delete cascade,
  title                   text not null,
  type                    text not null default 'training' check (type in ('training','league_game','friendly_game','tournament','celebration','meeting','other')),
  location                text,
  starts_at               timestamptz not null,
  ends_at                 timestamptz,
  notes                   text,
  opponent                text,
  is_home                 boolean,
  arrival_time            timestamptz,
  uniform_color           text,
  uniform_secondary_color text,
  uniform_notes           text,
  what_to_bring           text,
  home_score              integer,
  away_score              integer,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create table if not exists attendance (
  id         serial primary key,
  event_id   integer not null references events(id) on delete cascade,
  player_id  integer not null references players(id) on delete cascade,
  status     text not null default 'no_response' check (status in ('attending','not_attending','maybe','no_response')),
  notes      text,
  updated_at timestamptz not null default now(),
  unique (event_id, player_id)
);

create table if not exists tasks (
  id                    serial primary key,
  team_id               integer not null references teams(id) on delete cascade,
  title                 text not null,
  description           text,
  assigned_to_player_id integer references players(id) on delete set null,
  due_date              text,
  status                text not null default 'pending' check (status in ('pending','in_progress','done')),
  priority              text not null default 'medium'  check (priority in ('low','medium','high')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table if not exists messages (
  id              serial primary key,
  team_id         integer not null references teams(id) on delete cascade,
  sender_name     text not null,
  sender_role     text not null default 'coach' check (sender_role in ('coach','player','admin')),
  sender_user_id  integer references users(id) on delete set null,
  title           text,
  message_type    text default 'general' check (message_type in ('announcement','reminder','urgent','general')),
  target_audience text default 'all' check (target_audience in ('all','players_only','specific_players')),
  channels        jsonb default '{"in_app":true,"email":false,"whatsapp":false}'::jsonb,
  content         text not null,
  pinned          boolean not null default false,
  created_at      timestamptz not null default now()
);

create table if not exists notifications (
  id           serial primary key,
  user_id      integer not null references users(id) on delete cascade,
  type         text not null default 'general' check (type in ('task','event','message','general')),
  title        text not null,
  body         text not null,
  read         boolean not null default false,
  related_id   integer,
  related_type text,
  created_at   timestamptz not null default now()
);

create table if not exists admin_audit_log (
  id             serial primary key,
  admin_id       integer not null,
  action         text not null check (action in (
    'user_suspended','user_reactivated','user_soft_deleted','user_hard_deleted',
    'user_role_changed','user_edited','team_archived','team_transferred','team_deleted',
    'invitation_created','invitation_revoked','user_registered_via_invitation',
    'user_promoted_admin','user_demoted_admin'
  )),
  target_user_id integer,
  target_team_id integer,
  metadata       jsonb,
  created_at     timestamptz not null default now()
);

create table if not exists platform_invitations (
  id                  serial primary key,
  token               text not null unique,
  email               text not null,
  invited_role        text not null check (invited_role in ('coach','admin')),
  invited_by_user_id  integer not null,
  status              text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  notes               text,
  expires_at          timestamptz not null,
  accepted_at         timestamptz,
  accepted_by_user_id integer,
  email_sent_at       timestamptz,
  created_at          timestamptz not null default now()
);

create table if not exists team_invitations (
  id                  serial primary key,
  token               text not null unique,
  team_id             integer not null references teams(id) on delete cascade,
  invited_by_user_id  integer not null references users(id) on delete cascade,
  invite_type         text not null default 'email' check (invite_type in ('email','link')),
  invited_role        text not null default 'player' check (invited_role in ('player','coach','assistant')),
  email               text,
  phone               text,
  status              text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  expires_at          timestamptz not null,
  accepted_at         timestamptz,
  accepted_by_user_id integer,
  email_sent_at       timestamptz,
  email_send_count    integer not null default 0,
  created_at          timestamptz not null default now()
);

create table if not exists team_members (
  id                       serial primary key,
  team_id                  integer not null references teams(id) on delete cascade,
  user_id                  integer references users(id) on delete cascade,
  role                     text not null default 'player' check (role in ('coach','player','assistant')),
  placeholder_full_name    text,
  placeholder_email        text,
  placeholder_phone        text,
  invitation_id            integer references team_invitations(id) on delete set null,
  jersey_number            integer,
  position                 text,
  member_notes             text,
  status                   text default 'active' check (status in ('active','inactive','pending_invitation','invited','declined')),
  coach_title              text,
  can_manage_team_settings boolean default false,
  created_at               timestamptz not null default now()
);

-- Partial unique index: only one user_id entry per team (nulls allowed for placeholder rows)
create unique index if not exists team_members_team_user_unique
  on team_members (team_id, user_id)
  where user_id is not null;

create table if not exists files (
  id            serial primary key,
  uploader_id   integer references users(id) on delete set null,
  team_id       integer references teams(id) on delete cascade,
  filename      text not null,
  original_name text not null,
  mime_type     text not null,
  size          bigint not null,
  url           text not null,
  related_type  text,
  related_id    integer,
  created_at    timestamptz not null default now()
);

create table if not exists albums (
  id          serial primary key,
  team_id     integer not null references teams(id) on delete cascade,
  name        text not null,
  description text,
  cover_url   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists message_deliveries (
  id           serial primary key,
  message_id   integer not null references messages(id) on delete cascade,
  user_id      integer not null references users(id) on delete cascade,
  channel      text not null check (channel in ('in_app','email','whatsapp')),
  status       text default 'pending' check (status in ('pending','sent','read','failed')),
  sent_at      timestamptz,
  read_at      timestamptz,
  error_detail text,
  created_at   timestamptz not null default now()
);

create unique index if not exists message_deliveries_unique
  on message_deliveries (message_id, user_id, channel);

-- ============================================================
-- SUPABASE TRIGGER: auto-provision users row on auth signup
--
-- When a new Supabase Auth user is created (via sign-up,
-- OAuth, magic link, or invitation acceptance), this trigger
-- immediately inserts a corresponding row in the public.users
-- table using the auth user's UUID as clerk_id.
--
-- Role logic:
--   - If no rows exist in users yet → first user becomes admin
--   - Otherwise role defaults to 'coach' (must be invited)
--
-- If the row already exists (idempotent re-runs), the ON
-- CONFLICT clause is a no-op.
-- ============================================================

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role   text;
  v_name   text;
  v_email  text;
begin
  v_email := coalesce(new.email, '');
  v_name  := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(v_email, '@', 1),
    'Coach'
  );

  -- First-ever user on the platform becomes admin
  select case when count(*) = 0 then 'admin' else 'coach' end
  into   v_role
  from   public.users;

  insert into public.users (clerk_id, email, name, role)
  values (new.id::text, v_email, v_name, v_role)
  on conflict (clerk_id) do nothing;

  return new;
end;
$$;

-- Drop and recreate trigger so this file is idempotent
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

-- ============================================================
-- NOTE: To apply this migration:
--   1. Supabase Dashboard > SQL Editor > paste and run
--   2. Or: supabase db push  (if using Supabase CLI)
-- ============================================================
