
-- 1) Rotate all six portal auth passwords to random unknown values. The app
--    no longer authenticates portal users with passwords (it uses Admin-API
--    magic-link tokens), so nothing needs to know these values.
DO $$
DECLARE
  emails text[] := ARRAY[
    'admin@elga.local','store@elga.local','bakery@elga.local',
    'delivery@elga.local','branch1@elga.local','branch2@elga.local'
  ];
BEGIN
  UPDATE auth.users
     SET encrypted_password = crypt(encode(gen_random_bytes(32), 'hex'), gen_salt('bf')),
         updated_at = now()
   WHERE email = ANY(emails);
END $$;

-- 2) Reschedule the push-dispatch cron with the shared secret header.
DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'dispatch-web-push';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'dispatch-web-push',
  '* * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://project--zddnbrdnlhmlpzoqzwqb.lovable.app/api/public/hooks/dispatch-push',
    headers := '{"Content-Type":"application/json","x-dispatch-secret":"h2txp7nVrwodqzUlp2eyIcVcTd27tUhMZXolkGLkUHuSwLxpQ9Wg6XN_gWmK6nHy"}'::jsonb,
    body := '{}'::jsonb
  );
  $cron$
);
