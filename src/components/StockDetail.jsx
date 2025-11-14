import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchInsiderForTicker } from '../lib/fetchInsider'
import { StageIndicator } from './StageIndicator'
import { Paywall } from './Paywall'
import { DYResearch } from './DYResearch'

export function StockDetail() {
  const { ticker } = useParams()
  const [stock, setStock] = useState(null)
  const [summary, setSummary] = useState(null)
  const [insiderTransactions, setInsiderTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [quotaExceeded, setQuotaExceeded] = useState(false)
  const [userPlan, setUserPlan] = useState('free')
  const [user, setUser] = useState(null)

  const formatMarketCap = (cap) => {
    if (!cap) return "-";

    if (cap >= 1e12) return `${(cap / 1e12).toFixed(1)}T`;
    if (cap >= 1e9)  return `${(cap / 1e9).toFixed(1)}B`;
    if (cap >= 1e6)  return `${(cap / 1e6).toFixed(1)}M`;

    return cap.toString();
  };

  async function refreshTicker(ticker) {
    const response = await fetch("/functions/v1/fetch_stock_data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ticker }),
    })
    
    if (!response.ok) {
      throw new Error(`Failed to refresh stock data: ${response.statusText}`)
    }
    
    const result = await response.json()
    return result
  }

  useEffect(() => {
    // Get current user
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
    })

    async function load() {
      setLoading(true)

      // Refresh stock data (price, volume) via Supabase Edge Function
      try {
        await refreshTicker(ticker)
      } catch (e) {
        console.warn('Stock data refresh failed:', e.message)
      }

      // Fetch insider data
      try {
        await fetchInsiderForTicker(ticker) // triggers EDGAR + summary update
      } catch (e) {
        console.warn('EDGAR fetch failed (continuing with existing data):', e.message)
        // Continue loading - we'll show existing data from Supabase
      }

      const { data, error } = await supabase
        .from('stocks')
        .select(`
          *,
          insider_summary (
            buys_90d,
            sells_90d,
            total_bought_value_90d,
            total_sold_value_90d,
            net_activity_90d,
            verdict
          )
        `)
        .eq('ticker', ticker)
        .maybeSingle()

      if (error) {
        console.error('Stock detail load error', error)
        setLoading(false)
        return
      }

      const s = data?.insider_summary?.[0] || null
      setStock(data)
      setSummary(s)

      // Step 1: Call RPC to record ticker view and check quota
      if (data) {
        const { data: allowed } = await supabase.rpc("record_ticker_view", {
          ticker_symbol: data.ticker
        });

        if (!allowed) {
          setQuotaExceeded(true);
        } else {
          setQuotaExceeded(false);
        }

        // TODO: Get user plan from user profile/table
        // For now, defaulting to 'free'
        setUserPlan('free');
      }

      // Load insider transactions for display
      const today = new Date()
      const ninetyDaysAgo = new Date(today)
      ninetyDaysAgo.setDate(today.getDate() - 90)
      const cutoffDate = ninetyDaysAgo.toISOString().split('T')[0]

      const { data: transactions, error: txError } = await supabase
        .from('insider_transactions')
        .select('*')
        .eq('ticker', ticker)
        .gte('transaction_date', cutoffDate)
        .order('transaction_date', { ascending: false })

      if (!txError) {
        setInsiderTransactions(transactions || [])
      }

      setLoading(false)
    }

    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker])

  if (loading) return <div className="p-4">Loading…</div>
  if (!stock) return <div className="p-4">No data</div>

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <Link to="/" className="text-blue-600 hover:underline text-sm">
        ← Back to list
      </Link>

      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{stock.ticker}</h1>
          <p className="text-gray-700 mt-1">{stock.name}</p>
          <p className="text-sm text-gray-500 mt-1">
            {stock.sector} / {stock.industry}
          </p>
        </div>
        <StageIndicator stage={stock.stage} />
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm bg-white rounded-lg shadow p-4">
        <div>
          <p className="text-gray-500">Market Cap</p>
          <p className="font-medium">{formatMarketCap(stock.market_cap)}</p>
        </div>
        <div>
          <p className="text-gray-500">Price</p>
          <p className="font-medium">${stock.price?.toFixed?.(2) ?? '-'}</p>
        </div>
        <div>
          <p className="text-gray-500">Profit Margin</p>
          <p className="font-medium">
            {stock.profit_margin != null ? (stock.profit_margin * 100).toFixed(1) + '%' : '-'}
          </p>
        </div>
        <div>
          <p className="text-gray-500">Price / Sales</p>
          <p className="font-medium">
            {stock.price_to_sales != null ? stock.price_to_sales.toFixed(1) + 'x' : '-'}
          </p>
        </div>
        <div>
          <p className="text-gray-500">30-week MA</p>
          <p className="font-medium">
            {stock.ma_30_week != null ? stock.ma_30_week.toFixed(2) : '-'}
          </p>
        </div>
        <div>
          <p className="text-gray-500">Updated</p>
          <p className="font-medium">
            {stock.updated_at ? new Date(stock.updated_at).toLocaleString() : '-'}
          </p>
        </div>
      </div>

      {/* Insider Summary Section */}
      {quotaExceeded ? (
        <Paywall plan={userPlan} />
      ) : summary ? (
        <div className="border rounded-lg p-4 bg-gray-50 space-y-1 text-sm">
          <div className="font-semibold">Insider activity (90d)</div>
          <div>Buys: {summary.buys_90d}</div>
          <div>Sells: {summary.sells_90d}</div>
          <div>Net value: {summary.net_activity_90d?.toFixed(0) || 0}</div>
          <div>Verdict: {summary.verdict}</div>
        </div>
      ) : null}

      {/* Insider Transactions Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">Insider Transactions (90 days)</h2>
        </div>

        {insiderTransactions.length === 0 ? (
          <p className="text-gray-500 text-sm">No insider transactions found in the last 90 days.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Insider</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Shares</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Value</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {insiderTransactions.map((tx, idx) => (
                  <tr key={idx} className={tx.transaction_type === 'buy' ? 'bg-green-50' : 'bg-red-50'}>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(tx.transaction_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {tx.insider_name || 'Unknown'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        tx.transaction_type === 'buy' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {tx.transaction_type === 'buy' ? 'Buy' : 'Sell'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {tx.shares?.toLocaleString() || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {tx.price_per_share ? `$${tx.price_per_share.toFixed(2)}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {tx.total_value ? `$${tx.total_value.toLocaleString()}` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* D.Y. Research System */}
      <DYResearch ticker={ticker} stock={stock} user={user} />
    </div>
  )
}


