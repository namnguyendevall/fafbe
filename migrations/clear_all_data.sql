-- DANGER: THIS SCRIPT CLEARS ALL DATA FROM THE DATABASE
-- It will remove all records from the listed tables and reset auto-incrementing IDs (identities) to 1.
-- This action is IRREVERSIBLE.

DO $$ 
DECLARE
    -- List of all tables to clear (excluding static/seed tables like categories/skills if you want to keep them)
    -- If you want to keep categories and skills, remove them from this list.
    target_tables TEXT[] := ARRAY[
        'notifications', 'messages', 'conversation_participants', 'conversations',
        'otps', 'post_comments', 'post_likes', 'posts', 'user_followers',
        'review_skill_ratings', 'reviews', 'work_sessions', 'withdrawal_requests',
        'checkpoints', 'contracts', 'proposals', 'job_skills', 'jobs', 
        'user_skills', 'transactions', 'wallets', 'user_profiles', 'users'
    ];
    t TEXT;
BEGIN
    FOREACH t IN ARRAY target_tables
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t) THEN
            EXECUTE format('TRUNCATE TABLE %I RESTART IDENTITY CASCADE', t);
            RAISE NOTICE 'Cleared and reset table: %', t;
        END IF;
    END LOOP;
END $$;
