import { supabase } from './supabase'

/**
 * @typedef {Object} JournalEntry
 * @property {string} id
 * @property {string} user_id
 * @property {string} ticker
 * @property {'long' | 'short' | ''} direction
 * @property {number | null} entry_price
 * @property {number | null} exit_price
 * @property {number | null} position_size
 * @property {string | null} reason
 * @property {string | null} emotion
 * @property {string | null} notes
 * @property {string | null} screenshot_url
 * @property {number | null} pnl
 * @property {string} created_at
 */

function getMonthStartISO() {
  const d = new Date()
  d.setUTCDate(1)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

/**
 * Free users: max 5 entries / month. Paid plans: unlimited (for now).
 * @returns {Promise<boolean>}
 */
export async function canCreateJournalEntry() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return false

  // get plan (if you already have user_subscription table)
  let plan = 'free'
  const { data: sub } = await supabase
    .from('user_subscription')
    .select('plan')
    .eq('user_id', user.id)
    .maybeSingle()

  if (sub?.plan) plan = sub.plan

  if (plan !== 'free') return true // paid = unlimited for now

  const monthStart = getMonthStartISO()

  const { count, error: countError } = await supabase
    .from('trading_journal')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', monthStart)

  if (countError) {
    console.error('journal count error', countError)
    return false
  }

  return (count ?? 0) < 5
}

/**
 * @returns {Promise<JournalEntry[]>}
 */
export async function fetchJournalEntries() {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data, error } = await supabase
    .from('trading_journal')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('fetchJournalEntries error', error)
    return []
  }

  return (data ?? [])
}

/**
 * @param {Object} payload
 * @param {string} payload.ticker
 * @param {'long' | 'short' | ''} payload.direction
 * @param {number | null} [payload.entry_price]
 * @param {number | null} [payload.exit_price]
 * @param {number | null} [payload.position_size]
 * @param {string} [payload.reason]
 * @param {string} [payload.emotion]
 * @param {string} [payload.notes]
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function createJournalEntry(payload) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { ok: false, error: 'Not logged in' }

  const allowed = await canCreateJournalEntry()
  if (!allowed) {
    return { ok: false, error: 'Free limit reached (5 entries this month)' }
  }

  const { error } = await supabase.from('trading_journal').insert({
    user_id: user.id,
    ticker: payload.ticker.toUpperCase(),
    direction: payload.direction || null,
    entry_price: payload.entry_price ?? null,
    exit_price: payload.exit_price ?? null,
    position_size: payload.position_size ?? null,
    reason: payload.reason || null,
    emotion: payload.emotion || null,
    notes: payload.notes || null,
  })

  if (error) {
    console.error('createJournalEntry error', error)
    return { ok: false, error: error.message }
  }

  return { ok: true }
}

