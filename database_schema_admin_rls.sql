-- ============================================
-- ROW LEVEL SECURITY FOR ADMIN SYSTEM
-- ============================================

-- Enable RLS on admin_users
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Only admins can view admin_users table
CREATE POLICY "Admins can view admin users"
  ON admin_users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Only service role can insert/update admin_users (for security)
-- This should be done via backend/function, not directly from frontend

-- ============================================
-- RLS FOR DY_QUESTIONS (Admin can modify)
-- ============================================

-- Questions are viewable by everyone (read-only for non-admins)
CREATE POLICY "Questions are viewable by everyone"
  ON dy_questions FOR SELECT
  USING (true);

-- Only admins can insert questions
CREATE POLICY "Admins can insert questions"
  ON dy_questions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Only admins can update questions
CREATE POLICY "Admins can update questions"
  ON dy_questions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Only admins can delete questions
CREATE POLICY "Admins can delete questions"
  ON dy_questions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

