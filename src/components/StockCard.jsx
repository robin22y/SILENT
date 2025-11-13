import { StageIndicator } from './StageIndicator'
import { Link } from 'react-router-dom'

export function StockCard({ stock }) {
  const formatMarketCap = (cap) => {
    if (!cap) return "-";

    if (cap >= 1e12) return `${(cap / 1e12).toFixed(1)}T`;
    if (cap >= 1e9)  return `${(cap / 1e9).toFixed(1)}B`;
    if (cap >= 1e6)  return `${(cap / 1e6).toFixed(1)}M`;

    return cap.toString();
  };

  const curr = stock.institutional_ownership_pct ?? null
  const prev = stock.institutional_ownership_prev_pct ?? null
  const change = curr !== null && prev !== null ? curr - prev : null
  const changeString = change !== null ? change.toFixed(1) : null
  const changeColor =
    change !== null ? (change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-600') : 'text-gray-400'

  const profitMarginPct =
    typeof stock.profit_margin === 'number' ? (stock.profit_margin * 100).toFixed(1) : null
  const psRatio =
    typeof stock.price_to_sales === 'number' ? stock.price_to_sales.toFixed(1) : null

  return (
    <Link to={`/stock/${stock.ticker}`} className="block">
      <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 border border-gray-200">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900">{stock.ticker}</h3>
            <p className="text-sm text-gray-600 truncate max-w-xs">{stock.name}</p>
          </div>
          <StageIndicator stage={stock.stage} />
        </div>

        {/* Basic Info */}
        <div className="text-sm text-gray-600 mb-4">
          {stock.sector || 'Unknown'} / {stock.industry || 'Unknown'} / {formatMarketCap(stock.market_cap)}
        </div>

        {/* Key Metrics */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Sales (TTM):</span>
            <span className="font-medium">{formatMarketCap(stock.sales_ttm)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Profit Margin:</span>
            <span className="font-medium">
              {profitMarginPct !== null ? `${profitMarginPct}%` : '-'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Price/Sales:</span>
            <span className="font-medium">
              {psRatio !== null ? `${psRatio}x` : '-'}
            </span>
          </div>
        </div>

        {/* Ownership Change */}
        {curr !== null && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Institutions:</span>
              <div className="text-sm">
                <span className="font-medium">
                  {curr.toFixed(1)}%
                </span>
                {changeString !== null && (
                  <span className={`ml-2 ${changeColor} font-semibold`}>
                    {change > 0 ? '+' : ''}{changeString}%
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Verdict */}
        {stock.verdict === 'accumulating' && stock.stage === 2 && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-md p-3">
            <p className="text-sm text-green-800 font-medium">
              🐋 Accumulating - Stage 2 + Insider activity
            </p>
          </div>
        )}

        {stock.verdict === 'distributing' && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-sm text-red-800 font-medium">
              ⚠️ Distributing - Insider selling
            </p>
          </div>
        )}
      </div>
    </Link>
  )
}
