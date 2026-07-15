
CREATE TYPE public.note_priority AS ENUM ('low','medium','high');
CREATE TYPE public.note_status AS ENUM ('pending','completed');
CREATE TYPE public.note_category AS ENUM (
  'inventory','suppliers','finance','staff','maintenance',
  'branch_operations','central_store','central_bakery','general'
);

CREATE TABLE public.admin_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category public.note_category NOT NULL DEFAULT 'general',
  priority public.note_priority NOT NULL DEFAULT 'medium',
  due_at timestamptz,
  reminder_at timestamptz,
  status public.note_status NOT NULL DEFAULT 'pending',
  pinned boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false,
  reminder_dismissed boolean NOT NULL DEFAULT false,
  last_reminded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_notes TO authenticated;
GRANT ALL ON public.admin_notes TO service_role;

ALTER TABLE public.admin_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY notes_select ON public.admin_notes FOR SELECT TO authenticated
  USING (owner_id = auth.uid() AND private.is_admin(auth.uid()));
CREATE POLICY notes_insert ON public.admin_notes FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND private.is_admin(auth.uid()));
CREATE POLICY notes_update ON public.admin_notes FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() AND private.is_admin(auth.uid()))
  WITH CHECK (owner_id = auth.uid() AND private.is_admin(auth.uid()));
CREATE POLICY notes_delete ON public.admin_notes FOR DELETE TO authenticated
  USING (owner_id = auth.uid() AND private.is_admin(auth.uid()));

CREATE TRIGGER admin_notes_updated
  BEFORE UPDATE ON public.admin_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX admin_notes_owner_idx ON public.admin_notes(owner_id);
CREATE INDEX admin_notes_reminder_idx ON public.admin_notes(reminder_at)
  WHERE status='pending' AND archived=false AND reminder_dismissed=false;

ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notes;

CREATE OR REPLACE FUNCTION public.emit_note_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.* FROM public.admin_notes n
    WHERE n.status='pending' AND n.archived=false AND n.reminder_dismissed=false
      AND n.reminder_at IS NOT NULL AND n.reminder_at <= now()
      AND (n.last_reminded_at IS NULL OR n.last_reminded_at < now() - interval '5 minutes')
  LOOP
    PERFORM public.notify_users(
      NULL, ARRAY[r.owner_id]::uuid[],
      'note_reminder',
      CASE r.priority WHEN 'high' THEN 'critical' ELSE 'reminder' END,
      'Reminder: ' || r.title,
      COALESCE(r.description, r.title),
      '/notes', NULL, NULL, NULL, NULL,
      'admin_note', r.id,
      jsonb_build_object('priority', r.priority, 'category', r.category)
    );
    UPDATE public.admin_notes SET last_reminded_at = now() WHERE id = r.id;
  END LOOP;
END $$;

SELECT cron.schedule(
  'emit-note-reminders',
  '* * * * *',
  $$ SELECT public.emit_note_reminders(); $$
);
