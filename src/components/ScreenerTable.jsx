import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { ColumnCustomizer } from './ColumnCustomizer'

const DEFAULT_COLUMNS = [
  { id: 'ticker', label: 'Ticker', locked: true },
  { id: 'stage', label: 'Stage' },
  { id: 'accumulation_score', label: 'Accum Score' },
  { id: 'insider_net_90d', label: 'Insider 90d' },
  { id: 'relative_strength_6mo', label: 'RS 6mo' }
]

export function ScreenerTable() {
  const [stocks, setStocks] = useState([])
  const [columns, setColumns] = useState(DEFAULT_COLUMNS)
  const [showCustomizer, setShowCustomizer] = useState(false)
  const [sortBy, setSortBy] = useState('accumulation_score')
  const [sortOrder, setSortOrder] = useState('desc')
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    fetchStocks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, sortOrder, columns])
  
  async function fetchStocks() {
    setLoading(true)
    
    // Build SELECT with only needed columns (ticker is always required)
    const selectCols = ['ticker', ...columns.filter(c => c.id !== 'ticker').map(c => c.id)].join(', ')
    
    let query = supabase
      .from('stocks')
      .select(selectCols)
      .limit(100)
    
    // Only add order if the column exists and is sortable
    if (sortBy && columns.some(c => c.id === sortBy)) {
      query = query.order(sortBy, { ascending: sortOrder === 'asc' })
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('Error fetching stocks:', error)
    }
    
    setStocks(data || [])
    setLoading(false)
  }
  
  function handleSort(columnId) {
    if (sortBy === columnId) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(columnId)
      setSortOrder('desc')
    }
  }
  
  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">🐋 Stock Screener</h1>
        <button
          onClick={() => setShowCustomizer(true)}
          className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300"
        >
          ⚙️ Customize Columns
        </button>
      </div>
      
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full bg-white rounded-lg shadow">
          <thead className="bg-gray-50 border-b">
            <tr>
              {columns.map(col => (
                <th
                  key={col.id}
                  onClick={() => !col.locked && handleSort(col.id)}
                  className="px-4 py-3 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                >
                  {col.label}
                  {sortBy === col.id && (
                    <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
              ))}
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={columns.length + 1} className="text-center py-8">Loading...</td></tr>
            ) : (
              stocks.map(stock => (
                <tr key={stock.ticker} className="border-b hover:bg-gray-50">
                  {columns.map(col => (
                    <td key={col.id} className="px-4 py-3 text-sm">
                      {formatCell(stock[col.id], col.id)}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => {/* Add to journal */}}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      +
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* Column Customizer Modal */}
      {showCustomizer && (
        <ColumnCustomizer
          currentColumns={columns}
          onSave={(newColumns) => {
            setColumns(newColumns)
            setShowCustomizer(false)
            fetchStocks()
          }}
          onClose={() => setShowCustomizer(false)}
        />
      )}
    </div>
  )
}

function formatCell(value, columnId) {
  // Format based on column type
  if (value === null || value === undefined) return '-'
  
  if (columnId === 'stage') {
    const stageEmoji = { 1: '🟡', 2: '🟢', 3: '🟠', 4: '🔴' }
    return `${stageEmoji[value] || ''} S${value}`
  }
  
  if (columnId.includes('_pct') || columnId.includes('percent')) {
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
  }
  
  if (columnId.includes('price') || columnId.includes('_$')) {
    return `$${value.toFixed(2)}`
  }
  
  if (columnId === 'market_cap') {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
    return `$${(value / 1e6).toFixed(1)}M`
  }
  
  return value
}

