-- ─────────────────────────────────────────────────────────────────────────────
-- Frecka Fitness — Raise intake free-text column limits
-- A client's detailed injuries answer (>2000 chars) silently failed the
-- intakes_injuries_len CHECK constraint, blocking form submission with a
-- generic error. Raising all six free-text fields from 2000 -> 5000 chars
-- (matching coach_notes) gives real detailed answers enough room.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.intakes
  drop constraint intakes_goal_detail_len,
  drop constraint intakes_curr_training_len,
  drop constraint intakes_nutrition_len,
  drop constraint intakes_injuries_len,
  drop constraint intakes_medical_len,
  drop constraint intakes_anything_len,
  add constraint intakes_goal_detail_len   check (char_length(goal_detail)      <= 5000),
  add constraint intakes_curr_training_len check (char_length(current_training) <= 5000),
  add constraint intakes_nutrition_len     check (char_length(nutrition)        <= 5000),
  add constraint intakes_injuries_len      check (char_length(injuries)         <= 5000),
  add constraint intakes_medical_len       check (char_length(medical_notes)    <= 5000),
  add constraint intakes_anything_len      check (char_length(anything_else)    <= 5000);
