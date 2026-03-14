-- Work Sessions table to track check-in/check-out for checkpoints
CREATE TABLE IF NOT EXISTS work_sessions (
  id SERIAL PRIMARY KEY,
  checkpoint_id INTEGER NOT NULL REFERENCES checkpoints(id) ON DELETE CASCADE,
  worker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  check_in TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  check_out TIMESTAMPTZ,
  duration_minutes INTEGER, -- computed on check_out
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_sessions_checkpoint ON work_sessions(checkpoint_id);
CREATE INDEX IF NOT EXISTS idx_work_sessions_worker ON work_sessions(worker_id);
