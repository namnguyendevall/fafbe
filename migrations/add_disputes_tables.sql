-- Migration to add Disputes and Dispute Messages
CREATE TABLE IF NOT EXISTS disputes (
    id SERIAL PRIMARY KEY,
    contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    checkpoint_id INTEGER REFERENCES checkpoints(id) ON DELETE SET NULL,
    raised_by INTEGER NOT NULL REFERENCES users(id),
    reason TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'OPEN', -- OPEN, RESOLVED, CANCELLED
    resolution VARCHAR(50),           -- CLIENT_WINS, WORKER_WINS, SPLIT
    resolution_summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dispute_messages (
    id SERIAL PRIMARY KEY,
    dispute_id INTEGER NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id),
    message TEXT NOT NULL,
    attachments JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);
CREATE INDEX IF NOT EXISTS idx_disputes_contract_id ON disputes(contract_id);
CREATE INDEX IF NOT EXISTS idx_dispute_messages_dispute_id ON dispute_messages(dispute_id);
