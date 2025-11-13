"""
Supabase client and helper functions for insider transactions.
"""

import os
from supabase import create_client
from dotenv import load_dotenv
from datetime import datetime, timedelta

load_dotenv()

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_KEY")
)


def save_trades(trades: list[dict]):
    """Upsert trades into insider_transactions table."""
    if not trades:
        return
    
    for trade in trades:
        try:
            supabase.table("insider_transactions").upsert(
                trade,
                on_conflict="ticker,insider_name,transaction_date,transaction_type,shares"
            ).execute()
        except Exception as e:
            print(f"[WARN] Failed to save trade {trade.get('ticker', '?')}: {e}")


def update_summary(ticker: str, days: int = 90):
    """Update insider_summary table for a specific ticker."""
    cutoff = (datetime.utcnow().date() - timedelta(days=days)).isoformat()
    
    try:
        res = supabase.table("insider_transactions") \
            .select("*") \
            .eq("ticker", ticker) \
            .gte("transaction_date", cutoff) \
            .execute()
        rows = res.data or []
    except Exception as e:
        print(f"[ERROR] Failed to load transactions for {ticker}: {e}")
        return
    
    buys = sum(r.get("shares", 0) for r in rows if r.get("transaction_type") == "buy")
    sells = sum(r.get("shares", 0) for r in rows if r.get("transaction_type") == "sell")
    net = buys - sells
    
    verdict = "neutral"
    if net > 0:
        verdict = "accumulating"
    elif net < 0:
        verdict = "distributing"
    
    try:
        supabase.table("insider_summary").upsert({
            "ticker": ticker,
            "buys_90d": buys,
            "sells_90d": sells,
            "net_activity_90d": net,
            "verdict": verdict,
            "updated_at": datetime.utcnow().isoformat()
        }, on_conflict="ticker").execute()
    except Exception as e:
        print(f"[WARN] Failed to update summary for {ticker}: {e}")


def rebuild_all_summaries(days: int = 90):
    """Rebuild insider_summary for all tickers with transactions."""
    cutoff = (datetime.utcnow().date() - timedelta(days=days)).isoformat()
    
    try:
        # Get all unique tickers with transactions in the last 90 days
        res = supabase.table("insider_transactions") \
            .select("ticker") \
            .gte("transaction_date", cutoff) \
            .execute()
        
        tickers = list(set([r["ticker"] for r in res.data or []]))
        
        for ticker in tickers:
            update_summary(ticker, days)
        
        print(f"[INFO] Updated summaries for {len(tickers)} tickers")
    except Exception as e:
        print(f"[ERROR] Failed to rebuild summaries: {e}")

