-- Add subscription_shown column to profiles for first-time subscription redirect
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS subscription_shown BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.subscription_shown IS 'Tracks if the user has been shown the subscription page after first email verification';
