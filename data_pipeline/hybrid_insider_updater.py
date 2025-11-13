"""
Hybrid Insider Transaction Updater

Fetches insider trading data using:
1. Yahoo Finance JSON (primary)
2. Nasdaq HTML (fallback)
3. OpenInsider HTML (fallback)

Updates Supabase insider_transactions and insider_summary tables.
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

# Headers for all requests
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}


def normalize_transaction_type(tx_type):
    """Normalize transaction type to 'buy' or 'sell'"""
    if not tx_type:
        return None
    
    tx_type = str(tx_type).upper().strip()
    
    if tx_type in ["P", "BUY", "PURCHASE", "ACQUISITION"]:
        return "buy"
    elif tx_type in ["S", "SELL", "SALE", "DISPOSITION"]:
        return "sell"
    
    return None


def normalize_date(date_str):
    """Normalize date to YYYY-MM-DD format"""
    if not date_str:
        return None
    
    # Try common date formats
    formats = [
        "%Y-%m-%d",
        "%m/%d/%Y",
        "%m-%d-%Y",
        "%d/%m/%Y",
        "%Y/%m/%d",
        "%B %d, %Y",
        "%b %d, %Y",
    ]
    
    for fmt in formats:
        try:
            dt = datetime.strptime(str(date_str).strip(), fmt)
            return dt.date().isoformat()
        except:
            continue
    
    return None


def fetch_with_retry(url, max_retries=3, timeout=10):
    """Fetch URL with retry logic and backoff"""
    for attempt in range(max_retries):
        try:
            response = requests.get(url, headers=HEADERS, timeout=timeout)
            if response.status_code == 200:
                return response
            elif response.status_code == 404:
                return None  # Not found, don't retry
        except Exception as e:
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt  # Exponential backoff
                time.sleep(wait_time)
            else:
                print(f"  ✗ Failed after {max_retries} attempts: {e}")
                return None
    
    return None


def fetch_yahoo_finance(ticker):
    """Fetch insider transactions from Yahoo Finance JSON API"""
    url = f"https://query1.finance.yahoo.com/v7/finance/insider-transactions?symbol={ticker}"
    
    response = fetch_with_retry(url)
    if not response or response.status_code != 200:
        return []
    
    try:
        data = response.json()
        transactions = []
        
        # Navigate JSON structure - Yahoo Finance API structure may vary
        if "finance" in data and "result" in data["finance"]:
            for result in data["finance"]["result"]:
                if "transactions" in result:
                    for tx in result["transactions"]:
                        tx_type = normalize_transaction_type(tx.get("transactionType"))
                        if not tx_type:
                            continue
                        
                        date_str = tx.get("startDate", {}).get("raw")
                        if date_str:
                            date_str = datetime.fromtimestamp(date_str).strftime("%Y-%m-%d")
                        else:
                            date_str = tx.get("startDate", {}).get("fmt")
                        
                        shares = 0
                        try:
                            shares_val = tx.get("shares", {})
                            if isinstance(shares_val, dict):
                                shares = int(shares_val.get("raw", 0))
                            else:
                                shares = int(shares_val)
                        except:
                            continue
                        
                        if shares <= 0:
                            continue
                        
                        transactions.append({
                            "insider_name": tx.get("insiderName", "Unknown"),
                            "insider_title": tx.get("insiderTitle", ""),
                            "transaction_type": tx_type,
                            "shares": shares,
                            "transaction_date": normalize_date(date_str),
                            "filing_date": normalize_date(date_str),
                            "price_per_share": tx.get("price", {}).get("raw") if isinstance(tx.get("price"), dict) else tx.get("price"),
                            "total_value": tx.get("value", {}).get("raw") if isinstance(tx.get("value"), dict) else tx.get("value")
                        })
        
        return transactions
    except Exception as e:
        # Yahoo Finance API may not be available or structure changed
        return []


def fetch_nasdaq(ticker):
    """Fetch insider transactions from Nasdaq HTML"""
    url = f"https://www.nasdaq.com/market-activity/stocks/{ticker}/insider-activity"
    
    response = fetch_with_retry(url)
    if not response or response.status_code != 200:
        return []
    
    try:
        soup = BeautifulSoup(response.text, 'html.parser')
        transactions = []
        
        # Try multiple table selectors
        table = (soup.find('table', class_='insider-activity-table') or 
                 soup.find('table', {'id': 'insider-table'}) or
                 soup.find('table', class_='insider-table') or
                 soup.find('table'))
        
        if not table:
            return []
        
        rows = table.find_all('tr')[1:]  # Skip header
        
        for row in rows:
            cells = row.find_all(['td', 'th'])
            if len(cells) < 3:
                continue
            
            try:
                # Nasdaq table structure varies - try to find transaction data
                # Common patterns: [Date, Insider, Title, Transaction, Shares, Value]
                text_cells = [cell.get_text(strip=True) for cell in cells]
                
                # Look for transaction type in any cell
                tx_type = None
                tx_type_str = ""
                for cell_text in text_cells:
                    tx_type = normalize_transaction_type(cell_text)
                    if tx_type:
                        tx_type_str = cell_text
                        break
                
                if not tx_type:
                    continue
                
                # Find shares (look for numbers with commas)
                shares = 0
                for cell_text in text_cells:
                    if ',' in cell_text or any(char.isdigit() for char in cell_text):
                        try:
                            shares_str = cell_text.replace(',', '').replace('$', '').replace('(', '').replace(')', '').strip()
                            shares = int(float(shares_str))
                            if shares > 0:
                                break
                        except:
                            continue
                
                if shares <= 0:
                    continue
                
                # Find date (look for date-like strings)
                date_str = None
                for cell_text in text_cells:
                    if '/' in cell_text or '-' in cell_text:
                        date_str = normalize_date(cell_text)
                        if date_str:
                            break
                
                # Find insider name (usually first or second cell)
                insider_name = text_cells[0] if len(text_cells) > 0 else "Unknown"
                insider_title = text_cells[1] if len(text_cells) > 1 and not normalize_date(text_cells[1]) else ""
                
                transactions.append({
                    "insider_name": insider_name or "Unknown",
                    "insider_title": insider_title,
                    "transaction_type": tx_type,
                    "shares": shares,
                    "transaction_date": date_str,
                    "filing_date": date_str,
                    "price_per_share": None,
                    "total_value": None
                })
            except Exception as e:
                continue
        
        return transactions
    except Exception as e:
        return []


def fetch_openinsider(ticker):
    """Fetch insider transactions from OpenInsider HTML"""
    url = f"http://openinsider.com/screener?symbol={ticker}"
    
    response = fetch_with_retry(url)
    if not response or response.status_code != 200:
        return []
    
    try:
        soup = BeautifulSoup(response.text, 'html.parser')
        transactions = []
        
        # Find transaction table - OpenInsider uses specific table ID
        table = soup.find('table', {'id': 'table'}) or soup.find('table', class_='tinytable') or soup.find('table')
        if not table:
            return []
        
        rows = table.find_all('tr')[1:]  # Skip header
        
        for row in rows:
            cells = row.find_all(['td', 'th'])
            if len(cells) < 4:
                continue
            
            try:
                # OpenInsider table structure: [Filing Date, Trade Date, Insider, Title, Transaction, Shares, ...]
                text_cells = [cell.get_text(strip=True) for cell in cells]
                
                if len(text_cells) < 5:
                    continue
                
                filing_date_str = text_cells[0] if len(text_cells) > 0 else ""
                transaction_date_str = text_cells[1] if len(text_cells) > 1 else ""
                insider_name = text_cells[2] if len(text_cells) > 2 else "Unknown"
                insider_title = text_cells[3] if len(text_cells) > 3 else ""
                tx_type_str = text_cells[4] if len(text_cells) > 4 else ""
                shares_str = text_cells[5] if len(text_cells) > 5 else ""
                
                tx_type = normalize_transaction_type(tx_type_str)
                if not tx_type:
                    continue
                
                # Parse shares
                shares = 0
                try:
                    shares_str = shares_str.replace(',', '').replace('$', '').replace('(', '').replace(')', '').strip()
                    shares = int(float(shares_str))
                except:
                    continue
                
                if shares <= 0:
                    continue
                
                transactions.append({
                    "insider_name": insider_name or "Unknown",
                    "insider_title": insider_title,
                    "transaction_type": tx_type,
                    "shares": shares,
                    "transaction_date": normalize_date(transaction_date_str) or normalize_date(filing_date_str),
                    "filing_date": normalize_date(filing_date_str),
                    "price_per_share": None,
                    "total_value": None
                })
            except Exception as e:
                continue
        
        return transactions
    except Exception as e:
        return []


def fetch_insider_transactions(ticker):
    """Try all three sources in order until we get data"""
    print(f"  Trying Yahoo Finance...")
    transactions = fetch_yahoo_finance(ticker)
    
    if transactions:
        print(f"  ✓ Yahoo Finance: {len(transactions)} transactions")
        return transactions
    
    print(f"  Trying Nasdaq...")
    transactions = fetch_nasdaq(ticker)
    
    if transactions:
        print(f"  ✓ Nasdaq: {len(transactions)} transactions")
        return transactions
    
    print(f"  Trying OpenInsider...")
    transactions = fetch_openinsider(ticker)
    
    if transactions:
        print(f"  ✓ OpenInsider: {len(transactions)} transactions")
        return transactions
    
    print(f"  ✗ No transactions found from any source")
    return []


def insert_transactions(ticker, transactions):
    """Insert transactions into Supabase with deduplication"""
    inserted = 0
    
    for tx in transactions:
        if not tx.get("transaction_date"):
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
            # Upsert to handle duplicates
            result = supabase.table("insider_transactions").upsert(
                data,
                on_conflict="ticker,insider_name,transaction_date,shares"
            ).execute()
            
            if result.data:
                inserted += 1
        except Exception as e:
            # Skip errors (duplicates handled by upsert)
            error_str = str(e).lower()
            if "duplicate" not in error_str and "unique" not in error_str:
                print(f"    ✗ Error inserting transaction: {e}")
            continue
    
    return inserted


def update_insider_summary():
    """Update insider_summary table with 90-day aggregates"""
    cutoff = (datetime.utcnow() - timedelta(days=90)).date().isoformat()
    
    # Get all tickers
    tickers_result = supabase.table("stocks").select("ticker").execute()
    tickers = [t["ticker"] for t in tickers_result.data] if tickers_result.data else []
    
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
        
        # Determine verdict
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
        except Exception as e:
            print(f"  ✗ Error updating summary for {ticker}: {e}")


def main():
    print(f"Starting hybrid insider update at {datetime.utcnow().isoformat()}")
    print(f"Tracking {len(TRACKED_TICKERS)} tickers\n")
    
    total_inserted = 0
    processed_count = 0
    skipped_count = 0
    
    for ticker in TRACKED_TICKERS:
        print(f"Processing {ticker}...")
        
        transactions = fetch_insider_transactions(ticker)
        
        if not transactions:
            skipped_count += 1
            print(f"  ⏭ Skipped (no transactions)\n")
            continue
        
        inserted = insert_transactions(ticker, transactions)
        total_inserted += inserted
        processed_count += 1
        print(f"  ✓ Inserted {inserted} transactions\n")
        
        # Small delay to avoid rate limiting
        time.sleep(0.5)
    
    print(f"\n{'='*50}")
    print(f"Processed: {processed_count} tickers")
    print(f"Skipped: {skipped_count} tickers")
    print(f"Total transactions inserted: {total_inserted}")
    
    # Update summary
    print(f"\nUpdating insider_summary...")
    update_insider_summary()
    print(f"✓ Summary updated")
    
    print(f"\n✅ Hybrid insider update complete")


if __name__ == "__main__":
    main()

