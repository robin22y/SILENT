import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function FilterModal({ show, onClose, filters, onApply }) {
  const [sectors, setSectors] = useState([])
  const [industries, setIndustries] = useState([])
  const [localFilters, setLocalFilters] = useState(filters)

  useEffect(() => {
    setLocalFilters(filters)
  }, [filters])

  useEffect(() => {
    if (show) {
      fetchSectorsAndIndustries()
    }
  }, [show])

  async function fetchSectorsAndIndustries() {
    const { data: stocks } = await supabase
      .from('stocks')
      .select('sector, industry')

    if (stocks) {
      const uniqueSectors = [...new Set(stocks.map(s => s.sector).filter(Boolean))].sort()
      const uniqueIndustries = [...new Set(stocks.map(s => s.industry).filter(Boolean))].sort()
      setSectors(uniqueSectors)
      setIndustries(uniqueIndustries)
    }
  }

  function handleApply() {
    onApply(localFilters)
    onClose()
  }

  function handleReset() {
    const resetFilters = {
      sector: '',
      industry: '',
      minMarketCap: '',
      maxMarketCap: '',
      maxPriceToSales: ''
    }
    setLocalFilters(resetFilters)
    onApply(resetFilters)
    onClose()
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Filters</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {/* Sector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sector
            </label>
            <select
              value={localFilters.sector || ''}
              onChange={(e) => setLocalFilters({ ...localFilters, sector: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">All Sectors</option>
              {sectors.map(sector => (
                <option key={sector} value={sector}>{sector}</option>
              ))}
            </select>
          </div>

          {/* Industry */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Industry
            </label>
            <select
              value={localFilters.industry || ''}
              onChange={(e) => setLocalFilters({ ...localFilters, industry: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">All Industries</option>
              {industries.map(industry => (
                <option key={industry} value={industry}>{industry}</option>
              ))}
            </select>
          </div>

          {/* Market Cap */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min Market Cap
              </label>
              <input
                type="number"
                placeholder="Min Market Cap"
                value={localFilters.minMarketCap || ''}
                onChange={(e) => setLocalFilters({ ...localFilters, minMarketCap: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Market Cap
              </label>
              <input
                type="number"
                placeholder="Max Market Cap"
                value={localFilters.maxMarketCap || ''}
                onChange={(e) => setLocalFilters({ ...localFilters, maxMarketCap: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>

          {/* Price to Sales */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Price-to-Sales
            </label>
            <input
              type="number"
              step="0.1"
              placeholder="Max Price-to-Sales"
              value={localFilters.maxPriceToSales || ''}
              onChange={(e) => setLocalFilters({ ...localFilters, maxPriceToSales: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300"
          >
            Reset
          </button>
          <button
            onClick={handleApply}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  )
}

