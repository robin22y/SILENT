-- ============================================
-- MANUAL ADMIN SETUP (if function doesn't work)
-- ============================================
-- 
-- Step 1: Find your user ID by running this:
SELECT id, email, created_at 
FROM auth.users 
WHERE LOWER(email) IN ('robin2y@gmail.com', 'robin@digiget.uk')
ORDER BY email;

-- Step 2: Copy the UUID(s) from above and use them below:
-- Replace USER_ID_HERE with the actual UUID from Step 1

-- Example (replace with actual UUIDs):
-- INSERT INTO admin_users (user_id, email, is_active)
-- VALUES 
--   ('00000000-0000-0000-0000-000000000001', 'robin2y@gmail.com', true),
--   ('00000000-0000-0000-0000-000000000002', 'robin@digiget.uk', true)
-- ON CONFLICT (user_id) DO UPDATE SET is_active = true;

-- Step 3: Verify admin access was granted:
SELECT 
  au.email, 
  au.is_active, 
  au.created_at,
  u.email as auth_email
FROM admin_users au
JOIN auth.users u ON au.user_id = u.id
WHERE au.is_active = true;

