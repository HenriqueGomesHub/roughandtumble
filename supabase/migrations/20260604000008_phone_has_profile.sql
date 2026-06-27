-- Anon-callable check used by the onboarding modal to decide
-- whether to show "Welcome Back" or the name field (sign-up).
-- Returns true only if a profile with a non-empty display_name
-- exists for the given E.164 phone — does not expose any PII.
CREATE OR REPLACE FUNCTION phone_has_profile(p_phone text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE phone        = p_phone
      AND display_name <> ''
  );
$$;

GRANT EXECUTE ON FUNCTION phone_has_profile TO anon, authenticated;
