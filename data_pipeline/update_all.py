"""
update_all.py
Combined Daily Updater for SILENT WHALE

Runs:
1. Stock price + fundamentals updater
2. Insider transactions updater
3. Insider summary aggregation

Uses EDGAR on-demand + Yahoo yfinance.

You only need to schedule THIS file in Task Scheduler.
"""

import os
import time
from datetime import datetime, timedelta
from supabase import create_client
from dotenv import load_dotenv
import yfinance as yf
import feedparser
import pandas as pd
import requests

# -----------------------
# ENV + SUPABASE SETUP
# -----------------------

# Load .env from current directory
env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path=env_path)

# Also try loading from current working directory as fallback
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# Debug: Check if env vars are loaded
if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print(f"DEBUG: .env path: {env_path}")
    print(f"DEBUG: File exists: {os.path.exists(env_path)}")
    print(f"DEBUG: SUPABASE_URL: {SUPABASE_URL}")
    print(f"DEBUG: SUPABASE_SERVICE_KEY: {'Set' if SUPABASE_SERVICE_KEY else 'None'}")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment.")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# -----------------------
# HELPER FUNCTIONS
# -----------------------

def log(msg):
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}")

# -----------------------
# STOCK UPDATE LOGIC
# -----------------------

def calculate_stage(hist):
    """Weinstein Stage Calculation"""
    try:
        hist = hist.dropna()

        if len(hist) < 150:
            return None, None

        hist['MA30W'] = hist['Close'].rolling(window=150).mean()
        ma_current = hist['MA30W'].iloc[-1]

        current_price = hist['Close'].iloc[-1]
        prev_ma = hist['MA30W'].iloc[-30]

        slope = (ma_current - prev_ma) / prev_ma if prev_ma else 0

        if current_price > ma_current and slope > 0.02:
            return 2, float(ma_current)
        if current_price < ma_current and slope < -0.02:
            return 4, float(ma_current)
        if current_price > ma_current:
            return 3, float(ma_current)
        return 1, float(ma_current)

    except:
        return None, None


def update_stock(ticker):
    """Update one stock with latest info"""
    try:
        log(f"Updating {ticker}")

        # Fix ticker format for yfinance (BRK.B -> BRK-B)
        yf_ticker = ticker.replace('.', '-')
        stock = yf.Ticker(yf_ticker)
        info = stock.info
        hist = stock.history(period="1y")

        if hist.empty:
            log(f"[WARN] No price history for {ticker}")
            return False

        stage, ma_30w = calculate_stage(hist)

        data = {
            "ticker": ticker,
            "name": info.get("longName", ticker),
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "market_cap": info.get("marketCap", 0),
            "price": float(hist["Close"].iloc[-1]),
            "profit_margin": info.get("profitMargins"),
            "price_to_sales": info.get("priceToSalesTrailing12Months"),
            "sales_ttm": info.get("totalRevenue", 0),
            "stage": stage,
            "ma_30_week": ma_30w,
            "updated_at": datetime.utcnow().isoformat(),
        }

        supabase.table("stocks").upsert(data, on_conflict="ticker").execute()
        return True

    except Exception as e:
        log(f"❌ Stock update error {ticker}: {e}")
        return False


def update_all_stocks():
    """Fetch list from 'tickers' table and update all"""
    log("Fetching active ticker list...")

    resp = supabase.table("tickers").select("ticker").execute()

    tickers = [row["ticker"] for row in resp.data]

    log(f"Total tickers to update: {len(tickers)}")

    success = 0

    for t in tickers:
        if update_stock(t):
            success += 1
        time.sleep(1.2)  # prevent rate limiting

    log(f"STOCK UPDATE DONE: {success}/{len(tickers)} success")


# -----------------------
# INSIDER UPDATE LOGIC
# -----------------------

SEC_RSS_URL = "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=4&owner=only&count=100&output=atom"


def fetch_rss():
    """Fetch RSS with correct SEC headers (important)"""
    headers = {
        "User-Agent": "SilentWhaleApp/1.0 (contact: your-email@example.com)"
    }
    response = requests.get(SEC_RSS_URL, headers=headers)
    return feedparser.parse(response.text)


def update_insiders():
    """Parse RSS & store Form 4 filings"""
    log("Fetching SEC insider filings...")
    feed = fetch_rss()

    if not feed.entries:
        log("⚠️ No new filings in RSS")
        return

    count = 0

    for entry in feed.entries:
        title = entry.get("title", "")
        summary = entry.get("summary", "")

        # Extract ticker
        ticker = title.split("(")[-1].replace(")", "").strip().upper()
        if len(ticker) > 5:
            continue  # skip garbage symbols

        # Check if ticker exists in our DB
        exists = supabase.table("tickers").select("ticker").eq("ticker", ticker).execute()
        if not exists.data:
            continue

        # Determine buy/sell
        transaction_type = "sell" if "sale" in summary.lower() else "buy"

        # Insert
        supabase.table("insider_transactions").insert({
            "ticker": ticker,
            "insider_name": entry.get("author", "Unknown"),
            "transaction_date": datetime.utcnow().date().isoformat(),
            "transaction_type": transaction_type,
            "shares": 0,
            "price_per_share": 0,
            "total_value": 0,
            "filing_date": datetime.utcnow().date().isoformat()
        }).execute()

        count += 1

    log(f"INSIDERS UPDATED: {count} filings stored")


def update_insider_summary():
    """Summarize last 90 days of insider activity"""
    log("Calculating insider summary...")

    # Get all tickers
    resp = supabase.table("tickers").select("ticker").execute()
    tickers = [t["ticker"] for t in resp.data]

    # Calculate 90 days ago
    cutoff_date = (datetime.utcnow() - timedelta(days=90)).date().isoformat()

    for t in tickers:
        tx = supabase.table("insider_transactions") \
            .select("*") \
            .eq("ticker", t) \
            .gte("transaction_date", cutoff_date) \
            .execute()

        buys = sum(1 for x in tx.data if x["transaction_type"] == "buy")
        sells = sum(1 for x in tx.data if x["transaction_type"] == "sell")
        net = buys - sells

        verdict = "accumulating" if net > 0 else "distributing" if net < 0 else "neutral"

        supabase.table("insider_summary").upsert({
            "ticker": t,
            "buys_90d": buys,
            "sells_90d": sells,
            "net_activity_90d": net,
            "verdict": verdict,
            "updated_at": datetime.utcnow().isoformat()
        }, on_conflict="ticker").execute()

    log("INSIDER SUMMARY UPDATED")


# -----------------------
# MAIN EXECUTION
# -----------------------

if __name__ == "__main__":
    log("=== SILENT WHALE DAILY UPDATE START ===")

    update_all_stocks()
    update_insiders()
    update_insider_summary()

    log("=== ALL UPDATES COMPLETE ===")

