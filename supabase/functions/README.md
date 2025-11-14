# Supabase Edge Functions

These are Deno-based serverless functions that run on Supabase's edge network.

## Functions

### 1. `fetch_stock_data`
Fetches real-time stock price and volume data from Yahoo Finance with 24-hour caching.

**Endpoint:** `/functions/v1/fetch_stock_data`

**Request:**
```json
{
  "ticker": "AAPL"
}
```

**Response:**
```json
{
  "status": "updated",
  "price": 150.25,
  "volume": 50000000
}
```

### 2. `fetch_insiders`
Fetches insider trading data with Finviz primary source and EDGAR fallback.

**Endpoint:** `/functions/v1/fetch_insiders`

**Request:**
```json
{
  "ticker": "AAPL"
}
```

**Response:**
```json
{
  "status": "ok",
  "source": "edgar",
  "filings": 5,
  "processed": 3
}
```

## Deployment

### Prerequisites
1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link your project:
   ```bash
   supabase link --project-ref your-project-ref
   ```

### Deploy Functions

Deploy all functions:
```bash
supabase functions deploy
```

Deploy specific function:
```bash
supabase functions deploy fetch_stock_data
supabase functions deploy fetch_insiders
```

### Environment Variables

Set in Supabase Dashboard → Project Settings → Edge Functions:

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your service role key (for database access)

These are automatically available to Edge Functions, but you can also set custom ones.

## Frontend Usage

The functions are called from the frontend using the Supabase URL:

```javascript
const response = await fetch(`${SUPABASE_URL}/functions/v1/fetch_stock_data`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
  },
  body: JSON.stringify({ ticker: "AAPL" })
})
```

## Notes

- Edge Functions use Deno runtime (not Node.js)
- Functions have access to `Deno.env` for environment variables
- Use `https://esm.sh/` or `https://deno.land/` for imports
- Functions automatically have access to Supabase client via environment variables

