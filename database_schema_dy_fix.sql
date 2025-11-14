-- Fix: Add data_sources column if it doesn't exist
-- Run this FIRST if you get "column data_sources does not exist" error

-- Add the column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'dy_questions' 
        AND column_name = 'data_sources'
    ) THEN
        ALTER TABLE dy_questions ADD COLUMN data_sources text;
        RAISE NOTICE 'Added data_sources column to dy_questions';
    ELSE
        RAISE NOTICE 'Column data_sources already exists';
    END IF;
END $$;

-- Verify the column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public'
AND table_name = 'dy_questions' 
AND column_name = 'data_sources';
