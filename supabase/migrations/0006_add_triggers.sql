-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_users_updated_at'
  ) THEN
    CREATE TRIGGER trigger_users_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- Apply trigger to subscriptions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_subscriptions_updated_at'
  ) THEN
    CREATE TRIGGER trigger_subscriptions_updated_at
      BEFORE UPDATE ON subscriptions
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- Add comments
COMMENT ON FUNCTION set_updated_at() IS 'updated_at 필드를 자동으로 현재 시각으로 업데이트';
