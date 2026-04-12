-- ─────────────────────────────────────────────────────────────────────────────
-- Frecka Fitness — Intake Email: move API key to Supabase Vault
-- Replaces the hardcoded Resend key in notify_new_intake() with a Vault lookup.
-- The secret must exist in Vault under the name 'resend_api_key'.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.notify_new_intake()
returns trigger
language plpgsql security definer
as $$
declare
  _subject text;
  _body    text;
  _api_key text;
begin
  -- Load API key from Vault — never hardcoded in source
  select decrypted_secret
    into _api_key
    from vault.decrypted_secrets
   where name = 'resend_api_key'
   limit 1;

  if _api_key is null then
    raise exception 'notify_new_intake: resend_api_key not found in Vault';
  end if;

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
