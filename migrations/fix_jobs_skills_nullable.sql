-- FIX: Make redundant 'skills' column in 'jobs' table nullable
-- This column is not used by the current many-to-many implementation but has a NOT NULL constraint.

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'skills') THEN
        ALTER TABLE jobs ALTER COLUMN skills DROP NOT NULL;
    END IF;
END $$;
