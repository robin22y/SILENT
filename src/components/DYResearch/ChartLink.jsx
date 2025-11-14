import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export function ChartLink({ ticker, userId }) {
  const [chartLink, setChartLink] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadChartLink()
  }, [ticker, userId])

  async function loadChartLink() {
    if (!userId) return

    const { data } = await supabase
      .from('dy_meta')
      .select('chart_link')
      .eq('user_id', userId)
      .eq('ticker', ticker)
      .maybeSingle()

    if (data?.chart_link) setChartLink(data.chart_link)
  }

  async function saveChartLink() {
    if (!userId || !chartLink.trim()) return

    setSaving(true)

    await supabase
      .from('dy_meta')
      .upsert({
        user_id: userId,
        ticker,
        chart_link: chartLink,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,ticker'
      })

    setSaving(false)
  }

  if (!userId) return null

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-2">Chart Link (Optional)</h3>
      <p className="text-sm text-gray-600 mb-3">
        Save your TradingView chart for reference
      </p>

      <input
        type="url"
        value={chartLink}
        onChange={(e) => setChartLink(e.target.value)}
        onBlur={saveChartLink}
        placeholder="https://www.tradingview.com/chart/..."
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />

      {chartLink && (
        <a
          href={chartLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-2 text-sm text-blue-600 hover:underline"
        >
          📊 Open Chart →
        </a>
      )}

      {saving && <p className="mt-2 text-xs text-gray-500">Saving...</p>}
    </div>
  )
}

