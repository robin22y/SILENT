"""
EDGAR Insider Transaction Updater
Fetches insider transactions from SEC EDGAR Form 4 filings and updates Supabase.
Run daily via cron/Task Scheduler.
"""

import time
from datetime import datetime
from ticker_cik import TICKER_CIK, TRACKED_TICKERS
from edgar_fetcher import (
    fetch_edgar_json,
    list_form4_filings,
    build_xml_url,
    fetch_form4_document,
    parse_form4_xml
)
from supabase_client import save_trades, update_summary, rebuild_all_summaries


def update_insiders_from_edgar():
    """Main pipeline: fetch Form 4 filings and update Supabase."""
    print(f"[INFO] Starting EDGAR insider update at {datetime.utcnow().isoformat()}")
    print(f"[INFO] Tracking {len(TRACKED_TICKERS)} tickers\n")
    
    total_trades = 0
    processed_tickers = 0
    skipped_tickers = 0
    
    for ticker in TRACKED_TICKERS:
        cik = TICKER_CIK.get(ticker)
        if not cik:
            print(f"[WARN] No CIK for {ticker}, skipping.")
            skipped_tickers += 1
            continue
        
        print(f"[INFO] Processing {ticker} (CIK {cik})")
        
        # Fetch company submissions
        submissions = fetch_edgar_json(cik)
        if not submissions:
            print(f"[WARN] No submissions JSON for {ticker}")
            skipped_tickers += 1
            time.sleep(0.5)  # Be polite to SEC
            continue
        
        # Get recent Form 4 filings
        filings = list_form4_filings(submissions, max_days=120)
        if not filings:
            print(f"[INFO] No recent Form 4 filings for {ticker}")
            skipped_tickers += 1
            time.sleep(0.5)
            continue
        
        print(f"[INFO] Found {len(filings)} recent Form 4 filings for {ticker}")
        
        ticker_trades = 0
        
        # Process each Form 4 filing
        for accession, primary_doc, filing_date in filings:
            filing_url = build_xml_url(cik, accession, primary_doc)
            print(f"[INFO] Fetching Form 4: {accession}")
            
            xml_text = fetch_form4_document(filing_url)
            if not xml_text:
                print(f"[WARN] Could not fetch Form 4 document for {ticker} {accession}")
                continue
            
            # Parse transactions from XML
            trades = parse_form4_xml(xml_text, ticker, filing_date)
            if not trades:
                print(f"[INFO] No P/S trades parsed for {ticker} {accession}")
                continue
            
            # Save to Supabase
            save_trades(trades)
            ticker_trades += len(trades)
            total_trades += len(trades)
            print(f"[INFO] Inserted {len(trades)} trades for {ticker} from {accession}")
            
            # Be polite to SEC
            time.sleep(0.5)
        
        if ticker_trades > 0:
            # Update summary for this ticker
            update_summary(ticker, days=90)
            processed_tickers += 1
        else:
            skipped_tickers += 1
        
        print()  # Blank line between tickers
    
    print(f"\n{'='*50}")
    print(f"[INFO] Processed: {processed_tickers} tickers")
    print(f"[INFO] Skipped: {skipped_tickers} tickers")
    print(f"[INFO] Total trades processed: {total_trades}")
    
    # Rebuild all summaries to ensure consistency
    print(f"\n[INFO] Rebuilding all summaries...")
    rebuild_all_summaries(days=90)
    
    print(f"\n[OK] EDGAR insider update complete")


if __name__ == "__main__":
    update_insiders_from_edgar()

