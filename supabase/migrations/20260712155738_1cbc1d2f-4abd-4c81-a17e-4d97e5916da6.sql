DO $$
DECLARE
  accounts jsonb := jsonb_build_array(
    jsonb_build_object('email','admin@elga.local',   'pw','elga-srv-adm-K7pQx9nR2mW8vLtY'),
    jsonb_build_object('email','store@elga.local',   'pw','elga-srv-str-J3fH8kD2nB5cM9zP'),
    jsonb_build_object('email','bakery@elga.local',  'pw','elga-srv-bak-T6yN2gF4wQ8sX1jL'),
    jsonb_build_object('email','delivery@elga.local','pw','elga-srv-del-V9mP3xC7bH5rD2kQ'),
    jsonb_build_object('email','branch1@elga.local', 'pw','elga-srv-b1-N8jK4wY6tR3fM9pQ'),
    jsonb_build_object('email','branch2@elga.local', 'pw','elga-srv-b2-L2xB7hV5nD8cF4mR')
  );
  a jsonb;
  new_id uuid;
BEGIN
  FOR a IN SELECT * FROM jsonb_array_elements(accounts) LOOP
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = a->>'email') THEN
      new_id := gen_random_uuid();
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, email_change,
        email_change_token_new, recovery_token
      ) VALUES (
        '00000000-0000-0000-0000-000000000000', new_id, 'authenticated', 'authenticated',
        a->>'email', crypt(a->>'pw', gen_salt('bf')),
        now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
        now(), now(), '', '', '', ''
      );
      INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
      VALUES (gen_random_uuid(), new_id,
              jsonb_build_object('sub', new_id::text, 'email', a->>'email', 'email_verified', true),
              'email', a->>'email', now(), now(), now());
    ELSE
      UPDATE auth.users
        SET encrypted_password = crypt(a->>'pw', gen_salt('bf')),
            email_confirmed_at = COALESCE(email_confirmed_at, now())
      WHERE email = a->>'email';
    END IF;
  END LOOP;
END $$;