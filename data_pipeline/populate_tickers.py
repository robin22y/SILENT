"""
Populate the 'tickers' table with the list of stocks to track.
Run this once to set up your tracked tickers.
"""

import os
from dotenv import load_dotenv
from supabase import create_client

# Load .env from current directory
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '.env'))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment.")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# S&P 100 tickers
TICKERS = [
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.B', 'V', 'UNH',
    'JNJ', 'WMT', 'XOM', 'JPM', 'PG', 'MA', 'HD', 'CVX', 'LLY', 'ABBV',
    'MRK', 'KO', 'PEP', 'AVGO', 'COST', 'TMO', 'MCD', 'CSCO', 'ACN', 'ABT',
    'DHR', 'VZ', 'NKE', 'TXN', 'CRM', 'ADBE', 'CMCSA', 'NFLX', 'PM', 'WFC',
    'INTC', 'BMY', 'NEE', 'DIS', 'UPS', 'QCOM', 'T', 'LOW', 'ORCL', 'HON',
    'UNP', 'IBM', 'BA', 'RTX', 'AMD', 'INTU', 'GE', 'CAT', 'AMGN', 'SBUX',
    'PLD', 'GS', 'BLK', 'AXP', 'LMT', 'SPGI', 'DE', 'ELV', 'MDLZ', 'ADP',
    'ADI', 'MMC', 'TJX', 'CI', 'GILD', 'BKNG', 'CVS', 'SYK', 'VRTX', 'ZTS',
    'C', 'BDX', 'SCHW', 'NOC', 'REGN', 'MO', 'CB', 'PGR', 'SO', 'EOG',
    'DUK', 'MMM', 'ITW', 'CME', 'FI', 'USB', 'AON', 'ICE', 'BSX'
]

def main():
    print(f"Populating tickers table with {len(TICKERS)} stocks...")
    
    # First, ensure the tickers table exists (create if not exists)
    # Note: You should run the SQL schema first, but this will handle it gracefully
    
    inserted = 0
    for ticker in TICKERS:
        try:
            result = supabase.table("tickers").upsert({
                "ticker": ticker
            }, on_conflict="ticker").execute()
            
            if result.data:
                inserted += 1
                print(f"✓ {ticker}")
        except Exception as e:
            print(f"✗ Error inserting {ticker}: {e}")
    
    print(f"\n✅ Inserted/updated {inserted} tickers")

if __name__ == "__main__":
    main()

