-- Allow users to enroll in the same reward task multiple times (referral tasks)
ALTER TABLE public.reward_enrollments
  DROP CONSTRAINT IF EXISTS reward_enrollments_user_id_reward_id_key;