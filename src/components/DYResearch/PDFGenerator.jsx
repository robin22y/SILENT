import { supabase } from '../../lib/supabase'
import jsPDF from 'jspdf'

export function PDFGenerator({ ticker, userId, userName, stock }) {
  function formatMarketCap(cap) {
    if (!cap) return "-"
    if (cap >= 1e12) return `${(cap / 1e12).toFixed(1)}T`
    if (cap >= 1e9) return `${(cap / 1e9).toFixed(1)}B`
    if (cap >= 1e6) return `${(cap / 1e6).toFixed(1)}M`
    return cap.toString()
  }

  function getStageLabel(stage) {
    const stages = {
      1: '🟡 Stage 1: Basing',
      2: '🟢 Stage 2: Advancing',
      3: '🟠 Stage 3: Topping',
      4: '🔴 Stage 4: Declining'
    }
    return stages[stage] || `Stage ${stage}`
  }

  async function generatePDF() {
    if (!userId) {
      alert('Please sign in to generate report')
      return
    }

    // Fetch all data
    const [decisionsRes, answersRes, questionsRes, metaRes, stockRes, insiderRes] = await Promise.all([
      supabase.from('dy_decisions').select('*').eq('user_id', userId).eq('ticker', ticker).maybeSingle(),
      supabase.from('dy_answers').select('*').eq('user_id', userId).eq('ticker', ticker),
      supabase.from('dy_questions').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('dy_meta').select('*').eq('user_id', userId).eq('ticker', ticker).maybeSingle(),
      supabase.from('stocks').select('*, insider_summary(*)').eq('ticker', ticker).maybeSingle(),
      supabase.from('insider_transactions').select('*').eq('ticker', ticker).gte('transaction_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]).order('transaction_date', { ascending: false })
    ])

    const decision = decisionsRes.data?.decision || 'NOT SET'
    const answers = answersRes.data || []
    const questions = questionsRes.data || []
    const chartLink = metaRes.data?.chart_link || ''
    const stockData = stockRes.data || stock
    const insiderSummary = stockData?.insider_summary?.[0] || null
    const insiderTransactions = insiderRes.data || []

    // Create answers map
    const answersMap = {}
    answers.forEach(a => {
      answersMap[a.question_id] = a.answer_text || ''
    })

    // Group questions by category
    const groupedQuestions = questions.reduce((acc, q) => {
      if (!acc[q.category]) acc[q.category] = []
      acc[q.category].push(q)
      return acc
    }, {})

    // Generate PDF
    const pdf = new jsPDF()
    const pageWidth = pdf.internal.pageSize.getWidth()
    const margin = 20
    const maxWidth = pageWidth - (margin * 2)
    let yPos = margin

    // Helper to add text with auto-wrapping
    function addText(text, fontSize = 11, isBold = false) {
      pdf.setFontSize(fontSize)
      pdf.setFont('helvetica', isBold ? 'bold' : 'normal')

      const lines = pdf.splitTextToSize(text, maxWidth)
      lines.forEach(line => {
        if (yPos > 270) {
          pdf.addPage()
          yPos = margin
        }
        pdf.text(line, margin, yPos)
        yPos += fontSize * 0.5
      })
      yPos += 3
    }

    // Title
    addText('Silent Whale – D.Y. Research Report', 18, true)
    yPos += 5

    // Stock Information Section
    if (stockData) {
      addText('STOCK INFORMATION', 14, true)
      yPos += 3
      
      addText(`${stockData.name || ticker}`, 12, true)
      if (stockData.sector && stockData.industry) {
        addText(`${stockData.sector} / ${stockData.industry}`, 10)
      }
      yPos += 3

      // Key Metrics in two columns
      const leftCol = []
      const rightCol = []
      
      if (stockData.stage) {
        leftCol.push(`Stage: ${getStageLabel(stockData.stage)}`)
      }
      if (stockData.market_cap) {
        leftCol.push(`Market Cap: ${formatMarketCap(stockData.market_cap)}`)
      }
      if (stockData.price) {
        leftCol.push(`Price: $${stockData.price.toFixed(2)}`)
      }
      if (stockData.profit_margin != null) {
        leftCol.push(`Profit Margin: ${(stockData.profit_margin * 100).toFixed(1)}%`)
      }
      
      if (stockData.price_to_sales != null) {
        rightCol.push(`Price/Sales: ${stockData.price_to_sales.toFixed(1)}x`)
      }
      if (stockData.ma_30_week) {
        rightCol.push(`30-week MA: $${stockData.ma_30_week.toFixed(2)}`)
      }
      if (stockData.updated_at) {
        rightCol.push(`Updated: ${new Date(stockData.updated_at).toLocaleString()}`)
      }

      // Print metrics in two columns
      const maxRows = Math.max(leftCol.length, rightCol.length)
      for (let i = 0; i < maxRows; i++) {
        const left = leftCol[i] || ''
        const right = rightCol[i] || ''
        const combined = left && right ? `${left.padEnd(35)}${right}` : left || right
        if (combined.trim()) {
          addText(combined, 10)
        }
      }
      
      yPos += 5

      // Insider Activity Summary
      if (insiderSummary) {
        addText('INSIDER ACTIVITY (90 days)', 12, true)
        yPos += 2
        addText(`Buys: ${insiderSummary.buys_90d || 0} | Sells: ${insiderSummary.sells_90d || 0}`, 10)
        if (insiderSummary.net_activity_90d != null) {
          addText(`Net Activity: ${insiderSummary.net_activity_90d > 0 ? '+' : ''}${insiderSummary.net_activity_90d.toLocaleString()}`, 10)
        }
        if (insiderSummary.verdict) {
          addText(`Verdict: ${insiderSummary.verdict.toUpperCase()}`, 10, true)
        }
        yPos += 5
      } else if (insiderTransactions.length === 0) {
        addText('INSIDER ACTIVITY: No transactions in last 90 days', 10)
        yPos += 5
      }
    }

    yPos += 5
    addText('─'.repeat(50), 10)
    yPos += 5

    // User Decision
    addText('INVESTMENT DECISION', 14, true)
    yPos += 3
    addText(`Decision: ${decision}`, 12, true)
    addText(`Analyst: ${userName}`)
    addText(`Date: ${new Date().toLocaleDateString()}`)
    if (chartLink) {
      addText(`Chart Link: ${chartLink}`, 9)
    }
    yPos += 5
    addText(`"I, ${userName}, decided to ${decision} ${ticker} based on the following research."`, 11, true)
    yPos += 10

    // Questions & Answers by Category
    Object.entries(groupedQuestions).forEach(([category, categoryQuestions]) => {
      if (yPos > 250) {
        pdf.addPage()
        yPos = margin
      }

      addText(`# ${category}`, 14, true)
      yPos += 3

      categoryQuestions.forEach(q => {
        const answer = answersMap[q.id]
        if (!answer) return // Skip unanswered

        addText(`Q: ${q.question}`, 11, true)
        addText(`A: ${answer}`, 11)
        yPos += 3
      })

      yPos += 5
    })

    // Save PDF
    pdf.save(`${ticker}_DY_Research_${new Date().toISOString().split('T')[0]}.pdf`)
  }

  return (
    <button
      onClick={generatePDF}
      className="w-full bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 font-medium flex items-center justify-center gap-2"
    >
      📄 Generate Research PDF
    </button>
  )
}

