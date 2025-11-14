import { supabase } from './supabase'

/**
 * Check if user has reached their monthly trading journal entry limit
 * @param {string} userId - User ID from Supabase auth
 * @param {string} userPlan - User plan ('free', 'tier50', 'tier100')
 * @returns {Promise<{allowed: boolean, message?: string}>}
 */
export async function checkJournalQuota(userId, userPlan) {
  if (!userId) {
    return { allowed: false, message: 'User not authenticated' }
  }

  // Get start of current month
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  // Get count of entries this month
  const { data, error, count } = await supabase
    .from('trading_journal')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', startOfMonth)

  if (error) {
    console.error('Error checking journal quota:', error)
    return { allowed: false, message: 'Error checking quota' }
  }

  const entryCount = count || 0

  // Check limits based on plan
  const limits = {
    free: 5,
    tier50: 50,
    tier100: 100
  }

  const limit = limits[userPlan] || limits.free

  if (entryCount >= limit) {
    const messages = {
      free: "You've used all 5 free journal entries this month.",
      tier50: "You've used all 50 monthly journal entries.",
      tier100: "You've used all 100 monthly journal entries."
    }
    return {
      allowed: false,
      message: messages[userPlan] || messages.free,
      count: entryCount,
      limit
    }
  }

  return {
    allowed: true,
    count: entryCount,
    limit,
    remaining: limit - entryCount
  }
}

