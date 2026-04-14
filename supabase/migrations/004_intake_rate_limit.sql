-- ─────────────────────────────────────────────────────────────────────────────
-- Frecka Fitness — Intake rate limiting
-- Fires BEFORE INSERT on public.intakes regardless of how the row arrives
-- (form, direct REST call, or any future path).
--
-- Limits:
--   Per-email  : 3 inserts per 24 hours
--   Global     : 25 inserts per hour
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.check_intake_rate_limit()
returns trigger
language plpgsql security definer
as $$
declare
  _email_count  int;
  _global_count int;
begin
  -- Per-email: prevent the same address from spamming (max 3 per 24 h)
  if NEW.email is not null and NEW.email <> '' then
    select count(*)
      into _email_count
      from public.intakes
     where lower(email) = lower(NEW.email)
       and created_at > now() - interval '24 hours';

    if _email_count >= 3 then
      raise exception 'rate_limit_exceeded'
        using hint = 'Too many submissions from this email address. Please wait 24 hours or contact ryan@freckafitness.com directly.';
    end if;
  end if;

  -- Global: cap total intake volume (max 25 per hour)
  select count(*)
    into _global_count
    from public.intakes
   where created_at > now() - interval '1 hour';

  if _global_count >= 25 then
    raise exception 'rate_limit_exceeded'
      using hint = 'Intake form is temporarily unavailable. Please contact ryan@freckafitness.com directly.';
  end if;

  return NEW;
end;
$$;


create trigger intake_rate_limit
  before insert on public.intakes
  for each row execute function public.check_intake_rate_limit();
