
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS pushed_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_notifications_unpushed ON public.notifications(created_at) WHERE pushed_at IS NULL;
