import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export function DecisionButtons({ ticker, userId }) {
  const [decision, setDecision] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadDecision()
  }, [ticker, userId])

  async function loadDecision() {
    if (!userId) return

    const { data } = await supabase
      .from('dy_decisions')
      .select('decision')
      .eq('user_id', userId)
      .eq('ticker', ticker)
      .maybeSingle()

    if (data) setDecision(data.decision)
  }

  async function saveDecision(newDecision) {
    if (!userId) return

    setSaving(true)
    setDecision(newDecision)

    await supabase
      .from('dy_decisions')
      .upsert({
        user_id: userId,
        ticker,
        decision: newDecision,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,ticker'
      })

    setSaving(false)
  }

  const buttons = [
    { value: 'BUY', label: 'BUY', color: 'bg-green-600 hover:bg-green-700', selectedColor: 'bg-green-700' },
    { value: 'HOLD', label: 'HOLD', color: 'bg-yellow-600 hover:bg-yellow-700', selectedColor: 'bg-yellow-700' },
    { value: 'SELL', label: 'SELL', color: 'bg-red-600 hover:bg-red-700', selectedColor: 'bg-red-700' }
  ]

  if (!userId) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
        <p className="text-gray-600 text-sm">Sign in to make a decision</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">My Decision</h3>

      <div className="flex gap-3">
        {buttons.map(btn => (
          <button
            key={btn.value}
            onClick={() => saveDecision(btn.value)}
            disabled={saving}
            className={`
              flex-1 py-3 rounded-md text-white font-semibold transition-colors
              ${decision === btn.value ? btn.selectedColor : btn.color}
              ${saving ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {decision && (
        <p className="mt-3 text-sm text-gray-600 text-center">
          Decision saved: <span className="font-semibold">{decision}</span>
        </p>
      )}
    </div>
  )
}

