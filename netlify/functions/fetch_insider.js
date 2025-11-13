// netlify/functions/fetch_insider.js

import { createClient } from '@supabase/supabase-js'
import { Parser } from 'xml2js'

// Environment variables (set in Netlify dashboard)
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const EDGAR_USER_AGENT = process.env.EDGAR_USER_AGENT || 'yourname your-email@example.com'

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase env vars in Netlify')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
const xmlParser = new Parser({ explicitArray: false, mergeAttrs: true })

export const handler = async (event) => {
  try {
    const ticker = (event.queryStringParameters?.ticker || '').toUpperCase().trim()

    if (!ticker) {
      return response(400, { error: 'ticker is required' })
    }

    // 1) Get CIK from cik_map
    const { data: cikRows, error: cikError } = await supabase
      .from('cik_map')
      .select('cik')
      .eq('ticker', ticker)
      .maybeSingle()

    if (cikError) {
      console.error('CIK lookup error:', cikError)
      return response(500, { error: 'CIK lookup failed' })
    }

    if (!cikRows) {
      return response(404, { error: `No CIK found for ticker ${ticker}` })
    }

    const cikRaw = cikRows.cik // e.g. "320193" or "0000320193"
    const cikPadded = cikRaw.toString().padStart(10, '0')
    const cikNoLeadingZeros = cikRaw.toString().replace(/^0+/, '')

    // 2) Fetch EDGAR submissions JSON for the company
    const submissionsUrl = `https://data.sec.gov/submissions/CIK${cikPadded}.json`

    const submissionsRes = await fetch(submissionsUrl, {
      headers: {
        'User-Agent': EDGAR_USER_AGENT,
        'Accept': 'application/json'
      }
    })

    if (!submissionsRes.ok) {
      console.error('EDGAR submissions error:', submissionsRes.status, await submissionsRes.text())
      return response(502, { error: 'EDGAR submissions fetch failed' })
    }

    const submissionsJson = await submissionsRes.json()
    const recent = submissionsJson.recent || {}
    const forms = recent.form || []
    const filingDates = recent.filingDate || []
    const accessions = recent.accessionNumber || []
    const primaryDocs = recent.primaryDocument || []

    // 3) Filter only Form 4 filings (insider transactions)
    const form4Indices = forms
      .map((f, idx) => ({ f, idx }))
      .filter(({ f }) => f === '4')
      .map(({ idx }) => idx)

    if (form4Indices.length === 0) {
      return response(200, {
        ticker,
        message: 'No recent Form 4 filings found',
        inserted: 0,
        updated_summary: false
      })
    }

    // Process only the latest N Form 4s to keep it light
    const MAX_FILINGS = 10
    const indicesToProcess = form4Indices.slice(0, MAX_FILINGS)

    let insertedCount = 0

    for (const i of indicesToProcess) {
      const accession = accessions[i] // e.g. "0000320193-24-000123"
      const primaryDoc = primaryDocs[i] || 'form4.xml'
      const filingDate = filingDates[i]

      const accessionNoHyphens = accession.replace(/-/g, '')
      const xmlUrl = `https://www.sec.gov/Archives/edgar/data/${cikNoLeadingZeros}/${accessionNoHyphens}/${primaryDoc}`

      const xmlRes = await fetch(xmlUrl, {
        headers: {
          'User-Agent': EDGAR_USER_AGENT,
          'Accept': 'application/xml,text/xml'
        }
      })

      if (!xmlRes.ok) {
        console.warn(`Failed to fetch XML for ${ticker} at ${xmlUrl}`, xmlRes.status)
        continue
      }

      const xmlText = await xmlRes.text()
      let xml
      try {
        xml = await xmlParser.parseStringPromise(xmlText)
      } catch (e) {
        console.warn('XML parse error for', ticker, e)
        continue
      }

      const doc = xml.ownershipDocument
      if (!doc) continue

      // Reporting owner
      const reportingOwner = doc.reportingOwner || {}
      const ownerId = reportingOwner.reportingOwnerId || {}
      const ownerRel = reportingOwner.reportingOwnerRelationship || {}

      const insiderName = ownerId.rptOwnerName || null
      const insiderTitle = ownerRel.rptOwnerTitle || null

      // Normalize to array of transactions
      const nonDeriv = doc.nonDerivativeTable?.nonDerivativeTransaction
      let txs = []
      if (Array.isArray(nonDeriv)) {
        txs = nonDeriv
      } else if (nonDeriv) {
        txs = [nonDeriv]
      }

      for (const tx of txs) {
        try {
          const coding = tx.transactionCoding || {}
          const code = coding.transactionCode

          const dateNode = tx.transactionDate || {}
          const txDate = dateNode.value || filingDate

          const amounts = tx.transactionAmounts || {}
          const sharesVal = amounts.transactionShares?.value
          const priceVal = amounts.transactionPricePerShare?.value

          if (!sharesVal || !code) continue

          const shares = Number(sharesVal)
          const price = priceVal ? Number(priceVal) : null
          const totalValue = price ? shares * price : null

          let transactionType = null
          // P = Purchase, S = Sale (for most cases)
          if (code === 'P') transactionType = 'buy'
          else if (code === 'S') transactionType = 'sell'
          else {
            // Ignore non-buy/sell codes for now
            continue
          }

          // Insert / upsert into insider_transactions
          const { error: upsertError } = await supabase
            .from('insider_transactions')
            .upsert({
              ticker,
              insider_name: insiderName,
              insider_title: insiderTitle,
              transaction_date: txDate,
              transaction_type: transactionType,
              shares,
              price_per_share: price,
              total_value: totalValue,
              filing_date: filingDate
            }, {
              onConflict: 'ticker,insider_name,transaction_date,transaction_type,shares'
            })

          if (upsertError) {
            console.warn('Upsert insider_transactions error:', upsertError)
            continue
          }

          insertedCount++
        } catch (innerErr) {
          console.warn('Error processing single transaction:', innerErr)
          continue
        }
      }
    }

    // 4) Refresh insider_summary for this ticker (90-day window)
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    const fromDate = ninetyDaysAgo.toISOString().slice(0, 10) // YYYY-MM-DD

    const { data: txAgg, error: aggError } = await supabase
      .from('insider_transactions')
      .select('transaction_type, total_value')
      .eq('ticker', ticker)
      .gte('transaction_date', fromDate)

    if (aggError) {
      console.error('Aggregation error:', aggError)
      return response(500, { error: 'Failed to aggregate insider activity' })
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
      else verdict = 'neutral'
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
      console.error('Summary upsert error:', summaryError)
      return response(500, { error: 'Failed to update insider_summary' })
    }

    return response(200, {
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
    console.error('Unexpected fetch_insider error:', err)
    return response(500, { error: 'Unexpected server error' })
  }
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(body)
  }
}

