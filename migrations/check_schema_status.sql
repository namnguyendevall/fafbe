-- CHECK SCHEMA STATUS
SELECT 
    table_name, 
    column_name, 
    is_nullable, 
    is_identity, 
    identity_generation
FROM information_schema.columns 
WHERE table_name IN ('users', 'otps', 'wallets')
AND column_name = 'id';

SELECT 
    tc.table_name, 
    kcu.column_name, 
    tc.constraint_type
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu 
  ON tc.constraint_name = kcu.constraint_name 
  AND tc.table_schema = kcu.table_schema
WHERE tc.table_name IN ('users', 'otps', 'wallets')
AND tc.constraint_type = 'PRIMARY KEY';
