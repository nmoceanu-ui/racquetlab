-- Run this once in your Supabase project's SQL Editor
-- (Dashboard → SQL Editor → New query → paste this → Run)

create table if not exists saved_builds (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  spec jsonb not null,
  created_at timestamptz default now()
);

-- Speeds up the lookup-by-code that happens every time someone opens a
-- shared link (?b=abc123).
create index if not exists saved_builds_code_idx on saved_builds (code);

-- Row Level Security: builds contain no personal data (just racquet
-- spec values), so this app intentionally allows anyone to insert a new
-- build and read any build by its code — that's the whole point of a
-- shareable link. It does NOT allow listing all builds, updating, or
-- deleting, which keeps this safe to run with the public/anon key from
-- the browser.
alter table saved_builds enable row level security;

create policy "Anyone can save a build"
  on saved_builds for insert
  with check (true);

create policy "Anyone can read a build by code"
  on saved_builds for select
  using (true);

-- No update or delete policy is created, so those operations are
-- blocked by default even with the public key — builds are immutable
-- once saved, which is the right behavior for a shareable link.


-- ─────────────────────────────────────────────────────────────────────────
-- player_state: cross-device sync for the Basin (player profile + check-ins)
-- ─────────────────────────────────────────────────────────────────────────
-- One row per signed-in user. `profile` mirrors the on-device player profile
-- and `checkins` mirrors the session feel-history log. Unlike saved_builds,
-- this IS personal, so RLS is scoped to the row owner (auth.uid()).
create table if not exists player_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  profile jsonb not null default '{}'::jsonb,
  checkins jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table player_state enable row level security;

-- A user can only ever see and write their own row. auth.uid() is the signed-in
-- user's id, so every policy pins user_id to it — no cross-user access.
create policy "own player_state select"
  on player_state for select
  using (auth.uid() = user_id);

create policy "own player_state insert"
  on player_state for insert
  with check (auth.uid() = user_id);

create policy "own player_state update"
  on player_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
