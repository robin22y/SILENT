import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { StockCard } from './StockCard'

export function StockList() {
  const [stocks, setStocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // 'all', 'stage2', 'accumulating'

  useEffect(() => {
    fetchStocks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  async function fetchStocks() {
    setLoading(true)

    let query = supabase
      .from('stocks')
      .select(`
        id,
        ticker,
        name,
        sector,
        industry,
        market_cap,
        stage,
        insider_summary (
          buys_90d,
          sells_90d,
          net_activity_90d,
          verdict
        )
      `)
      .order('market_cap', { ascending: false })

    if (filter === 'stage2') {
      query = query.eq('stage', 2)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching stocks:', error)
      setStocks([])
      setLoading(false)
      return
    }

    // Flatten insider_summary
    let result = (data || []).map((stock) => {
      const summary = stock.insider_summary && stock.insider_summary.length > 0
        ? stock.insider_summary[0]
        : null

      return {
        ...stock,
        verdict: summary?.verdict || 'neutral',
        buys_90d: summary?.buys_90d || 0,
        sells_90d: summary?.sells_90d || 0,
        net_activity_90d: summary?.net_activity_90d || 0
      }
    })

    // Insider Activity Tab (previously "Accumulating")
    if (filter === 'accumulating') {
      result = result.filter(
        (s) =>
          s.verdict === 'accumulating' ||
          s.verdict === 'distributing'
      )
    }

    setStocks(result)
    setLoading(false)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          🐋 Silent Whale
        </h1>
        <p className="text-lg text-gray-600">
          See where smart money is accumulating
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-md text-sm font-medium ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          All Stocks
        </button>
        <button
          onClick={() => setFilter('stage2')}
          className={`px-4 py-2 rounded-md text-sm font-medium ${
            filter === 'stage2'
              ? 'bg-green-600 text-white'
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          Stage 2 Only
        </button>
        <button
          onClick={() => setFilter('accumulating')}
          className={`px-4 py-2 rounded-md text-sm font-medium ${
            filter === 'accumulating'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          🔥 Accumulating
        </button>
      </div>

      {/* Stock Grid */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-600">Loading stocks...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stocks.map((stock) => (
            <StockCard key={stock.ticker} stock={stock} />
          ))}
        </div>
      )}
    </div>
  )
}


