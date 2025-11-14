import { useState } from 'react'

const AVAILABLE_COLUMNS = [
  { id: 'ticker', label: 'Ticker' },
  { id: 'name', label: 'Name' },
  { id: 'stage', label: 'Stage' },
  { id: 'price', label: 'Price' },
  { id: 'change_today_pct', label: 'Change Today %' },
  { id: 'market_cap', label: 'Market Cap' },
  { id: 'relative_strength_6mo', label: 'RS 6mo' },
  { id: 'relative_strength_3mo', label: 'RS 3mo' },
  { id: 'distance_from_52w_high_pct', label: 'From 52W High %' },
  { id: 'distance_from_ath_pct', label: 'From ATH %' },
  { id: 'price_vs_ma_pct', label: 'Price vs MA %' },
  { id: 'volume_vs_avg_pct', label: 'Volume vs Avg %' },
  { id: 'pe_ratio', label: 'P/E Ratio' },
  { id: 'price_to_sales', label: 'P/S Ratio' },
  { id: 'pb_ratio', label: 'P/B Ratio' },
  { id: 'profit_margin', label: 'Profit Margin' },
  { id: 'roe', label: 'ROE' },
  { id: 'roa', label: 'ROA' },
  { id: 'dividend_yield', label: 'Dividend Yield' },
  { id: 'beta', label: 'Beta' },
  { id: 'insider_ownership_pct', label: 'Insider Ownership %' },
  { id: 'institutional_ownership_pct', label: 'Institutional Ownership %' },
  { id: 'short_interest_pct', label: 'Short Interest %' },
  { id: 'sector', label: 'Sector' },
  { id: 'industry', label: 'Industry' },
]

export function ColumnCustomizer({ currentColumns, onSave, onClose }) {
  const [selectedColumns, setSelectedColumns] = useState(
    currentColumns.map(c => c.id)
  )

  function toggleColumn(columnId) {
    setSelectedColumns(prev => {
      if (prev.includes(columnId)) {
        return prev.filter(id => id !== columnId)
      } else {
        return [...prev, columnId]
      }
    })
  }

  function handleSave() {
    // Preserve locked columns (like ticker)
    const lockedIds = currentColumns.filter(c => c.locked).map(c => c.id)
    const newColumns = [
      ...lockedIds.map(id => {
        const existing = currentColumns.find(c => c.id === id)
        return existing || AVAILABLE_COLUMNS.find(c => c.id === id)
      }),
      ...selectedColumns
        .filter(id => !lockedIds.includes(id))
        .map(id => AVAILABLE_COLUMNS.find(c => c.id === id))
        .filter(Boolean)
    ]
    onSave(newColumns)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Customize Columns</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {AVAILABLE_COLUMNS.map(col => {
            const isSelected = selectedColumns.includes(col.id)
            const isLocked = currentColumns.find(c => c.id === col.id)?.locked

            return (
              <label
                key={col.id}
                className={`flex items-center p-2 rounded cursor-pointer ${
                  isSelected ? 'bg-blue-50' : 'bg-gray-50'
                } ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => !isLocked && toggleColumn(col.id)}
                  disabled={isLocked}
                  className="mr-2"
                />
                <span>{col.label}</span>
                {isLocked && <span className="ml-auto text-xs text-gray-500">Locked</span>}
              </label>
            )
          })}
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

