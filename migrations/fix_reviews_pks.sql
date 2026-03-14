-- ENSURE PRIMARY KEYS FOR REVIEW TABLES
DO $$ BEGIN
    -- 1. Reviews table
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name='reviews' AND constraint_type='PRIMARY KEY') THEN
        ALTER TABLE reviews ADD PRIMARY KEY (id);
    END IF;

    -- 2. Review Skill Ratings table
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name='review_skill_ratings' AND constraint_type='PRIMARY KEY') THEN
        ALTER TABLE review_skill_ratings ADD PRIMARY KEY (id);
    END IF;
END $$;
