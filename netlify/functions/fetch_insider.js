import { createClient } from '@supabase/supabase-js'
import { Parser } from 'xml2js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const EDGAR_USER_AGENT = process.env.EDGAR_USER_AGENT || 'yourname your-email@example.com'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
const xmlParser = new Parser({ explicitArray: false, mergeAttrs: true })

export const handler = async (event) => {
  try {
    const ticker = (event.queryStringParameters?.ticker || '').toUpperCase().trim()
    if (!ticker) return json(400, { error: 'ticker is required' })

    // 1) CIK lookup
    const { data: cikRow, error: cikError } = await supabase
      .from('cik_map')
      .select('cik')
      .eq('ticker', ticker)
      .maybeSingle()

    if (cikError) {
      console.error('CIK lookup error', cikError)
      return json(500, { error: 'CIK lookup failed' })
    }
    if (!cikRow) return json(404, { error: `No CIK for ${ticker}` })

    const cikRaw = cikRow.cik.toString()
    const cikPadded = cikRaw.padStart(10, '0')
    const cikNoZeros = cikRaw.replace(/^0+/, '')

    // 2) Company submissions JSON
    const submissionsUrl = `https://data.sec.gov/submissions/CIK${cikPadded}.json`
    const subRes = await fetch(submissionsUrl, {
      headers: {
        'User-Agent': EDGAR_USER_AGENT,
        'Accept': 'application/json'
      }
    })
    if (!subRes.ok) {
      console.error('EDGAR submissions error', subRes.status)
      return json(502, { error: 'EDGAR submissions fetch failed' })
    }

    const subs = await subRes.json()
    const recent = subs.recent || {}
    const forms = recent.form || []
    const filingDates = recent.filingDate || []
    const accessions = recent.accessionNumber || []
    const primaryDocs = recent.primaryDocument || []

    // 3) Form 4 indices
    const form4Indices = forms
      .map((f, i) => ({ f, i }))
      .filter(({ f }) => f === '4')
      .map(({ i }) => i)

    if (form4Indices.length === 0) {
      return json(200, {
        ticker,
        message: 'No recent Form 4 filings',
        inserted: 0,
        updated_summary: false
      })
    }

    const MAX_FILINGS = 10
    const indicesToProcess = form4Indices.slice(0, MAX_FILINGS)
    let insertedCount = 0

    for (const idx of indicesToProcess) {
      const accession = accessions[idx]             // e.g. 0000320193-24-000123
      const filingDate = filingDates[idx]
      const primary = primaryDocs[idx] || 'form4.xml'
      const accessNoHyphen = accession.replace(/-/g, '')

      const xmlUrl = `https://www.sec.gov/Archives/edgar/data/${cikNoZeros}/${accessNoHyphen}/${primary}`

      const xmlRes = await fetch(xmlUrl, {
        headers: {
          'User-Agent': EDGAR_USER_AGENT,
          'Accept': 'application/xml,text/xml'
        }
      })
      if (!xmlRes.ok) {
        console.warn('XML fetch failed', ticker, xmlUrl, xmlRes.status)
        continue
      }

      const xmlText = await xmlRes.text()
      let parsed
      try {
        parsed = await xmlParser.parseStringPromise(xmlText)
      } catch (e) {
        console.warn('XML parse error', ticker, e.message)
        continue
      }

      const doc = parsed.ownershipDocument
      if (!doc) continue

      const owner = doc.reportingOwner || {}
      const ownerId = owner.reportingOwnerId || {}
      const ownerRel = owner.reportingOwnerRelationship || {}
      const insiderName = ownerId.rptOwnerName || null
      const insiderTitle = ownerRel.rptOwnerTitle || null

      const nonDeriv = doc.nonDerivativeTable?.nonDerivativeTransaction
      let txs = []
      if (Array.isArray(nonDeriv)) txs = nonDeriv
      else if (nonDeriv) txs = [nonDeriv]

      for (const tx of txs) {
        try {
          const code = tx.transactionCoding?.transactionCode
          const dateValue = tx.transactionDate?.value || filingDate
          const sharesValue = tx.transactionAmounts?.transactionShares?.value
          const priceValue = tx.transactionAmounts?.transactionPricePerShare?.value

          if (!code || !sharesValue) continue

          let transaction_type = null
          if (code === 'P') transaction_type = 'buy'
          else if (code === 'S') transaction_type = 'sell'
          else continue // ignore other codes for now

          const shares = Number(sharesValue)
          const price = priceValue ? Number(priceValue) : null
          const total_value = price ? shares * price : null

          const { error: upsertError } = await supabase
            .from('insider_transactions')
            .upsert({
              ticker,
              insider_name: insiderName,
              insider_title: insiderTitle,
              transaction_date: dateValue,
              transaction_type,
              shares,
              price_per_share: price,
              total_value,
              filing_date: filingDate
            }, {
              onConflict: 'ticker,insider_name,transaction_date,transaction_type,shares'
            })

          if (upsertError) {
            console.warn('insider_transactions upsert error', upsertError)
            continue
          }

          insertedCount++
        } catch (err) {
          console.warn('single tx error', err)
          continue
        }
      }
    }

    // 4) Recompute summary for this ticker (90 days)
    const now = new Date()
    now.setDate(now.getDate() - 90)
    const fromDate = now.toISOString().slice(0, 10)

    const { data: txAgg, error: aggError } = await supabase
      .from('insider_transactions')
      .select('transaction_type, total_value')
      .eq('ticker', ticker)
      .gte('transaction_date', fromDate)

    if (aggError) {
      console.error('Aggregation error', aggError)
      return json(500, { error: 'Failed to aggregate insider activity' })
    }

    let buys_90d = 0
    let sells_90d = 0
    let total_bought_value_90d = 0
    let total_sold_value_90d = 0

    for (const row of txAgg || []) {
      if (row.transaction_type === 'buy') {
        buys_90d++
        if (row.total_value) total_bought_value_90d += Number(row.total_value)
      } else if (row.transaction_type === 'sell') {
        sells_90d++
        if (row.total_value) total_sold_value_90d += Number(row.total_value)
      }
    }

    const net_activity_90d = total_bought_value_90d - total_sold_value_90d

    let verdict = 'neutral'
    if (buys_90d > 0 || sells_90d > 0) {
      if (net_activity_90d > 0) verdict = 'accumulating'
      else if (net_activity_90d < 0) verdict = 'distributing'
    }

    const { error: summaryError } = await supabase
      .from('insider_summary')
      .upsert({
        ticker,
        buys_90d,
        sells_90d,
        total_bought_value_90d,
        total_sold_value_90d,
        net_activity_90d,
        verdict,
        updated_at: new Date().toISOString()
      })

    if (summaryError) {
      console.error('Summary upsert error', summaryError)
      return json(500, { error: 'Failed to update insider_summary' })
    }

    return json(200, {
      ticker,
      inserted: insertedCount,
      buys_90d,
      sells_90d,
      total_bought_value_90d,
      total_sold_value_90d,
      net_activity_90d,
      verdict
    })

  } catch (err) {
    console.error('Unexpected error', err)
    return json(500, { error: 'Unexpected server error' })
  }
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(body)
  }
}
