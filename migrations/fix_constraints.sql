-- Fix missing Primary Keys and Unique Constraints caused by basic migration script

-- 1. users table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name='users' AND constraint_type='PRIMARY KEY') THEN
        ALTER TABLE users ADD PRIMARY KEY (id);
    END IF;
END $$;

-- 2. user_profiles table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name='user_profiles' AND constraint_type='PRIMARY KEY') THEN
        ALTER TABLE user_profiles ADD PRIMARY KEY (user_id);
    END IF;
END $$;

-- 3. wallets table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name='wallets' AND constraint_type='PRIMARY KEY') THEN
        ALTER TABLE wallets ADD PRIMARY KEY (user_id);
    END IF;
END $$;

-- 4. user_skills table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name='user_skills' AND constraint_type='UNIQUE') THEN
        ALTER TABLE user_skills ADD UNIQUE (user_id, skill_id);
    END IF;
END $$;

-- 5. categories table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name='categories' AND constraint_type='PRIMARY KEY') THEN
        ALTER TABLE categories ADD PRIMARY KEY (id);
    END IF;
END $$;

-- 6. skills table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name='skills' AND constraint_type='PRIMARY KEY') THEN
        ALTER TABLE skills ADD PRIMARY KEY (id);
    END IF;
END $$;

-- 7. jobs table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name='jobs' AND constraint_type='PRIMARY KEY') THEN
        ALTER TABLE jobs ADD PRIMARY KEY (id);
    END IF;
END $$;

-- 8. checkpoints table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name='checkpoints' AND constraint_type='PRIMARY KEY') THEN
        ALTER TABLE checkpoints ADD PRIMARY KEY (id);
    END IF;
END $$;

-- 9. contracts table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name='contracts' AND constraint_type='PRIMARY KEY') THEN
        ALTER TABLE contracts ADD PRIMARY KEY (id);
    END IF;
END $$;

-- 10. proposals table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name='proposals' AND constraint_type='PRIMARY KEY') THEN
        ALTER TABLE proposals ADD PRIMARY KEY (id);
    END IF;
END $$;
