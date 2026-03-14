-- ENSURE PRIMARY KEYS FOR SOCIAL TABLES
DO $$ BEGIN
    -- 1. Posts table
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name='posts' AND constraint_type='PRIMARY KEY') THEN
        ALTER TABLE posts ADD PRIMARY KEY (id);
    END IF;

    -- 2. Post Likes table
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name='post_likes' AND constraint_type='PRIMARY KEY') THEN
        ALTER TABLE post_likes ADD PRIMARY KEY (post_id, user_id);
    END IF;

    -- 3. Post Comments table
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name='post_comments' AND constraint_type='PRIMARY KEY') THEN
        ALTER TABLE post_comments ADD PRIMARY KEY (id);
    END IF;

    -- 4. User Followers table
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name='user_followers' AND constraint_type='PRIMARY KEY') THEN
        ALTER TABLE user_followers ADD PRIMARY KEY (follower_id, following_id);
    END IF;
END $$;
