-- ─────────────────────────────────────────────────────────────────────────────
-- Frecka Fitness — Database Schema
-- Run this in the Supabase SQL editor (once, in order).
-- Schema locked 2026-04-11. Append-only — new columns go at the END of each table.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── Tables ────────────────────────────────────────────────────────────────────

create table public.clients (
  id                 uuid        primary key default gen_random_uuid(),
  created_at         timestamptz not null    default now(),
  auth_user_id       uuid        references auth.users(id),
  first_name         text        not null,
  last_name          text        not null,
  email              text        not null unique,
  phone              text,
  stripe_customer_id text,
  status             text        not null default 'active' check (status in ('active', 'inactive')),
  invited_at         timestamptz
);

create table public.intakes (
  id               uuid        primary key default gen_random_uuid(),
  created_at       timestamptz not null    default now(),
  client_id        uuid        references public.clients(id),   -- null until linked after sale
  first_name       text,
  last_name        text,
  email            text,
  phone            text,
  location         text,
  primary_goal     text,
  goal_detail      text,
  timeline         text,
  -- fitness background (collected by form but previously untracked in Google Sheets)
  age              text,
  gender           text,
  experience       text,
  training_days    text,
  session_length   text,
  environment      text,
  current_training text,
  -- lifestyle
  sleep_quality    text,
  stress_level     text,
  occupation       text,
  nutrition        text,
  injuries         text,
  medical_notes    text,
  feedback_pref    text,
  referral_source  text,
  anything_else    text,
  coach_notes      text        -- Ryan adds during/after consult
);

create table public.checkins (
  id                              uuid        primary key default gen_random_uuid(),
  created_at                      timestamptz not null    default now(),
  client_id                       uuid        not null references public.clients(id),
  week_ending                     date,
  missed_sessions                 int,
  best_lift                       text,
  progress_trend                  text,
  program_feedback                text,
  soreness                        int,        -- 1–5
  soreness_notes                  text,
  nutrition_adherence             int,        -- 1–5
  nutrition_notes                 text,
  for_ryan                        text,       -- client's private note to coach
  week_rating                     int,        -- 1–5
  coach_notes                     text,       -- visible to client
  coach_notes_updated_at          timestamptz,
  coach_private_notes             text,       -- coach only, never shown to client
  coach_private_notes_updated_at  timestamptz
);

-- Ties each auth user to their role and (for clients) their clients row
create table public.user_roles (
  user_id   uuid  primary key references auth.users(id) on delete cascade,
  role      text  not null    check (role in ('coach', 'client')),
  client_id uuid  references public.clients(id)  -- null for coach
);


-- ── Row Level Security ────────────────────────────────────────────────────────

alter table public.clients    enable row level security;
alter table public.intakes    enable row level security;
alter table public.checkins   enable row level security;
alter table public.user_roles enable row level security;


-- ── Helper functions ──────────────────────────────────────────────────────────

-- Returns the current user's role ('coach' | 'client'), or null if unauthenticated
create or replace function public.my_role()
returns text
language sql security definer stable
as $$
  select role from public.user_roles where user_id = auth.uid()
$$;

-- Returns the current user's client_id (null for coach / unauthenticated)
create or replace function public.my_client_id()
returns uuid
language sql security definer stable
as $$
  select client_id from public.user_roles where user_id = auth.uid()
$$;


-- ── Policies: intakes ─────────────────────────────────────────────────────────

-- Public intake form can insert without any auth
create policy "anon insert intakes"
  on public.intakes for insert
  to anon
  with check (true);

-- Coach reads and writes everything
create policy "coach all intakes"
  on public.intakes for all
  to authenticated
  using     (my_role() = 'coach')
  with check(my_role() = 'coach');


-- ── Policies: clients ─────────────────────────────────────────────────────────

-- Coach reads and writes every client record
create policy "coach all clients"
  on public.clients for all
  to authenticated
  using     (my_role() = 'coach')
  with check(my_role() = 'coach');

-- Each client can read their own row
create policy "client read own"
  on public.clients for select
  to authenticated
  using (auth_user_id = auth.uid());


-- ── Policies: checkins ────────────────────────────────────────────────────────

-- Coach reads and writes every check-in
create policy "coach all checkins"
  on public.checkins for all
  to authenticated
  using     (my_role() = 'coach')
  with check(my_role() = 'coach');

-- Clients insert their own check-ins
create policy "client insert checkins"
  on public.checkins for insert
  to authenticated
  with check(client_id = my_client_id());

-- Clients read their own check-ins
create policy "client read checkins"
  on public.checkins for select
  to authenticated
  using(client_id = my_client_id());


-- ── Policies: user_roles ──────────────────────────────────────────────────────

-- Users can read their own role (needed for client-side role checks)
create policy "user read own role"
  on public.user_roles for select
  to authenticated
  using(user_id = auth.uid());
