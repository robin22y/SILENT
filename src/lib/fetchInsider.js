export async function fetchInsiderForTicker(ticker) {
  // In development, Netlify functions aren't available - skip silently
  const isDev = import.meta.env.DEV || window.location.hostname === 'localhost'
  
  if (isDev) {
    console.log('Skipping Netlify function call in development mode')
    return { message: 'Development mode - function not available', inserted: 0 }
  }

  try {
    const res = await fetch(`/.netlify/functions/fetch_insider?ticker=${encodeURIComponent(ticker)}`)
    
    // Clone response so we can read it multiple times if needed
    const clonedRes = res.clone()
    
    // Check content type before parsing
    const contentType = res.headers.get('content-type') || ''
    
    if (!contentType.includes('application/json')) {
      // If not JSON, read as text to see what we got
      const text = await clonedRes.text()
      console.error('fetch_insider returned non-JSON:', text.substring(0, 200))
      throw new Error(`Netlify function returned HTML instead of JSON. Is the function deployed? Status: ${res.status}`)
    }
    
    // Parse JSON
    let json
    try {
      json = await res.json()
    } catch (parseError) {
      // If JSON parsing fails, try to read as text to see what we got
      const text = await clonedRes.text()
      console.error('JSON parse error, response was:', text.substring(0, 200))
      throw new Error('Netlify function returned invalid JSON. The function may not be deployed or is returning an error page.')
    }

    if (!res.ok) {
      console.error('fetch_insider error:', json)
      throw new Error(json.error || `Failed to fetch insider data (${res.status})`)
    }

    return json
  } catch (error) {
    // If it's already our custom error, re-throw it
    if (error.message && (error.message.includes('Netlify function') || error.message.includes('Failed to fetch'))) {
      throw error
    }
    // Otherwise, wrap the parsing error
    if (error instanceof SyntaxError) {
      throw new Error('Netlify function returned invalid JSON. The function may not be deployed or is returning an error page.')
    }
    throw error
  }
}

