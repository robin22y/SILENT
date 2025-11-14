# Admin Setup Instructions

## Step 1: Create the admin_users table

First, run the main database schema to create the `admin_users` table:

**Run this in Supabase SQL Editor:**
```sql
-- Create admin_users table
CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
```

## Step 2: Find your user ID

After signing up, run this to find your user ID:

```sql
SELECT id, email, created_at 
FROM auth.users 
WHERE LOWER(email) LIKE '%robin%'
ORDER BY created_at DESC;
```

## Step 3: Grant admin access

**Option A: Using the function (recommended)**

```sql
-- Create the function
CREATE OR REPLACE FUNCTION grant_admin_by_email(user_email text)
RETURNS void AS $$
DECLARE
  target_user_id uuid;
  actual_email text;
BEGIN
  SELECT id, email INTO target_user_id, actual_email
  FROM auth.users
  WHERE LOWER(email) = LOWER(user_email);
  
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', user_email;
  END IF;
  
  INSERT INTO admin_users (user_id, email, is_active)
  VALUES (target_user_id, actual_email, true)
  ON CONFLICT (user_id) DO UPDATE SET is_active = true;
  
  RAISE NOTICE 'Admin access granted to %', actual_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant admin access
SELECT grant_admin_by_email('robin2y@gmail.com');
SELECT grant_admin_by_email('robin@digiget.uk');
```

**Option B: Manual insert (if function doesn't work)**

Replace `YOUR_USER_ID_HERE` with the UUID from Step 2:

```sql
INSERT INTO admin_users (user_id, email, is_active)
VALUES 
  ('YOUR_USER_ID_HERE', 'robin2y@gmail.com', true)
ON CONFLICT (user_id) DO UPDATE SET is_active = true;
```

## Step 4: Verify admin access

```sql
SELECT 
  au.email, 
  au.is_active, 
  au.created_at
FROM admin_users au
JOIN auth.users u ON au.user_id = u.id
WHERE au.is_active = true;
```

## Step 5: Set up RLS policies

Run `database_schema_admin_rls.sql` to enable Row Level Security for admin operations.

