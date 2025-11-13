from supabase import create_client
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def main():
    cutoff = (datetime.utcnow() - timedelta(days=90)).date().isoformat()

    # Get list of tracked tickers
    tickers = supabase.table("tickers").select("ticker").execute().data
    TICKERS = [t["ticker"] for t in tickers]

    for ticker in TICKERS:

        # Pull insider trades for last 90 days
        response = supabase.table("insider_transactions") \
            .select("transaction_type, shares") \
            .eq("ticker", ticker) \
            .gte("transaction_date", cutoff) \
            .execute()

        rows = response.data

        buys = sum(r["shares"] for r in rows if r["transaction_type"] == "buy")
        sells = sum(r["shares"] for r in rows if r["transaction_type"] == "sell")

        net = buys - sells

        if net > 0:
            verdict = "accumulating"
        elif net < 0:
            verdict = "distributing"
        else:
            verdict = "neutral"

        data = {
            "ticker": ticker,
            "buys_90d": buys,
            "sells_90d": sells,
            "net_activity_90d": net,
            "verdict": verdict,
            "updated_at": datetime.utcnow().isoformat()
        }

        # Upsert
        supabase.table("insider_summary").upsert(data, on_conflict="ticker").execute()

    print("✓ insider_summary updated")

if __name__ == "__main__":
    main()

