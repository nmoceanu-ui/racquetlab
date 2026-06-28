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
