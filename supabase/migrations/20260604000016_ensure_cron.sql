-- ============================================================
-- Ensure the poll-espn cron job actually exists and runs
-- ============================================================
-- Earlier migrations referenced cron.schedule / net.http_post but never enabled
-- the underlying extensions, and the original schedule was only ever marked as
-- applied (not run) on this project. Enable the extensions and (re)schedule the
-- job idempotently so live data refreshes every minute on its own.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Drop any pre-existing job of this name so we never stack duplicates.
DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'poll-espn';
END $$;

SELECT cron.schedule(
  'poll-espn',
  '* * * * *',
  $cron$
    SELECT net.http_post(
      url                  := 'https://zzglgakvioesxkjhctsb.supabase.co/functions/v1/poll-espn',
      headers              := jsonb_build_object(
                                'x-shared-secret', (SELECT value FROM app_config WHERE key = 'poll_espn_secret'),
                                'content-type',    'application/json'
                              ),
      body                 := '{}'::jsonb,
      timeout_milliseconds := 10000
    );
  $cron$
);
