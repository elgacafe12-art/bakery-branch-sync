-- Rotate PUSH_DISPATCH_SECRET into Vault (no literal value in this file)
DO $$
DECLARE
  new_secret text := encode(gen_random_bytes(48), 'base64');
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM vault.secrets WHERE name = 'push_dispatch_secret';
  IF v_id IS NULL THEN
    PERFORM vault.create_secret(new_secret, 'push_dispatch_secret', 'Shared secret authenticating pg_cron -> /api/public/hooks/dispatch-push');
  ELSE
    PERFORM vault.update_secret(v_id, new_secret);
  END IF;
END $$;

-- Unschedule the old cron that embedded the plaintext secret
DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'dispatch-web-push';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Reschedule: build the header from the vault at execution time
SELECT cron.schedule(
  'dispatch-web-push',
  '* * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://project--zddnbrdnlhmlpzoqzwqb.lovable.app/api/public/hooks/dispatch-push',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-dispatch-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'push_dispatch_secret')
    ),
    body := '{}'::jsonb
  );
  $cron$
);