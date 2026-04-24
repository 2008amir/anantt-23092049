
CREATE TABLE public.user_activity_days (
  user_id uuid NOT NULL,
  activity_date date NOT NULL,
  last_seen timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, activity_date)
);

CREATE INDEX idx_user_activity_days_date ON public.user_activity_days (activity_date);

ALTER TABLE public.user_activity_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Activity owner upsert insert"
  ON public.user_activity_days
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Activity owner update"
  ON public.user_activity_days
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Activity owner select"
  ON public.user_activity_days
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Activity admin select"
  ON public.user_activity_days
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));
