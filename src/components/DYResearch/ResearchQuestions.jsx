import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export function ResearchQuestions({ ticker, userId, stock }) {
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadQuestionsAndAnswers()
  }, [ticker, userId])

  async function loadQuestionsAndAnswers() {
    setLoading(true)

    // Load all active questions
    const { data: questionsData } = await supabase
      .from('dy_questions')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')

    if (!questionsData) {
      setLoading(false)
      return
    }

    // Filter dynamic questions based on stock conditions
    const filteredQuestions = questionsData.filter(q => {
      if (!q.is_dynamic) return true

      // Dynamic question logic
      if (q.question.includes('Relative strength')) {
        return stock?.relative_strength_6mo !== null
      }
      if (q.question.includes('catalysts coming')) {
        // Show if earnings within 30 days (implement your logic)
        return true
      }

      return true // Default: show all dynamic questions
    })

    setQuestions(filteredQuestions)

    // Load existing answers
    if (userId) {
      const { data: answersData } = await supabase
        .from('dy_answers')
        .select('*')
        .eq('user_id', userId)
        .eq('ticker', ticker)

      if (answersData) {
        const answersMap = {}
        answersData.forEach(a => {
          answersMap[a.question_id] = {
            text: a.answer_text || '',
            completed: a.completed || false
          }
        })
        setAnswers(answersMap)
      }
    }

    setLoading(false)
  }

  async function saveAnswer(questionId, text, completed) {
    if (!userId) return

    // Update local state immediately
    setAnswers(prev => ({
      ...prev,
      [questionId]: { text, completed }
    }))

    // Save to Supabase
    await supabase
      .from('dy_answers')
      .upsert({
        user_id: userId,
        ticker,
        question_id: questionId,
        answer_text: text,
        completed,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,ticker,question_id'
      })
  }

  function parseDataSources(dataSourcesStr) {
    if (!dataSourcesStr) return []
    try {
      return JSON.parse(dataSourcesStr)
    } catch {
      return []
    }
  }

  function formatDataSources(sources, ticker) {
    if (!sources || sources.length === 0) return null
    
    return sources.map((source, idx) => {
      let url = source.replace(/{TICKER}/g, ticker).replace(/{CIK}/g, '')
      // If it's not a URL, don't make it a link
      if (!url.startsWith('http')) {
        return (
          <span key={idx} className="text-xs text-gray-600">
            {source}
          </span>
        )
      }
      
      const displayName = source.includes('simplywall') ? 'Simply Wall St' :
           source.includes('yahoo') ? 'Yahoo Finance' :
           source.includes('stockanalysis') ? 'StockAnalysis' :
           source.includes('finviz') ? 'Finviz' :
           source.includes('tradingview') ? 'TradingView' :
           source.includes('sec.gov') ? 'SEC EDGAR' :
           source.includes('openinsider') ? 'OpenInsider' :
           source.includes('This app') ? 'This app' :
           source
      
      return (
        <a
          key={idx}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline text-xs"
        >
          {displayName}
        </a>
      )
    })
  }

  // Group questions by category
  const groupedQuestions = questions.reduce((acc, q) => {
    if (!acc[q.category]) acc[q.category] = []
    acc[q.category].push(q)
    return acc
  }, {})

  if (!userId) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <p className="text-gray-600">Sign in to use D.Y. Research</p>
      </div>
    )
  }

  if (loading) {
    return <div className="text-center py-8 text-gray-600">Loading questions...</div>
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">D.Y. Research (Optional)</h2>
          <p className="text-sm text-gray-600 mt-1">
            Do Your own research before investing. All questions optional.
          </p>
        </div>
      </div>

      <div className="space-y-8">
        {Object.entries(groupedQuestions).map(([category, categoryQuestions]) => (
          <div key={category}>
            <h3 className="text-lg font-semibold mb-4 text-gray-800 border-b pb-2">
              {category}
            </h3>

            <div className="space-y-6">
              {categoryQuestions.map(question => {
                const answer = answers[question.id] || { text: '', completed: false }
                const dataSources = parseDataSources(question.data_sources)

                return (
                  <div key={question.id} className="space-y-2">
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={answer.completed}
                        onChange={(e) => saveAnswer(question.id, answer.text, e.target.checked)}
                        className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <div className="flex-1">
                        <label className="font-medium text-gray-900">
                          {question.question}
                        </label>
                        {question.guidance && (
                          <p className="text-xs text-gray-500 mt-1">
                            💡 {question.guidance}
                          </p>
                        )}
                        {dataSources && dataSources.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2 items-center">
                            <span className="text-xs text-gray-500">📚 Sources:</span>
                            {formatDataSources(dataSources, ticker)}
                          </div>
                        )}
                      </div>
                    </div>

                    <textarea
                      value={answer.text}
                      onChange={(e) => saveAnswer(question.id, e.target.value, answer.completed)}
                      onBlur={() => saveAnswer(question.id, answer.text, answer.completed)}
                      placeholder="Your answer..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

