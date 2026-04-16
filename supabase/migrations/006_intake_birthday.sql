-- ─────────────────────────────────────────────────────────────────────────────
-- Frecka Fitness — Add birthday column to intakes
--
-- Replaces the legacy `age` text field with a proper `birthday date` column.
-- Age is now calculated in the UI via calcAge() so it stays current over time
-- and opens the door to birthday-month perks for clients down the road.
--
-- The `age` column is left in place (and its length constraint from 005 remains)
-- to preserve any rows submitted before this migration. It is no longer
-- written to by the intake form.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.intakes
  add column if not exists birthday date;
