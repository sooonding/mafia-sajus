-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'expired')),
  billing_key TEXT,
  customer_key TEXT,
  started_at TIMESTAMPTZ,
  next_billing_date TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add foreign key
ALTER TABLE subscriptions
  ADD CONSTRAINT fk_subscriptions_user_id
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_billing_date
  ON subscriptions(next_billing_date) WHERE status = 'active';

-- Disable RLS
ALTER TABLE subscriptions DISABLE ROW LEVEL SECURITY;

-- Add comment
COMMENT ON TABLE subscriptions IS '구독 정보 및 빌링키 관리';
