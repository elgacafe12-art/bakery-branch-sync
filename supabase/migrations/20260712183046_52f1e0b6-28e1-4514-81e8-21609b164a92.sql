
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Clean up any prior schedules with the same name
DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('dispatch-web-push','emit-reminders');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'dispatch-web-push',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--zddnbrdnlhmlpzoqzwqb.lovable.app/api/public/hooks/dispatch-push',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkZG5icmRubGhtbHB6b3F6d3FiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NjU1MzgsImV4cCI6MjA5OTQ0MTUzOH0.YsWO2F0Avfyk01rnCsTlOWzuiGDBC0O4ORSl6QSEBeo"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'emit-reminders',
  '*/15 * * * *',
  $$ SELECT public.emit_reminders(); $$
);
