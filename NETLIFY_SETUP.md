# Netlify Setup Guide

## Environment Variables

### Frontend Environment Variables (for Vite build)

Set these in Netlify Dashboard → Site Settings → Environment Variables:

```
VITE_SUPABASE_URL=https://gnrysdepucyemrbpfqtc.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImducnlzZGVwdWN5ZW1yYnBmcXRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwNTQ1NjcsImV4cCI6MjA3ODYzMDU2N30.90CrbyktL2jlPs7PMIwD7HxYwNv2b8DNcoHl-P-HRZk
```

### Backend Environment Variables (for Netlify Functions)

```
SUPABASE_URL=https://gnrysdepucyemrbpfqtc.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
EDGAR_USER_AGENT=SilentWhale/1.0 (contact: your-robin@digiget.uk)
```

**Important:** 
- `VITE_` prefix is required for Vite to include variables in the frontend build
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in frontend code
- Only use it in serverless functions (Netlify Functions)
- The `EDGAR_USER_AGENT` must identify you (name + email) per SEC requirements

## How to Set Environment Variables in Netlify

1. Go to your Netlify dashboard
2. Select your site
3. Go to **Site settings** → **Environment variables**
4. Click **Add a variable**
5. Add each variable with its value
6. Click **Save**
7. **Redeploy** your site (or trigger a new deployment) for changes to take effect

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

