import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getAdminStatus } from '../lib/admin'
import { StockCard } from './StockCard'
import { FilterModal } from './FilterModal'

export function StockList() {
  const [stocks, setStocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // 'all', 'stage2', 'accumulating'
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [filters, setFilters] = useState({
    sector: '',
    industry: '',
    minMarketCap: '',
    maxMarketCap: '',
    maxPriceToSales: ''
  })

  useEffect(() => {
    // Get current user and admin status
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      
      if (user) {
        const adminStatus = await getAdminStatus()
        setIsAdmin(adminStatus.isAdmin)
      }
    }
    
    loadUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        const adminStatus = await getAdminStatus()
        setIsAdmin(adminStatus.isAdmin)
      } else {
        setIsAdmin(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    fetchStocks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, search, filters])

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
        price_to_sales,
        insider_summary (
          buys_90d,
          sells_90d,
          net_activity_90d,
          verdict
        )
      `)
      .limit(20)

    // Apply search filter
    if (search) {
      query = query.or(`name.ilike.%${search}%,ticker.ilike.%${search}%`)
    }

    // Apply other filters
    if (filters.sector) {
      query = query.eq('sector', filters.sector)
    }

    if (filters.industry) {
      query = query.eq('industry', filters.industry)
    }

    if (filters.minMarketCap) {
      query = query.gte('market_cap', parseInt(filters.minMarketCap))
    }

    if (filters.maxMarketCap) {
      query = query.lte('market_cap', parseInt(filters.maxMarketCap))
    }

    if (filters.maxPriceToSales) {
      query = query.lte('price_to_sales', parseFloat(filters.maxPriceToSales))
    }

    // Apply stage filter
    if (filter === 'stage2') {
      query = query.eq('stage', 2)
    }

    // Order by market cap
    query = query.order('market_cap', { ascending: false })

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
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            🐋 Silent Whale
          </h1>
          <p className="text-lg text-gray-600">
            See where smart money is accumulating
          </p>
        </div>
        <nav className="flex gap-4 items-center">
          <Link to="/" className="text-gray-600 hover:text-gray-900">Stocks</Link>
          <Link to="/journal" className="text-gray-600 hover:text-gray-900">Journal</Link>
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">{user.email}</span>
              {isAdmin && (
                <Link to="/admin" className="text-sm text-gray-600 hover:text-gray-900">Admin</Link>
              )}
              <button
                onClick={async () => {
                  await supabase.auth.signOut()
                  setUser(null)
                  setIsAdmin(false)
                }}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <Link to="/auth" className="text-gray-600 hover:text-gray-900">Sign In</Link>
          )}
        </nav>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Search stocks, sectors, industries…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => setShowFilters(true)}
            className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300"
          >
            Filters
          </button>
        </div>

        {/* Quick Filters */}
        <div className="flex flex-wrap gap-3">
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
      </div>

      {/* Filter Modal */}
      <FilterModal
        show={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        onApply={(newFilters) => setFilters(newFilters)}
      />

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


