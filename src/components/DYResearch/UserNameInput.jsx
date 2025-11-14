import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export function UserNameInput({ userId, onNameChange }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadUserName()
  }, [userId])

  async function loadUserName() {
    if (!userId) {
      setLoading(false)
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.user_metadata?.display_name) {
        setName(user.user_metadata.display_name)
      } else if (user?.email) {
        // Fallback to email username
        setName(user.email.split('@')[0])
      }
    } catch (error) {
      console.error('Error loading user name:', error)
    } finally {
      setLoading(false)
    }
  }

  async function saveUserName() {
    if (!userId || !name.trim()) return

    setSaving(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { error } = await supabase.auth.updateUser({
        data: {
          display_name: name.trim()
        }
      })

      if (error) throw error

      if (onNameChange) {
        onNameChange(name.trim())
      }
    } catch (error) {
      console.error('Error saving user name:', error)
      alert('Failed to save name. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-2">Your Name</h3>
      <p className="text-sm text-gray-600 mb-3">
        This name will appear in your research PDF reports
      </p>
      
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveUserName}
          placeholder="Enter your name"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          onClick={saveUserName}
          disabled={saving || !name.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
      
      {saving && <p className="mt-2 text-xs text-gray-500">Saving...</p>}
    </div>
  )
}

