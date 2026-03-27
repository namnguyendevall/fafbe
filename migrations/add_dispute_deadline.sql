-- Add employer_resolution_deadline to disputes table
ALTER TABLE disputes 
ADD COLUMN IF NOT EXISTS employer_resolution_deadline TIMESTAMP WITH TIME ZONE;

-- Update existing disputes to have a 24h deadline from their creation if not set
UPDATE disputes 
SET employer_resolution_deadline = created_at + INTERVAL '24 hours'
WHERE employer_resolution_deadline IS NULL;
