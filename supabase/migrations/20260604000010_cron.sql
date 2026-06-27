-- Schedules the poll-espn Edge Function via pg_cron + pg_net.
-- The shared secret is read from app_config at job runtime so it can be
-- rotated without touching this migration. The Edge Function must have the
-- same value set as POLL_ESPN_SECRET in Supabase Edge Function secrets.

SELECT cron.schedule(
  'poll-espn',
  '* * * * *',
  $$
    SELECT net.http_post(
      url                  := 'https://zzglgakvioesxkjhctsb.supabase.co/functions/v1/poll-espn',
      headers              := jsonb_build_object(
                                'x-shared-secret', (SELECT value FROM app_config WHERE key = 'poll_espn_secret'),
                                'content-type',    'application/json'
                              ),
      body                 := '{}'::jsonb,
      timeout_milliseconds := 10000
    );
  $$
);
