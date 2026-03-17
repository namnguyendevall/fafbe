-- Fix transactions table reference_id type to support ZaloPay/MoMo string-based IDs
-- Run this in Supabase SQL Editor
ALTER TABLE transactions ALTER COLUMN reference_id TYPE VARCHAR(100);
