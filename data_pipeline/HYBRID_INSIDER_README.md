# Hybrid Insider Transaction Updater

## Overview

Fetches insider trading data using a hybrid approach with three data sources:
1. **Yahoo Finance JSON** (primary) - Fast, structured data
2. **Nasdaq HTML** (fallback) - Reliable backup source
3. **OpenInsider HTML** (fallback) - Comprehensive coverage

## Files

- `hybrid_insider_updater.py` - Main script
- `ticker_list.py` - List of tracked tickers (S&P 100)

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Ensure `.env` file has:
```
SUPABASE_URL=your_url
SUPABASE_SERVICE_KEY=your_service_key
```

## Usage

Run manually:
```bash
python hybrid_insider_updater.py
```

## Automation

### Windows Task Scheduler

1. Open Task Scheduler
2. Create Basic Task
3. Set trigger: Daily at 7:00 AM (after stock update)
4. Action: Start a program
5. Program: `python`
6. Arguments: `C:\path\to\silent\data_pipeline\hybrid_insider_updater.py`
7. Start in: `C:\path\to\silent\data_pipeline`

### Linux/Mac Cron

```bash
crontab -e
# Add this line:
0 7 * * * cd /path/to/silent && /usr/bin/python3 data_pipeline/hybrid_insider_updater.py >> /path/to/logs/insider.log 2>&1
```

## How It Works

1. For each ticker in `TRACKED_TICKERS`:
   - Tries Yahoo Finance JSON API
   - If empty, tries Nasdaq HTML scraping
   - If empty, tries OpenInsider HTML scraping
   - Skips if all sources return no data

2. Normalizes transaction data:
   - Transaction type: "P"/"Buy" → "buy", "S"/"Sell" → "sell"
   - Dates: Normalized to YYYY-MM-DD
   - Shares: Parsed as integers

3. Inserts into `insider_transactions` table:
   - Deduplicates using ticker + insider_name + date + shares
   - Uses upsert to avoid duplicates

4. Updates `insider_summary` table:
   - Calculates 90-day aggregates (buys, sells, net)
   - Sets verdict: "accumulating", "distributing", or "neutral"

## Output

The script logs:
- Which source was used for each ticker
- Number of transactions found and inserted
- Summary statistics

Example output:
```
Processing AAPL...
  Trying Yahoo Finance...
  ✓ Yahoo Finance: 5 transactions
  ✓ Inserted 5 transactions

Processing MSFT...
  Trying Yahoo Finance...
  Trying Nasdaq...
  ✓ Nasdaq: 3 transactions
  ✓ Inserted 3 transactions
```

## Notes

- Includes retry logic (3 attempts with exponential backoff)
- Rate limiting: 0.5 second delay between tickers
- Skips tickers with no insider activity
- Handles missing data gracefully

