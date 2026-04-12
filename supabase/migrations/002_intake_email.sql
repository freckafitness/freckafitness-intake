-- ─────────────────────────────────────────────────────────────────────────────
-- Frecka Fitness — Intake Email Notification
-- Triggers an email to Ryan whenever a new intake is submitted.
-- Uses pg_net (built into Supabase) + Resend (free tier: 3,000 emails/month).
--
-- FROM address: intake@freckafitness.com (freckafitness.com verified in Resend)
-- ─────────────────────────────────────────────────────────────────────────────


-- Enable pg_net (makes HTTP calls from the database — built into Supabase free tier)
create extension if not exists pg_net schema extensions;


-- ── Email trigger function ────────────────────────────────────────────────────
-- The API key is embedded here. This function is security definer and never
-- exposed via the Supabase API — only reachable by the database trigger itself.

create or replace function public.notify_new_intake()
returns trigger
language plpgsql security definer
as $$
declare
  _subject text;
  _body    text;
  _api_key text := '[ROTATED]';
begin
  _subject := 'New Intake: ' || coalesce(NEW.first_name, '') || ' ' || coalesce(NEW.last_name, '') || ' — ' || coalesce(NEW.primary_goal, '(no goal)');

  _body := 'New client intake submitted.' || E'\n\n'
    || 'Name:       ' || coalesce(NEW.first_name, '') || ' ' || coalesce(NEW.last_name, '') || E'\n'
    || 'Email:      ' || coalesce(NEW.email, '') || E'\n'
    || 'Phone:      ' || coalesce(NEW.phone, '') || E'\n'
    || 'Location:   ' || coalesce(NEW.location, '') || E'\n\n'
    || 'Goal:       ' || coalesce(NEW.primary_goal, '') || E'\n'
    || 'Detail:     ' || coalesce(NEW.goal_detail, '') || E'\n'
    || 'Timeline:   ' || coalesce(NEW.timeline, '') || E'\n\n'
    || 'Sleep:      ' || coalesce(NEW.sleep_quality, '') || E'\n'
    || 'Stress:     ' || coalesce(NEW.stress_level, '') || E'\n'
    || 'Occupation: ' || coalesce(NEW.occupation, '') || E'\n'
    || 'Nutrition:  ' || coalesce(NEW.nutrition, '') || E'\n'
    || 'Injuries:   ' || coalesce(NEW.injuries, '') || E'\n'
    || 'Medical:    ' || coalesce(NEW.medical_notes, '') || E'\n\n'
    || 'Feedback:   ' || coalesce(NEW.feedback_pref, '') || E'\n'
    || 'Referral:   ' || coalesce(NEW.referral_source, '') || E'\n'
    || 'Notes:      ' || coalesce(NEW.anything_else, '');

  perform net.http_post(
    url     := 'https://api.resend.com/emails'::text,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || _api_key,
      'Content-Type',  'application/json'
    ),
    body    := jsonb_build_object(
      'from',    'intake@freckafitness.com',
      'to',      'freckafitness@gmail.com',
      'subject', _subject,
      'text',    _body
    )
  );

  return NEW;
end;
$$;


-- ── Attach trigger to intakes table ──────────────────────────────────────────

create trigger on_intake_insert
  after insert on public.intakes
  for each row execute function public.notify_new_intake();
