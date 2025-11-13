# Netlify Setup Guide

## Environment Variables

Set these in Netlify Dashboard → Site Settings → Environment Variables:

```
SUPABASE_URL=https://gnrysdepucyemrbpfqtc.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
EDGAR_USER_AGENT=SilentWhale/1.0 (contact: your-robin@digiget.uk)
```

**Important:** 
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in frontend code
- Only use it in serverless functions (Netlify Functions)
- The `EDGAR_USER_AGENT` must identify you (name + email) per SEC requirements

## Functions

The `netlify/functions/fetch_insider.js` function requires:
- `@supabase/supabase-js` (already in package.json)
- `xml2js` (already in package.json)

Make sure to run `npm install` before deploying.

## CIK Map Population

Before using the insider fetch function, populate the `cik_map` table:

```bash
cd data_pipeline
python populate_cik_map.py
```

This will:
1. Fetch SEC company_tickers.json
2. Match tickers with your stocks table
3. Insert CIK mappings into cik_map table

