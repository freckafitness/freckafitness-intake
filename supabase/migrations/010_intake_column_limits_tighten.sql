-- ─────────────────────────────────────────────────────────────────────────────
-- Frecka Fitness — Tighten intake free-text column limits
-- 009 raised these to 5000 as an emergency unblock. Ryan wants a tighter,
-- intentional cap going forward: 500 chars general, 1000 for the two
-- injury/medical-history fields.
--
-- Added NOT VALID: several existing rows (including already-onboarded
-- clients, plus the client whose submission prompted 009) already exceed
-- these new limits. NOT VALID enforces the new cap on all future inserts
-- and updates without validating (or breaking) historical rows.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.intakes
  drop constraint intakes_goal_detail_len,
  drop constraint intakes_curr_training_len,
  drop constraint intakes_nutrition_len,
  drop constraint intakes_injuries_len,
  drop constraint intakes_medical_len,
  drop constraint intakes_anything_len,
  add constraint intakes_goal_detail_len   check (char_length(goal_detail)      <= 500)  not valid,
  add constraint intakes_curr_training_len check (char_length(current_training) <= 500)  not valid,
  add constraint intakes_nutrition_len     check (char_length(nutrition)        <= 500)  not valid,
  add constraint intakes_injuries_len      check (char_length(injuries)         <= 1000) not valid,
  add constraint intakes_medical_len       check (char_length(medical_notes)    <= 1000) not valid,
  add constraint intakes_anything_len      check (char_length(anything_else)    <= 500)  not valid;
