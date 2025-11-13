"""
Finviz Insider Transaction Updater

Fetches insider trading data from Finviz HTML and updates Supabase.
Run daily via cron/Task Scheduler.
"""

import requests
from bs4 import BeautifulSoup
from datetime import datetime, timedelta
from supabase import create_client
import os
import time
from dotenv import load_dotenv
from ticker_list import TRACKED_TICKERS

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment.")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Finviz requires browser-like User-Agent
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}


def normalize_transaction_type(tx_type):
    """Normalize transaction type to 'buy' or 'sell'"""
    if not tx_type:
        return None
    
    tx_type = str(tx_type).upper().strip()
    
    if tx_type in ["BUY", "PURCHASE", "ACQUISITION"]:
        return "buy"
    elif tx_type in ["SELL", "SALE", "DISPOSITION"]:
        return "sell"
    
    return None




def fetch_finviz_html(ticker):
    """Fetch insider trading HTML from Finviz quote page"""
    # Insider data is embedded in the quote page, not a separate endpoint
    url = f"https://finviz.com/quote.ashx?t={ticker}"
    
    try:
        response = requests.get(url, headers=HEADERS, timeout=10)
        if response.status_code == 200:
            return response.text
        else:
            print(f"  X HTTP {response.status_code}")
            return None
    except Exception as e:
        print(f"  X Error fetching: {e}")
        return None


def parse_finviz_table(html):
    """Parse insider trading table from Finviz HTML"""
    if not html:
        return []
    
    try:
        soup = BeautifulSoup(html, 'html.parser')
        transactions = []
        
        # Find rows with class "fv-insider-row" - these are the actual transaction rows
        insider_rows = soup.find_all('tr', class_=lambda x: x and 'fv-insider-row' in x)
        
        if not insider_rows:
            return []
        
        for row in insider_rows:
            cells = row.find_all('td')
            if len(cells) < 6:
                continue
            
            try:
                # Structure: [Name, Relationship, Date, Transaction, Cost, #Shares, Value, #Shares Total, SEC Form]
                # Extract insider name (first cell, may be inside <a> tag)
                name_cell = cells[0]
                insider_name = name_cell.get_text(strip=True)
                if not insider_name:
                    # Try getting from link
                    link = name_cell.find('a')
                    if link:
                        insider_name = link.get_text(strip=True)
                
                if not insider_name:
                    continue
                
                # Extract relationship/title (second cell)
                insider_title = cells[1].get_text(strip=True) if len(cells) > 1 else ""
                
                # Extract date (third cell) - format: "Nov 07 '25"
                date_text = cells[2].get_text(strip=True) if len(cells) > 2 else ""
                date_str = parse_finviz_date(date_text)
                if not date_str:
                    continue
                
                # Extract transaction type (fourth cell)
                tx_text = cells[3].get_text(strip=True) if len(cells) > 3 else ""
                tx_type = normalize_transaction_type(tx_text)
                if not tx_type:
                    # Skip non-buy/sell transactions
                    continue
                
                # Extract cost/price (fifth cell)
                price_per_share = None
                if len(cells) > 4:
                    price_text = cells[4].get_text(strip=True).replace(',', '').replace('$', '')
                    try:
                        price_per_share = float(price_text) if price_text else None
                    except:
                        pass
                
                # Extract shares (sixth cell)
                shares = 0
                if len(cells) > 5:
                    shares_text = cells[5].get_text(strip=True).replace(',', '').replace('$', '')
                    try:
                        shares = int(float(shares_text)) if shares_text else 0
                    except:
                        pass
                
                if shares <= 0:
                    continue
                
                # Extract value (seventh cell)
                total_value = None
                if len(cells) > 6:
                    value_text = cells[6].get_text(strip=True).replace(',', '').replace('$', '').replace('(', '').replace(')', '')
                    try:
                        total_value = float(value_text) if value_text else None
                    except:
                        pass
                
                transactions.append({
                    "insider_name": insider_name,
                    "insider_title": insider_title,
                    "transaction_type": tx_type,
                    "shares": shares,
                    "transaction_date": date_str,
                    "filing_date": date_str,
                    "price_per_share": price_per_share,
                    "total_value": total_value
                })
            except Exception as e:
                continue
        
        return transactions
    except Exception as e:
        print(f"  X Error parsing HTML: {e}")
        return []


def parse_finviz_date(date_str):
    """Parse Finviz date format (e.g., "Nov 07 '25" or "MM/DD/YYYY") to YYYY-MM-DD"""
    if not date_str:
        return None
    
    date_str = str(date_str).strip()
    
    # Try MM/DD/YYYY format first
    try:
        dt = datetime.strptime(date_str, "%m/%d/%Y")
        return dt.date().isoformat()
    except:
        pass
    
    # Try Finviz format: "Nov 07 '25" or "Nov 07 2025"
    try:
        # Handle abbreviated year format
        if "'" in date_str:
            # "Nov 07 '25" -> "Nov 07 2025"
            parts = date_str.split("'")
            if len(parts) == 2:
                year = "20" + parts[1].strip()
                date_str = parts[0].strip() + " " + year
        
        # Try various month formats
        for fmt in ["%b %d %Y", "%B %d %Y", "%b %d, %Y", "%B %d, %Y"]:
            try:
                dt = datetime.strptime(date_str, fmt)
                return dt.date().isoformat()
            except:
                continue
    except:
        pass
    
    return None


def upsert_transactions_to_supabase(ticker, transactions):
    """Upsert transactions into Supabase with deduplication"""
    inserted = 0
    
    for tx in transactions:
        if not tx.get("transaction_date") or not tx.get("shares"):
            continue
        
        data = {
            "ticker": ticker,
            "insider_name": tx.get("insider_name", "Unknown"),
            "insider_title": tx.get("insider_title"),
            "transaction_type": tx.get("transaction_type"),
            "shares": tx.get("shares"),
            "transaction_date": tx.get("transaction_date"),
            "filing_date": tx.get("filing_date") or tx.get("transaction_date"),
            "price_per_share": tx.get("price_per_share"),
            "total_value": tx.get("total_value")
        }
        
        try:
            # Check if transaction already exists
            existing = supabase.table("insider_transactions") \
                .select("id") \
                .eq("ticker", data["ticker"]) \
                .eq("insider_name", data["insider_name"]) \
                .eq("transaction_date", data["transaction_date"]) \
                .eq("shares", data["shares"]) \
                .execute()
            
            if existing.data and len(existing.data) > 0:
                # Update existing record
                result = supabase.table("insider_transactions") \
                    .update(data) \
                    .eq("id", existing.data[0]["id"]) \
                    .execute()
            else:
                # Insert new record
                result = supabase.table("insider_transactions") \
                    .insert(data) \
                    .execute()
            
            # Count as inserted/updated
            inserted += 1
        except Exception as e:
            # Log all errors for debugging
            error_str = str(e).lower()
            if "duplicate" not in error_str and "unique" not in error_str:
                print(f"    X Error inserting transaction for {data.get('ticker', '?')}: {e}")
            # Don't count failed inserts
            continue
    
    return inserted


def update_insider_summary():
    """Update insider_summary table with 90-day aggregates"""
    cutoff = (datetime.utcnow() - timedelta(days=90)).date().isoformat()
    
    # Get all tickers
    tickers_result = supabase.table("stocks").select("ticker").execute()
    tickers = [t["ticker"] for t in tickers_result.data] if tickers_result.data else []
    
    updated_count = 0
    
    for ticker in tickers:
        # Get transactions for last 90 days
        result = supabase.table("insider_transactions") \
            .select("transaction_type, shares, total_value") \
            .eq("ticker", ticker) \
            .gte("transaction_date", cutoff) \
            .execute()
        
        if not result.data:
            continue
        
        buys = 0
        sells = 0
        total_bought_value = 0
        total_sold_value = 0
        
        for tx in result.data:
            if tx["transaction_type"] == "buy":
                buys += 1
                if tx.get("total_value"):
                    total_bought_value += tx["total_value"]
            elif tx["transaction_type"] == "sell":
                sells += 1
                if tx.get("total_value"):
                    total_sold_value += tx["total_value"]
        
        net_activity = total_bought_value - total_sold_value
        
        # Determine verdict based on net activity
        if net_activity > 0:
            verdict = "accumulating"
        elif net_activity < 0:
            verdict = "distributing"
        else:
            verdict = "neutral"
        
        summary_data = {
            "ticker": ticker,
            "buys_90d": buys,
            "sells_90d": sells,
            "total_bought_value_90d": total_bought_value,
            "total_sold_value_90d": total_sold_value,
            "net_activity_90d": net_activity,
            "verdict": verdict,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        try:
            supabase.table("insider_summary").upsert(
                summary_data,
                on_conflict="ticker"
            ).execute()
            updated_count += 1
        except Exception as e:
            print(f"  X Error updating summary for {ticker}: {e}")
    
    return updated_count


def main():
    print(f"Starting Finviz insider update at {datetime.utcnow().isoformat()}")
    print(f"Tracking {len(TRACKED_TICKERS)} tickers\n")
    
    total_inserted = 0
    processed_count = 0
    skipped_count = 0
    
    for ticker in TRACKED_TICKERS:
        print(f"Fetching Finviz for {ticker}...")
        
        html = fetch_finviz_html(ticker)
        if not html:
            skipped_count += 1
            print(f"  >> Skipped (no HTML)\n")
            time.sleep(1)
            continue
        
        transactions = parse_finviz_table(html)
        
        if not transactions:
            skipped_count += 1
            print(f"  >> Skipped (no transactions found)\n")
            time.sleep(1)
            continue
        
        print(f"  Parsed {len(transactions)} trades")
        
        inserted = upsert_transactions_to_supabase(ticker, transactions)
        total_inserted += inserted
        processed_count += 1
        print(f"  Inserted {inserted} trades into Supabase\n")
        
        # 1-second delay between tickers
        time.sleep(1)
    
    print(f"\n{'='*50}")
    print(f"Processed: {processed_count} tickers")
    print(f"Skipped: {skipped_count} tickers")
    print(f"Total transactions inserted: {total_inserted}")
    
    # Update summary
    print(f"\nUpdating insider_summary...")
    updated = update_insider_summary()
    print(f"Summary updated for {updated} tickers")
    
    print(f"\n[OK] Finviz insider update complete")


if __name__ == "__main__":
    main()

