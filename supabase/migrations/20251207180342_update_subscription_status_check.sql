ALTER TABLE user_subscriptions
DROP CONSTRAINT IF EXISTS user_subscriptions_status_check;

ALTER TABLE user_subscriptions
ADD CONSTRAINT user_subscriptions_status_check
CHECK (status IN ('active', 'inactive', 'cancelled', 'expired', 'limited', 'trial', 'created', 'cancelling', 'pending'));
