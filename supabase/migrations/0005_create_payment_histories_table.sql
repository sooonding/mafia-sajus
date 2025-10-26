-- Create payment_histories table
CREATE TABLE IF NOT EXISTS payment_histories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  payment_key TEXT NOT NULL,
  order_id TEXT UNIQUE NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL CHECK (status IN ('DONE', 'ABORTED', 'CANCELED')),
  paid_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add foreign key
ALTER TABLE payment_histories
  ADD CONSTRAINT fk_payment_histories_user_id
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_payment_histories_user_id ON payment_histories(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_histories_order_id ON payment_histories(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_histories_paid_at ON payment_histories(paid_at DESC);

-- Disable RLS
ALTER TABLE payment_histories DISABLE ROW LEVEL SECURITY;

-- Add comment
COMMENT ON TABLE payment_histories IS '결제 이력 기록';
