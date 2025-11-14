import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export function AdminQuestionManager() {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    category: '',
    question: '',
    guidance: '',
    data_sources: '',
    is_dynamic: false,
    is_active: true,
    sort_order: 0
  })

  useEffect(() => {
    loadQuestions()
  }, [])

  async function loadQuestions() {
    setLoading(true)
    const { data, error } = await supabase
      .from('dy_questions')
      .select('*')
      .order('sort_order')

    if (error) {
      console.error('Error loading questions:', error)
      alert('Failed to load questions')
    } else {
      setQuestions(data || [])
    }
    setLoading(false)
  }

  async function handleSave() {
    if (!formData.category || !formData.question) {
      alert('Category and Question are required')
      return
    }

    // Parse data_sources if it's a string
    let dataSources = formData.data_sources
    if (typeof dataSources === 'string' && dataSources.trim()) {
      try {
        dataSources = JSON.parse(dataSources)
      } catch {
        // If not valid JSON, treat as single string
        dataSources = [dataSources]
      }
    }

    const payload = {
      ...formData,
      data_sources: Array.isArray(dataSources) ? JSON.stringify(dataSources) : null,
      sort_order: parseInt(formData.sort_order) || 0
    }

    if (editingId) {
      // Update existing
      const { error } = await supabase
        .from('dy_questions')
        .update(payload)
        .eq('id', editingId)

      if (error) {
        console.error('Error updating question:', error)
        alert('Failed to update question')
        return
      }
    } else {
      // Insert new
      const { error } = await supabase
        .from('dy_questions')
        .insert(payload)

      if (error) {
        console.error('Error creating question:', error)
        alert('Failed to create question')
        return
      }
    }

    // Reset form and reload
    setEditingId(null)
    setShowAddForm(false)
    resetForm()
    loadQuestions()
  }

  async function handleDelete(id) {
    if (!confirm('Are you sure you want to delete this question?')) {
      return
    }

    const { error } = await supabase
      .from('dy_questions')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting question:', error)
      alert('Failed to delete question')
      return
    }

    loadQuestions()
  }

  function handleEdit(question) {
    setEditingId(question.id)
    setShowAddForm(true)
    setFormData({
      category: question.category || '',
      question: question.question || '',
      guidance: question.guidance || '',
      data_sources: typeof question.data_sources === 'string' 
        ? question.data_sources 
        : JSON.stringify(question.data_sources || []),
      is_dynamic: question.is_dynamic || false,
      is_active: question.is_active !== false,
      sort_order: question.sort_order || 0
    })
  }

  function resetForm() {
    setFormData({
      category: '',
      question: '',
      guidance: '',
      data_sources: '',
      is_dynamic: false,
      is_active: true,
      sort_order: 0
    })
  }

  function handleCancel() {
    setEditingId(null)
    setShowAddForm(false)
    resetForm()
  }

  // Group questions by category
  const groupedQuestions = questions.reduce((acc, q) => {
    if (!acc[q.category]) acc[q.category] = []
    acc[q.category].push(q)
    return acc
  }, {})

  if (loading) {
    return <div className="text-center py-8 text-gray-600">Loading questions...</div>
  }

  return (
    <div className="space-y-6">
      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">
            {editingId ? 'Edit Question' : 'Add New Question'}
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category *
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="e.g., Business Understanding"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Question *
              </label>
              <textarea
                value={formData.question}
                onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Enter the question text"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Guidance
              </label>
              <textarea
                value={formData.guidance}
                onChange={(e) => setFormData({ ...formData, guidance: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Helpful guidance text"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data Sources (JSON array)
              </label>
              <textarea
                value={formData.data_sources}
                onChange={(e) => setFormData({ ...formData, data_sources: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm"
                placeholder='["https://simplywall.st/stocks/us/{TICKER}", "https://finance.yahoo.com/quote/{TICKER}"]'
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter as JSON array, e.g., ["url1", "url2"]
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sort Order
                </label>
                <input
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_dynamic}
                    onChange={(e) => setFormData({ ...formData, is_dynamic: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <span className="text-sm text-gray-700">Is Dynamic</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <span className="text-sm text-gray-700">Is Active</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                {editingId ? 'Update' : 'Create'}
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Questions List */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">All Questions ({questions.length})</h2>
          {!showAddForm && (
            <button
              onClick={() => {
                resetForm()
                setShowAddForm(true)
              }}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              + Add Question
            </button>
          )}
        </div>

        <div className="space-y-6">
          {Object.entries(groupedQuestions).map(([category, categoryQuestions]) => (
            <div key={category}>
              <h3 className="text-lg font-semibold mb-3 text-gray-800 border-b pb-2">
                {category} ({categoryQuestions.length})
              </h3>

              <div className="space-y-3">
                {categoryQuestions.map((q) => (
                  <div
                    key={q.id}
                    className={`p-4 border rounded-lg ${
                      q.is_active ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-300 opacity-60'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900">{q.question}</span>
                          {!q.is_active && (
                            <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded">
                              Inactive
                            </span>
                          )}
                          {q.is_dynamic && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                              Dynamic
                            </span>
                          )}
                          <span className="text-xs text-gray-500">Order: {q.sort_order}</span>
                        </div>
                        {q.guidance && (
                          <p className="text-sm text-gray-600 mb-2">💡 {q.guidance}</p>
                        )}
                        {q.data_sources && (
                          <p className="text-xs text-gray-500">
                            📚 Sources: {typeof q.data_sources === 'string' 
                              ? q.data_sources 
                              : JSON.stringify(q.data_sources)}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => handleEdit(q)}
                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(q.id)}
                          className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

