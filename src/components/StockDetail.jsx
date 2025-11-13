import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchInsiderForTicker } from '../lib/fetchInsider'
import { StageIndicator } from './StageIndicator'

export function StockDetail() {
  const { ticker } = useParams()
  const [stock, setStock] = useState(null)
  const [insider, setInsider] = useState(null)
  const [insiderTransactions, setInsiderTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  const formatMarketCap = (cap) => {
    if (!cap) return "-";

    if (cap >= 1e12) return `${(cap / 1e12).toFixed(1)}T`;
    if (cap >= 1e9)  return `${(cap / 1e9).toFixed(1)}B`;
    if (cap >= 1e6)  return `${(cap / 1e6).toFixed(1)}M`;

    return cap.toString();
  };

  useEffect(() => {
    async function load() {
      setLoading(true)

      // 1) Hit Netlify function to refresh EDGAR data + summary
      try {
        await fetchInsiderForTicker(ticker)
      } catch (e) {
        console.error('EDGAR fetch failed:', e)
        // still continue, maybe previous data exists
      }

      // 2) Load stock + summary from Supabase
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
        console.error('Stock detail fetch error:', error)
        setLoading(false)
        return
      }

      const summary = data?.insider_summary?.[0] || null

      setStock(data)
      setInsider(summary)

      // 3) Load insider transactions for display
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

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-gray-600">Loading...</p>
      </div>
    )
  }

  if (!stock) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-gray-600 mb-4">Stock not found.</p>
        <Link to="/" className="text-blue-600 hover:underline">← Back</Link>
      </div>
    )
  }

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
      {insider && (
        <div className="border rounded-lg p-4 bg-gray-50 space-y-2">
          <div className="font-semibold text-lg">Insider activity (last 90 days)</div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Buys:</span>
              <span className="ml-2 font-medium">{insider.buys_90d || 0}</span>
            </div>
            <div>
              <span className="text-gray-600">Sells:</span>
              <span className="ml-2 font-medium">{insider.sells_90d || 0}</span>
            </div>
            <div>
              <span className="text-gray-600">Net value:</span>
              <span className={`ml-2 font-medium ${insider.net_activity_90d > 0 ? 'text-green-600' : insider.net_activity_90d < 0 ? 'text-red-600' : ''}`}>
                ${insider.net_activity_90d?.toFixed(0) || 0}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Verdict:</span>
              <span className={`ml-2 font-medium ${
                insider.verdict === 'accumulating' ? 'text-green-600' : 
                insider.verdict === 'distributing' ? 'text-red-600' : 
                'text-gray-600'
              }`}>
                {insider.verdict || 'neutral'}
              </span>
            </div>
          </div>
        </div>
      )}

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
    </div>
  )
}


