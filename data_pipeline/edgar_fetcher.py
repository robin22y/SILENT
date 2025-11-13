"""
HYBRID EDGAR FETCHER — bulletproof
Handles direct SEC requests with User-Agent and proxy fallback.
"""

import requests
from datetime import datetime, timedelta
from xml.etree import ElementTree as ET
import os
from dotenv import load_dotenv

load_dotenv()

DIRECT = "https://data.sec.gov/submissions/CIK{}.json"
PROXY = "https://api.allorigins.win/raw?url=https://data.sec.gov/submissions/CIK{}.json"

EDGAR_USER_AGENT = os.getenv("EDGAR_USER_AGENT") or "SilentWhale/1.0 (contact: your-robin@digiget.uk)"

HEADERS = {
    "User-Agent": EDGAR_USER_AGENT
}


def fetch_edgar_json(cik: str):
    """Fetch company submissions JSON from SEC EDGAR with hybrid direct/proxy approach."""
    url_direct = DIRECT.format(cik.zfill(10))
    
    # Try direct request first
    try:
        r = requests.get(url_direct, headers=HEADERS, timeout=8)
        if r.status_code == 200:
            return r.json()
    except Exception as e:
        print(f"[WARN] Direct EDGAR fetch failed for CIK {cik}: {e}")
    
    # Fall back to proxy
    url_proxy = PROXY.format(cik.zfill(10))
    try:
        r = requests.get(url_proxy, timeout=8)
        if r.status_code == 200:
            return r.json()
    except Exception as e:
        print(f"[WARN] Proxy EDGAR fetch failed for CIK {cik}: {e}")
    
    return None


def list_form4_filings(sub: dict, max_days: int = 120):
    """Extract recent Form 4 filings from submissions JSON.
    
    Returns list of (accessionNumber, primaryDocument, filingDate) tuples.
    """
    if not sub:
        return []
    
    recent = sub.get("filings", {}).get("recent", {})
    forms = recent.get("form", [])
    acc = recent.get("accessionNumber", [])
    docs = recent.get("primaryDocument", [])
    dates = recent.get("filingDate", [])
    
    cutoff = datetime.utcnow().date() - timedelta(days=max_days)
    
    out = []
    for f, a, d, p in zip(forms, acc, dates, docs):
        if f != "4":
            continue
        try:
            dt = datetime.strptime(d, "%Y-%m-%d").date()
            if dt >= cutoff:
                out.append((a, p, dt))
        except Exception:
            continue
    
    return out


def build_xml_url(cik: str, acc: str, doc: str) -> str:
    """Build SEC EDGAR XML/HTML document URL from CIK, accession number, and document name."""
    acc_no_dash = acc.replace("-", "")
    cik_int = str(int(cik))  # Remove leading zeros
    return f"https://www.sec.gov/Archives/edgar/data/{cik_int}/{acc_no_dash}/{doc}"


def fetch_form4_document(url: str) -> str | None:
    """Fetch Form 4 XML/HTML document with hybrid direct/proxy approach."""
    # Try direct request first
    try:
        r = requests.get(url, headers=HEADERS, timeout=10)
        if r.status_code == 200:
            return r.text
    except Exception as e:
        print(f"[WARN] Direct document fetch failed: {e}")
    
    # Fall back to proxy
    proxy_url = f"https://api.allorigins.win/raw?url={url}"
    try:
        r = requests.get(proxy_url, timeout=10)
        if r.status_code == 200:
            return r.text
    except Exception as e:
        print(f"[WARN] Proxy document fetch failed: {e}")
    
    return None


def _find_text(node, suffix: str):
    """Helper to find text in a node by tag suffix."""
    for e in node.iter():
        if e.tag.endswith(suffix) and e.text:
            return e.text.strip()
    return None


def parse_form4_xml(xml_text: str, ticker: str, filing_date):
    """Parse Form 4 XML and extract insider transactions.
    
    Handles both non-derivative and derivative transactions.
    Includes option exercises (code M) as buys.
    
    Returns list of trade dictionaries with:
    - ticker
    - insider_name
    - transaction_type ('buy' or 'sell')
    - shares
    - transaction_date
    - filing_date
    """
    trades = []
    
    try:
        root = ET.fromstring(xml_text)
    except Exception as e:
        print(f"[WARN] XML parse error: {e}")
        return trades
    
    insider_name = _find_text(root, "rptOwnerName") or "Unknown Insider"
    
    # Look in nonDerivativeTable and derivativeTable for transactions
    for table_suffix in ("nonDerivativeTable", "derivativeTable"):
        for table in root.iter():
            if not table.tag.endswith(table_suffix):
                continue
            
            for tx in table:
                tag = tx.tag.split("}")[-1]
                if tag not in ("nonDerivativeTransaction", "derivativeTransaction"):
                    continue
                
                # Extract transaction code P / S / M
                code = _find_text(tx, "transactionCode")
                if not code:
                    continue
                code = code.strip().upper()
                if code not in ("P", "S", "M"):  # P=Purchase, S=Sale, M=Option exercise
                    continue
                
                # Extract shares from transactionShares/value
                shares_txt = None
                for e in tx.iter():
                    t = e.tag.split("}")[-1]
                    if t in ("transactionShares", "shares"):
                        for v in e.iter():
                            if v.tag.endswith("value") and v.text:
                                shares_txt = v.text.strip()
                                break
                    if shares_txt:
                        break
                
                if not shares_txt:
                    continue
                
                try:
                    shares = int(float(shares_txt.replace(",", "")))
                except Exception:
                    continue
                
                # Extract transaction date (or fall back to filing_date)
                date_txt = None
                for e in tx.iter():
                    if e.tag.endswith("transactionDate"):
                        for v in e.iter():
                            if v.tag.endswith("value") and v.text:
                                date_txt = v.text.strip()
                                break
                    if date_txt:
                        break
                
                if date_txt:
                    try:
                        tx_date = datetime.strptime(date_txt, "%Y-%m-%d").date()
                    except Exception:
                        tx_date = filing_date
                else:
                    tx_date = filing_date
                
                # Map code to buy/sell
                if code in ("P", "M"):
                    tx_type = "buy"
                else:
                    tx_type = "sell"
                
                trades.append({
                    "ticker": ticker,
                    "insider_name": insider_name,
                    "transaction_type": tx_type,
                    "shares": shares,
                    "transaction_date": tx_date.isoformat(),
                    "filing_date": filing_date.isoformat(),
                })
    
    return trades

