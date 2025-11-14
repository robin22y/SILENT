-- ============================================
-- SET UP ADMIN USERS
-- ============================================
-- IMPORTANT: Run database_schema.sql FIRST to create the admin_users table!
-- 
-- Step 1: Create the admin_users table (if not already created)
-- This should be in database_schema.sql, but if missing, run this:
CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);

-- Step 2: Find your user ID (run this first to see all users)
-- SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC;

-- First, let's see all registered users to verify emails
SELECT id, email, created_at, email_confirmed_at
FROM auth.users
ORDER BY created_at DESC;

-- OR use this function to automatically grant admin by email (case-insensitive):
CREATE OR REPLACE FUNCTION grant_admin_by_email(user_email text)
RETURNS void AS $$
DECLARE
  target_user_id uuid;
  actual_email text;
BEGIN
  -- Find user by email (case-insensitive)
  SELECT id, email INTO target_user_id, actual_email
  FROM auth.users
  WHERE LOWER(email) = LOWER(user_email);
  
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found. User must sign up first!', user_email;
  END IF;
  
  -- Insert or update admin record (use actual email from database)
  INSERT INTO admin_users (user_id, email, is_active)
  VALUES (target_user_id, actual_email, true)
  ON CONFLICT (user_id) DO UPDATE SET is_active = true;
  
  RAISE NOTICE 'Admin access granted to % (user_id: %)', actual_email, target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant admin access to specified emails
-- NOTE: Users must sign up first before running this!
-- If you get "User not found" error, check the SELECT query above to see registered emails

SELECT grant_admin_by_email('robin2y@gmail.com');
SELECT grant_admin_by_email('robin@digiget.uk');

-- Verify admin users
SELECT au.email, au.is_active, au.created_at
FROM admin_users au
JOIN auth.users u ON au.user_id = u.id
WHERE au.is_active = true;

