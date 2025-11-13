export async function fetchInsiderForTicker(ticker) {
  const res = await fetch(`/.netlify/functions/fetch_insider?ticker=${encodeURIComponent(ticker)}`)
  const json = await res.json()

  if (!res.ok) {
    console.error('fetch_insider error:', json)
    throw new Error(json.error || 'Failed to fetch insider data')
  }

  return json
}

