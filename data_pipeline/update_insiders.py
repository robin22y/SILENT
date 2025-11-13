"""
Daily insider transaction updater

- Fetches Form 4 filings from SEC EDGAR RSS feed
- Parses XML and extracts insider buy/sell transactions
- Updates Supabase 'insider_transactions' table
- Run via cron/Task Scheduler daily at 07:00 (after stock update)
"""

import feedparser
import requests
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from supabase import create_client
import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment.")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# RSS feed (latest Form-4 filings)
RSS_URL = "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=4&owner=only&count=2000&output=atom"

# SEC requires proper User-Agent header
RSS_HEADERS = {
    "User-Agent": "Mozilla/5.0 (SilentWhale; +contact@example.com)"
}

# Track same tickers as update_stocks.py
TRACKED_TICKERS = set([
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.B',
    'V', 'UNH', 'JNJ', 'WMT', 'XOM', 'JPM', 'PG', 'MA', 'HD', 'CVX',
    'LLY', 'ABBV', 'MRK', 'KO', 'PEP', 'AVGO', 'COST', 'TMO', 'MCD',
    'CSCO', 'ACN', 'ABT', 'DHR', 'VZ', 'NKE', 'TXN', 'CRM', 'ADBE',
    'CMCSA', 'NFLX', 'PM', 'WFC', 'INTC', 'BMY', 'NEE', 'DIS', 'UPS',
    'QCOM', 'T', 'LOW', 'ORCL', 'HON', 'UNP', 'IBM', 'BA', 'RTX',
    'AMD', 'INTU', 'GE', 'CAT', 'AMGN', 'SBUX', 'PLD', 'GS', 'BLK',
    'AXP', 'LMT', 'SPGI', 'DE', 'ELV', 'MDLZ', 'ADP', 'ADI', 'MMC',
    'TJX', 'CI', 'GILD', 'BKNG', 'CVS', 'SYK', 'VRTX', 'ZTS', 'C',
    'BDX', 'SCHW', 'NOC', 'REGN', 'MO', 'CB', 'PGR', 'SO', 'EOG',
    'DUK', 'MMM', 'ITW', 'CME', 'FI', 'USB', 'AON', 'ICE', 'BSX'
])


def extract_ticker(entry):
    """Extract ticker from RSS entry title (SEC format is messy)."""
    title = entry.get("title", "")
    # Common pattern: "FORM 4 - APPLE INC (AAPL)"
    if "(" in title and ")" in title:
        return title.split("(")[-1].split(")")[0].upper().strip()
    return None


def download_xml(entry):
    """Download the XML document linked in RSS entry."""
    link = entry.get("link", "")
    if not link:
        return None

    try:
        # SEC requires a user-agent
        headers = {"User-Agent": "Mozilla/5.0 (compatible; SilentWhale/1.0; +https://silentwhale.com)"}
        r = requests.get(link, headers=headers, timeout=10)
        if r.status_code == 200:
            return r.text
    except Exception as e:
        print(f"Error downloading XML: {e}")
        return None

    return None


def parse_form4(xml_text):
    """
    Parse Form 4 XML and extract:
    - insider_name
    - insider_title
    - transaction_type (buy/sell)
    - shares
    - price_per_share
    - transaction_date
    """
    results = []

    try:
        root = ET.fromstring(xml_text)
    except Exception as e:
        print(f"Error parsing XML: {e}")
        return results

    # SEC namespaces
    ns = {
        "edgar": "http://www.sec.gov/edgar/document",
        "xbrl": "http://www.xbrl.org/2003/instance"
    }

    # Get insider name
    insider_name = None
    insider_title = None
    
    # Try different paths for insider name
    for path in [
        ".//reportingOwner/reportingOwnerId/rptOwnerName",
        ".//reportingOwner/rptOwnerName",
        ".//ownerName"
    ]:
        insider_name = root.findtext(path)
        if insider_name:
            break
    
    if not insider_name:
        insider_name = "Unknown"

    # Try to get title
    for path in [
        ".//reportingOwner/reportingOwnerRelationship/officerTitle",
        ".//officerTitle"
    ]:
        insider_title = root.findtext(path)
        if insider_title:
            break

    # Get filing date
    filing_date = None
    for path in [
        ".//documentPeriodEndDate",
        ".//periodOfReport"
    ]:
        filing_date = root.findtext(path)
        if filing_date:
            break

    # Loop through non-derivative transactions
    for trans in root.findall(".//nonDerivativeTable/nonDerivativeTransaction"):
        code = trans.findtext("transactionCoding/transactionCode")
        
        if code not in ["P", "S"]:  # P=Purchase, S=Sale
            continue

        shares_elem = trans.find("transactionAmounts/transactionShares/value")
        if shares_elem is None:
            continue

        try:
            shares = int(float(shares_elem.text))
        except (ValueError, AttributeError):
            continue

        # Get price per share
        price_elem = trans.find("transactionAmounts/transactionPricePerShare/value")
        price_per_share = None
        if price_elem is not None and price_elem.text:
            try:
                price_per_share = float(price_elem.text)
            except (ValueError, AttributeError):
                pass

        transaction_type = "buy" if code == "P" else "sell"
        
        # Get transaction date
        trans_date_elem = trans.find("transactionDate/value")
        trans_date = filing_date  # Fallback to filing date
        if trans_date_elem is not None and trans_date_elem.text:
            trans_date = trans_date_elem.text

        results.append({
            "insider_name": insider_name,
            "insider_title": insider_title,
            "transaction_type": transaction_type,
            "shares": shares,
            "price_per_share": price_per_share,
            "transaction_date": trans_date,
            "filing_date": filing_date
        })

    return results


def insert_to_supabase(ticker, items):
    """Insert parsed insider trades to Supabase."""
    inserted_count = 0
    
    for item in items:
        # Calculate total value if we have price
        total_value = None
        if item["price_per_share"] and item["shares"]:
            total_value = item["price_per_share"] * item["shares"]

        data = {
            "ticker": ticker,
            "insider_name": item["insider_name"],
            "insider_title": item["insider_title"],
            "transaction_type": item["transaction_type"],
            "shares": item["shares"],
            "price_per_share": item["price_per_share"],
            "total_value": total_value,
            "transaction_date": item["transaction_date"],
            "filing_date": item["filing_date"]
        }

        try:
            # Insert (will handle duplicates via unique constraint or manual check)
            result = supabase.table("insider_transactions").insert(data).execute()
            if result.data:
                inserted_count += 1
        except Exception as e:
            # If duplicate, skip
            if "duplicate" not in str(e).lower() and "unique" not in str(e).lower():
                print(f"Error inserting transaction: {e}")
    
    return inserted_count


def update_insider_summary():
    """Update aggregated insider summary table."""
    # Get all unique tickers with insider transactions
    cutoff_date = (datetime.utcnow() - timedelta(days=90)).date().isoformat()
    
    # Query transactions from last 90 days
    result = supabase.table("insider_transactions")\
        .select("ticker, transaction_type, total_value")\
        .gte("transaction_date", cutoff_date)\
        .execute()
    
    if not result.data:
        return
    
    # Group by ticker
    ticker_data = {}
    for trans in result.data:
        ticker = trans["ticker"]
        if ticker not in ticker_data:
            ticker_data[ticker] = {
                "buys_90d": 0,
                "sells_90d": 0,
                "total_bought_value_90d": 0,
                "total_sold_value_90d": 0
            }
        
        if trans["transaction_type"] == "buy":
            ticker_data[ticker]["buys_90d"] += 1
            if trans["total_value"]:
                ticker_data[ticker]["total_bought_value_90d"] += trans["total_value"]
        else:
            ticker_data[ticker]["sells_90d"] += 1
            if trans["total_value"]:
                ticker_data[ticker]["total_sold_value_90d"] += trans["total_value"]
    
    # Update summary table
    for ticker, data in ticker_data.items():
        net_activity = data["total_bought_value_90d"] - data["total_sold_value_90d"]
        
        # Determine verdict
        if net_activity > 1000000:  # $1M threshold
            verdict = "accumulating"
        elif net_activity < -1000000:
            verdict = "distributing"
        else:
            verdict = "neutral"
        
        summary_data = {
            "ticker": ticker,
            "buys_90d": data["buys_90d"],
            "sells_90d": data["sells_90d"],
            "total_bought_value_90d": data["total_bought_value_90d"],
            "total_sold_value_90d": data["total_sold_value_90d"],
            "net_activity_90d": net_activity,
            "verdict": verdict,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        try:
            supabase.table("insider_summary").upsert(summary_data, on_conflict="ticker").execute()
        except Exception as e:
            print(f"Error updating summary for {ticker}: {e}")


def prune_old_data():
    """Delete insider data older than 120 days."""
    cutoff = (datetime.utcnow() - timedelta(days=120)).date().isoformat()
    
    try:
        # Delete old transactions
        result = supabase.table("insider_transactions")\
            .delete()\
            .lt("transaction_date", cutoff)\
            .execute()
        print(f"Pruned old insider transactions before {cutoff}")
    except Exception as e:
        print(f"Error pruning old data: {e}")


def main():
    print(f"Starting insider update at {datetime.utcnow().isoformat()}")
    
    try:
        print("Fetching SEC RSS feed...")
        response = requests.get(RSS_URL, headers=RSS_HEADERS, timeout=10)
        feed = feedparser.parse(response.text)
        
        print(f"Entries: {len(feed.entries)}")
        
        if not feed.entries:
            print("No entries found in RSS feed")
            return
        
        processed_count = 0
        inserted_total = 0
        
        for entry in feed.entries:
            ticker = extract_ticker(entry)
            if not ticker:
                continue

            ticker = ticker.upper()

            # Skip if not tracking this ticker
            if ticker not in TRACKED_TICKERS:
                continue

            print(f"Processing {ticker}...")
            
            filing_date = entry.get("updated", entry.get("published", ""))
            if "T" in filing_date:
                filing_date = filing_date.split("T")[0]

            xml_text = download_xml(entry)
            if not xml_text:
                continue

            items = parse_form4(xml_text)
            if not items:
                continue

            inserted = insert_to_supabase(ticker, items)
            inserted_total += inserted
            processed_count += 1
            print(f"  ✓ {ticker}: {inserted} transactions inserted")

        print(f"\nProcessed {processed_count} tickers, {inserted_total} total transactions inserted")
        
        # Update summary table
        print("Updating insider summary...")
        update_insider_summary()
        
        # Prune old data
        print("Pruning old data...")
        prune_old_data()
        
        print("✅ Insider data update complete")
        
    except Exception as e:
        print(f"✗ Error in main: {e}")
        raise


if __name__ == "__main__":
    main()

