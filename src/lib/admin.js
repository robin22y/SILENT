import { supabase } from './supabase'

/**
 * Check if current user is an admin
 * @returns {Promise<boolean>}
 */
export async function isAdmin() {
  const {
    data: { user },
    error
  } = await supabase.auth.getUser()

  if (error || !user) return false

  const { data, error: adminError } = await supabase
    .from('admin_users')
    .select('is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (adminError || !data) return false

  return true
}

/**
 * Get admin status for current user
 * @returns {Promise<{isAdmin: boolean, email: string | null}>}
 */
export async function getAdminStatus() {
  const {
    data: { user },
    error
  } = await supabase.auth.getUser()

  if (error || !user) {
    return { isAdmin: false, email: null }
  }

  const { data, error: adminError } = await supabase
    .from('admin_users')
    .select('is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  return {
    isAdmin: !adminError && !!data,
    email: user.email
  }
}

