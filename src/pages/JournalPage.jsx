import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchJournalEntries, createJournalEntry } from '../lib/journal'

export function JournalPage() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    ticker: '',
    direction: 'long',
    entry_price: '',
    exit_price: '',
    position_size: '',
    reason: '',
    emotion: '',
    notes: '',
  })
  const [error, setError] = useState(null)

  useEffect(() => {
    loadEntries()
  }, [])

  async function loadEntries() {
    setLoading(true)
    const data = await fetchJournalEntries()
    setEntries(data)
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    const { ok, error: err } = await createJournalEntry({
      ticker: form.ticker,
      direction: form.direction,
      entry_price: form.entry_price ? Number(form.entry_price) : null,
      exit_price: form.exit_price ? Number(form.exit_price) : null,
      position_size: form.position_size ? Number(form.position_size) : null,
      reason: form.reason,
      emotion: form.emotion,
      notes: form.notes,
    })

    if (!ok) {
      setError(err || 'Failed to save')
      return
    }

    // reset + reload
    setShowForm(false)
    setForm({
      ticker: '',
      direction: 'long',
      entry_price: '',
      exit_price: '',
      position_size: '',
      reason: '',
      emotion: '',
      notes: '',
    })
    await loadEntries()
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-gray-600 hover:text-gray-900 text-sm">
            ← Back to Stocks
          </Link>
          <h1 className="text-xl font-bold">Trading Journal</h1>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + New Entry
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4"
        >
          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-semibold text-gray-600">Ticker</label>
              <input
                className="mt-1 w-full rounded border px-2 py-1 text-sm"
                value={form.ticker}
                onChange={(e) => setForm((f) => ({ ...f, ticker: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Direction</label>
              <select
                className="mt-1 w-full rounded border px-2 py-1 text-sm"
                value={form.direction}
                onChange={(e) =>
                  setForm((f) => ({ ...f, direction: e.target.value }))
                }
              >
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600">Entry</label>
              <input
                type="number"
                step="0.01"
                className="mt-1 w-full rounded border px-2 py-1 text-sm"
                value={form.entry_price}
                onChange={(e) => setForm((f) => ({ ...f, entry_price: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Exit</label>
              <input
                type="number"
                step="0.01"
                className="mt-1 w-full rounded border px-2 py-1 text-sm"
                value={form.exit_price}
                onChange={(e) => setForm((f) => ({ ...f, exit_price: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Size</label>
              <input
                type="number"
                step="0.01"
                className="mt-1 w-full rounded border px-2 py-1 text-sm"
                value={form.position_size}
                onChange={(e) =>
                  setForm((f) => ({ ...f, position_size: e.target.value }))
                }
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">Reason</label>
            <textarea
              className="mt-1 w-full rounded border px-2 py-1 text-sm"
              rows={2}
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">Emotion</label>
            <textarea
              className="mt-1 w-full rounded border px-2 py-1 text-sm"
              rows={2}
              value={form.emotion}
              onChange={(e) => setForm((f) => ({ ...f, emotion: e.target.value }))}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">Notes</label>
            <textarea
              className="mt-1 w-full rounded border px-2 py-1 text-sm"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg px-3 py-1 text-sm text-gray-600 hover:bg-gray-100"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Save
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading entries…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-gray-500">
          No journal entries yet. Start logging your trades.
        </p>
      ) : (
        <div className="space-y-3">
          {entries.map((e) => (
            <div
              key={e.id}
              className="rounded-xl border border-gray-200 bg-white p-3 text-sm"
            >
              <div className="flex justify-between">
                <div className="font-semibold">
                  {e.ticker} · {e.direction?.toUpperCase() || 'N/A'}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(e.created_at).toLocaleDateString()}
                </div>
              </div>
              <div className="mt-1 flex gap-4 text-xs text-gray-700">
                {e.entry_price && <span>Entry: ${e.entry_price}</span>}
                {e.exit_price && <span>Exit: ${e.exit_price}</span>}
                {e.position_size && <span>Size: {e.position_size}</span>}
              </div>
              {e.reason && (
                <div className="mt-1 text-xs text-gray-700">
                  <span className="font-semibold">Reason: </span>
                  {e.reason}
                </div>
              )}
              {e.emotion && (
                <div className="mt-1 text-xs text-gray-700">
                  <span className="font-semibold">Emotion: </span>
                  {e.emotion}
                </div>
              )}
              {e.notes && (
                <div className="mt-1 text-xs text-gray-700">
                  <span className="font-semibold">Notes: </span>
                  {e.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

