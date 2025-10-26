-- Create analyses table
CREATE TABLE IF NOT EXISTS analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  birth_date DATE NOT NULL,
  birth_time TIME,
  is_lunar BOOLEAN NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
  result JSONB NOT NULL,
  model_used TEXT NOT NULL CHECK (model_used IN ('gemini-2.5-flash', 'gemini-2.5-pro')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add foreign key
ALTER TABLE analyses
  ADD CONSTRAINT fk_analyses_user_id
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_analyses_user_id_created_at
  ON analyses(user_id, created_at DESC);

-- Disable RLS
ALTER TABLE analyses DISABLE ROW LEVEL SECURITY;

-- Add comment
COMMENT ON TABLE analyses IS '사주 분석 결과 영구 보관';
