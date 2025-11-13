"""
Daily stock data updater

- Fetches data from Yahoo Finance and updates Supabase 'stocks' table
- Run via cron/Task Scheduler daily at 06:00
"""

import os
from datetime import datetime

import pandas as pd
import yfinance as yf
from dotenv import load_dotenv
from supabase import create_client

# Load .env from current directory
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '.env'))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
  raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment.")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Fetch tickers from Supabase
tickers = supabase.table("tickers").select("ticker").execute().data
TICKERS = [t["ticker"] for t in tickers]



def calculate_stage(hist_data: pd.DataFrame):
    """
    Calculate Weinstein stage from price history.

    Stage 1 = Basing (price below MA, MA flat)
    Stage 2 = Advancing (price above MA, MA rising)
    Stage 3 = Topping (price above MA, MA flat)
    Stage 4 = Declining (price below MA, MA falling)
    """
    if hist_data is None or hist_data.empty:
        return None, None

    # Need >= 150 trading days (~30 weeks)
    if len(hist_data) < 150:
        return None, None

    ma_30w = hist_data["Close"].rolling(window=150).mean()

    if ma_30w.isna().all():
        return None, None

    ma_30w = ma_30w.dropna()
    if len(ma_30w) < 150:
        return None, None

    current_price = hist_data["Close"].iloc[-1]
    ma_current = ma_30w.iloc[-1]

    # Slope over last 30 points vs 30 points before
    try:
        ma_slope = (ma_30w.iloc[-1] - ma_30w.iloc[-30]) / ma_30w.iloc[-30]
    except Exception:
        ma_slope = 0

    # Determine stage
    stage = None
    if current_price > ma_current and ma_slope > 0.02:
        stage = 2  # Advancing
    elif current_price < ma_current and ma_slope < -0.02:
        stage = 4  # Declining
    elif current_price > ma_current:
        stage = 3  # Topping
    else:
        stage = 1  # Basing

    return stage, float(ma_current)





def update_stock(ticker: str) -> bool:
    """Fetch and upsert data for a single stock into Supabase."""
    try:
        print(f"Updating {ticker}...")

        stock = yf.Ticker(ticker)

        # yfinance.info is ugly but good enough for MVP
        info = stock.info
        hist = stock.history(period="1y")

        stage, ma_30w = calculate_stage(hist)

        # Basic financials
        sales_current = info.get("totalRevenue") or 0
        profit_margin = info.get("profitMargins") or 0
        ps_ratio = info.get("priceToSalesTrailing12Months") or 0
        market_cap = info.get("marketCap") or 0

        # Placeholder – proper YoY requires historical fundamentals
        sales_growth = 0

        price = float(hist["Close"].iloc[-1]) if not hist.empty else 0.0

        data = {
            "ticker": ticker,
            "name": info.get("longName") or ticker,
            "sector": info.get("sector") or "Unknown",
            "industry": info.get("industry") or "Unknown",
            "market_cap": market_cap,
            "price": price,
            "sales_ttm": sales_current,
            "sales_growth_yoy": sales_growth,
            "profit_margin": profit_margin,
            "price_to_sales": ps_ratio,
            "stage": stage,
            "ma_30_week": ma_30w,
            "updated_at": datetime.utcnow().isoformat()
        }

        # Upsert by ticker
        # supabase-py v2 supports on_conflict
        res = supabase.table("stocks").upsert(data, on_conflict="ticker").execute()

        if getattr(res, "error", None):
            print(f"✗ Supabase error for {ticker}: {res.error}")
            return False

        print(f"✓ {ticker} updated")
        return True

    except Exception as e:
        print(f"✗ Error updating {ticker}: {e}")
        return False





def main():
    print(f"Starting update at {datetime.utcnow().isoformat()}")

    success_count = 0
    fail_count = 0

    for ticker in TICKERS:
        if update_stock(ticker):
            success_count += 1
        else:
            fail_count += 1

    print(f"\n✅ Update complete: {success_count} success, {fail_count} failed")





if __name__ == "__main__":
    main()

