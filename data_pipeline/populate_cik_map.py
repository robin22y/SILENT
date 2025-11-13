"""
Populate cik_map table from SEC company_tickers.json
Only inserts tickers that exist in the stocks table
"""

import requests
import json
import os
from supabase import create_client
from dotenv import load_dotenv

# Load .env from the data_pipeline directory
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '.env'))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment.")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# SEC company_tickers.json URL
SEC_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"

def main():
    print("Fetching SEC company_tickers.json...")
    
    # Fetch the JSON file
    headers = {
        "User-Agent": "SilentWhale/1.0 (contact: your-robin@digiget.uk)"
    }
    
    try:
        response = requests.get(SEC_TICKERS_URL, headers=headers, timeout=30)
        response.raise_for_status()
        data = response.json()
    except Exception as e:
        print(f"Error fetching SEC data: {e}")
        return
    
    print(f"Fetched {len(data)} companies from SEC")
    
    # Get list of tickers from stocks table
    print("Fetching tracked tickers from stocks table...")
    stocks_result = supabase.table("stocks").select("ticker").execute()
    tracked_tickers = set([s["ticker"] for s in stocks_result.data] if stocks_result.data else [])
    
    print(f"Found {len(tracked_tickers)} tracked tickers")
    
    # Build ticker -> CIK mapping
    ticker_cik_map = {}
    
    # SEC JSON format: {"0": {"cik_str": 320193, "ticker": "AAPL", "title": "APPLE INC"}, ...}
    for entry in data.values():
        ticker = entry.get("ticker", "").upper().strip()
        cik = entry.get("cik_str")
        
        if ticker and cik and ticker in tracked_tickers:
            # CIK should be zero-padded to 10 digits as string
            cik_str = str(cik).zfill(10)
            ticker_cik_map[ticker] = cik_str
    
    print(f"Found {len(ticker_cik_map)} matching tickers with CIKs")
    
    # Insert into cik_map table
    inserted = 0
    updated = 0
    
    for ticker, cik in ticker_cik_map.items():
        try:
            result = supabase.table("cik_map").upsert({
                "ticker": ticker,
                "cik": cik
            }, on_conflict="ticker").execute()
            
            if result.data:
                inserted += 1
        except Exception as e:
            print(f"Error upserting {ticker}: {e}")
    
    print(f"\n✅ Inserted/updated {inserted} CIK mappings")
    print(f"Total tickers in cik_map: {len(ticker_cik_map)}")

if __name__ == "__main__":
    main()

