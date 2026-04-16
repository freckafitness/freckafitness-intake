-- ─────────────────────────────────────────────────────────────────────────────
-- Frecka Fitness — Update intake email notification
--
-- Extends notify_new_intake() to include all fields added since migration 003:
-- birthday, gender, experience, training_days, session_length, environment.
-- Age is calculated from birthday so it's always current in the email.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.notify_new_intake()
returns trigger
language plpgsql security definer
as $$
declare
  _subject  text;
  _body     text;
  _api_key  text;
  _age      text;
  _birthday text;
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

  -- Format birthday and calculate age
  if NEW.birthday is not null then
    _birthday := to_char(NEW.birthday, 'Month DD, YYYY');
    _age      := extract(year from age(NEW.birthday))::text;
  else
    _birthday := '';
    _age      := '';
  end if;

  _subject := 'New Intake: ' || coalesce(NEW.first_name, '') || ' ' || coalesce(NEW.last_name, '') || ' — ' || coalesce(NEW.primary_goal, '(no goal)');

  _body :=
      'New client intake submitted.' || E'\n\n'
   || '── Contact ──────────────────────────────' || E'\n'
   || 'Name:        ' || coalesce(NEW.first_name, '') || ' ' || coalesce(NEW.last_name, '') || E'\n'
   || 'Email:       ' || coalesce(NEW.email, '') || E'\n'
   || 'Phone:       ' || coalesce(NEW.phone, '') || E'\n'
   || 'Location:    ' || coalesce(NEW.location, '') || E'\n\n'
   || '── Goals ────────────────────────────────' || E'\n'
   || 'Goal:        ' || coalesce(NEW.primary_goal, '') || E'\n'
   || 'Detail:      ' || coalesce(NEW.goal_detail, '') || E'\n'
   || 'Timeline:    ' || coalesce(NEW.timeline, '') || E'\n\n'
   || '── Training ─────────────────────────────' || E'\n'
   || 'Experience:  ' || coalesce(NEW.experience, '') || E'\n'
   || 'Days/week:   ' || coalesce(NEW.training_days, '') || E'\n'
   || 'Session:     ' || coalesce(NEW.session_length, '') || E'\n'
   || 'Environment: ' || coalesce(NEW.environment, '') || E'\n'
   || 'Current:     ' || coalesce(NEW.current_training, '') || E'\n\n'
   || '── Lifestyle ────────────────────────────' || E'\n'
   || 'Birthday:    ' || _birthday || (case when _age <> '' then ' (' || _age || ')' else '' end) || E'\n'
   || 'Gender:      ' || coalesce(NEW.gender, '') || E'\n'
   || 'Occupation:  ' || coalesce(NEW.occupation, '') || E'\n'
   || 'Sleep:       ' || coalesce(NEW.sleep_quality, '') || E'\n'
   || 'Stress:      ' || coalesce(NEW.stress_level, '') || E'\n'
   || 'Nutrition:   ' || coalesce(NEW.nutrition, '') || E'\n'
   || 'Injuries:    ' || coalesce(NEW.injuries, '') || E'\n'
   || 'Medical:     ' || coalesce(NEW.medical_notes, '') || E'\n\n'
   || '── Other ────────────────────────────────' || E'\n'
   || 'Feedback:    ' || coalesce(NEW.feedback_pref, '') || E'\n'
   || 'Referral:    ' || coalesce(NEW.referral_source, '') || E'\n'
   || 'Notes:       ' || coalesce(NEW.anything_else, '');

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
