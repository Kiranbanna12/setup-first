ALTER TABLE user_subscriptions
ADD COLUMN IF NOT EXISTS is_trial boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS razorpay_customer_id text,
ADD COLUMN IF NOT EXISTS razorpay_subscription_id text,
ADD COLUMN IF NOT EXISTS trial_amount numeric;
