-- ─────────────────────────────────────────────────────────────────────────────
-- Frecka Fitness — Intake column length constraints
-- Prevents oversized payloads on all intakes text fields.
-- Limits are generous for real use but block multi-MB abuse.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.intakes
  add constraint intakes_first_name_len    check (char_length(first_name)      <= 100),
  add constraint intakes_last_name_len     check (char_length(last_name)       <= 100),
  add constraint intakes_email_len         check (char_length(email)           <= 254),
  add constraint intakes_phone_len         check (char_length(phone)           <= 30),
  add constraint intakes_location_len      check (char_length(location)        <= 200),
  add constraint intakes_primary_goal_len  check (char_length(primary_goal)    <= 200),
  add constraint intakes_goal_detail_len   check (char_length(goal_detail)     <= 2000),
  add constraint intakes_timeline_len      check (char_length(timeline)        <= 200),
  add constraint intakes_age_len           check (char_length(age)             <= 10),
  add constraint intakes_gender_len        check (char_length(gender)          <= 50),
  add constraint intakes_experience_len    check (char_length(experience)      <= 200),
  add constraint intakes_training_days_len check (char_length(training_days)   <= 50),
  add constraint intakes_session_len       check (char_length(session_length)  <= 50),
  add constraint intakes_environment_len   check (char_length(environment)     <= 200),
  add constraint intakes_curr_training_len check (char_length(current_training)<= 2000),
  add constraint intakes_sleep_len         check (char_length(sleep_quality)   <= 50),
  add constraint intakes_stress_len        check (char_length(stress_level)    <= 50),
  add constraint intakes_occupation_len    check (char_length(occupation)      <= 200),
  add constraint intakes_nutrition_len     check (char_length(nutrition)       <= 2000),
  add constraint intakes_injuries_len      check (char_length(injuries)        <= 2000),
  add constraint intakes_medical_len       check (char_length(medical_notes)   <= 2000),
  add constraint intakes_feedback_len      check (char_length(feedback_pref)   <= 200),
  add constraint intakes_referral_len      check (char_length(referral_source) <= 200),
  add constraint intakes_anything_len      check (char_length(anything_else)   <= 2000),
  add constraint intakes_coach_notes_len   check (char_length(coach_notes)     <= 5000);
