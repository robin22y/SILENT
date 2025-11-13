export function StageIndicator({ stage }) {
  const stageConfig = {
    1: { label: 'Stage 1: Basing', color: 'bg-yellow-100 text-yellow-800', emoji: '🟡' },
    2: { label: 'Stage 2: Advancing', color: 'bg-green-100 text-green-800', emoji: '🟢' },
    3: { label: 'Stage 3: Topping', color: 'bg-orange-100 text-orange-800', emoji: '🟠' },
    4: { label: 'Stage 4: Declining', color: 'bg-red-100 text-red-800', emoji: '🔴' }
  }
  
  const config = stageConfig[stage] || stageConfig[1]
  
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
      <span className="mr-1">{config.emoji}</span>
      {config.label}
    </span>
  )
}


