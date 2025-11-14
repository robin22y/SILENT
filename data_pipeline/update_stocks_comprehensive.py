"""
Comprehensive Stock Data Updater

Fetches ALL metrics from Yahoo Finance
"""

import yfinance as yf
from datetime import datetime
from supabase import create_client
import os
import pandas as pd
from dotenv import load_dotenv

# Load .env from current directory
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '.env'))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment.")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def calculate_stage(hist_data: pd.DataFrame):
    """
    Calculate Weinstein stage from price history.
    Stage 1 = Basing, 2=Advancing, 3=Topping, 4=Declining
    """
    if hist_data is None or hist_data.empty:
        return None, None

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

    try:
        ma_slope = (ma_30w.iloc[-1] - ma_30w.iloc[-30]) / ma_30w.iloc[-30]
    except Exception:
        ma_slope = 0

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


def calculate_relative_strength(ticker: str, days: int) -> float:
    """
    Calculate relative strength vs SPY over specified period.
    Returns percentage difference.
    """
    try:
        stock = yf.Ticker(ticker)
        spy = yf.Ticker("SPY")
        
        stock_hist = stock.history(period=f"{days}d")
        spy_hist = spy.history(period=f"{days}d")
        
        if len(stock_hist) < 2 or len(spy_hist) < 2:
            return 0.0
        
        stock_return = ((stock_hist['Close'].iloc[-1] / stock_hist['Close'].iloc[0]) - 1) * 100
        spy_return = ((spy_hist['Close'].iloc[-1] / spy_hist['Close'].iloc[0]) - 1) * 100
        
        rs = stock_return - spy_return
        return round(rs, 2)
    except Exception as e:
        print(f"[WARN] RS calc failed for {ticker}: {e}")
        return 0.0


def fetch_all_metrics(ticker):
    """Fetch comprehensive metrics for screener"""
    try:
        stock = yf.Ticker(ticker)
        info = stock.info
        hist = stock.history(period="max")  # Get all history for ATH
        
        if len(hist) < 150:
            print(f"[WARN] Insufficient history for {ticker}")
            return None
        
        # Calculate technical indicators
        stage, ma_30w = calculate_stage(hist)
        rs_6mo = calculate_relative_strength(ticker, 180)
        rs_3mo = calculate_relative_strength(ticker, 90)
        
        # Volume metrics
        avg_volume_90d = hist['Volume'].tail(90).mean()
        current_volume = hist['Volume'].iloc[-1]
        volume_vs_avg = ((current_volume / avg_volume_90d) - 1) * 100 if avg_volume_90d > 0 else 0
        
        # Price metrics
        current_price = hist['Close'].iloc[-1]
        week_52_high = hist['Close'].tail(252).max()
        week_52_low = hist['Close'].tail(252).min()
        ath = hist['Close'].max()
        
        distance_52w_high = ((current_price - week_52_high) / week_52_high) * 100
        distance_ath = ((current_price - ath) / ath) * 100
        
        # Price vs MA
        price_vs_ma = ((current_price - ma_30w) / ma_30w) * 100 if ma_30w else 0
        
        # Change today
        if len(hist) > 1:
            prev_close = hist['Close'].iloc[-2]
            change_today_pct = ((current_price - prev_close) / prev_close) * 100
        else:
            change_today_pct = 0
        
        # Build comprehensive data object
        data = {
            'ticker': ticker,
            'name': info.get('longName', ticker),
            
            # Price & Performance
            'price': float(current_price),
            'change_today_pct': round(change_today_pct, 2),
            'week_52_high': float(week_52_high),
            'week_52_low': float(week_52_low),
            'distance_from_52w_high_pct': round(distance_52w_high, 1),
            'ath': float(ath),
            'distance_from_ath_pct': round(distance_ath, 1),
            
            # Technical
            'stage': stage,
            'ma_30_week': float(ma_30w) if ma_30w else None,
            'price_vs_ma_pct': round(price_vs_ma, 1),
            'relative_strength_6mo': rs_6mo,
            'relative_strength_3mo': rs_3mo,
            'volume': int(current_volume),
            'volume_vs_avg_pct': round(volume_vs_avg, 1),
            'beta': info.get('beta'),
            
            # Fundamentals
            'market_cap': info.get('marketCap', 0),
            'pe_ratio': info.get('trailingPE'),
            'price_to_sales': info.get('priceToSalesTrailing12Months'),
            'pb_ratio': info.get('priceToBook'),
            'sales_ttm': info.get('totalRevenue', 0),
            'profit_margin': info.get('profitMargins', 0),
            'roe': info.get('returnOnEquity'),
            'roa': info.get('returnOnAssets'),
            'dividend_yield': info.get('dividendYield', 0) * 100 if info.get('dividendYield') else 0,
            'debt_to_equity': info.get('debtToEquity'),
            'free_cash_flow': info.get('freeCashflow'),
            
            # Ownership
            'insider_ownership_pct': info.get('heldPercentInsiders', 0) * 100,
            'institutional_ownership_pct': info.get('heldPercentInstitutions', 0) * 100,
            'short_interest_pct': info.get('shortPercentOfFloat', 0) * 100,
            
            # Company Info
            'sector': info.get('sector', 'Unknown'),
            'industry': info.get('industry', 'Unknown'),
            'employees': info.get('fullTimeEmployees'),
            
            'updated_at': datetime.utcnow().isoformat()
        }
        
        return data
        
    except Exception as e:
        print(f"✗ {ticker}: {e}")
        return None


def update_all_stocks():
    """Update all tracked stocks with comprehensive metrics"""
    response = supabase.table("tickers").select("ticker").execute()
    tickers = [t["ticker"] for t in response.data]
    
    print(f"[INFO] Updating {len(tickers)} stocks with comprehensive metrics...")
    
    success = 0
    for ticker in tickers:
        data = fetch_all_metrics(ticker)
        if data:
            supabase.table('stocks').upsert(data, on_conflict='ticker').execute()
            print(f"✓ {ticker}")
            success += 1
        else:
            print(f"✗ {ticker}")
    
    print(f"\n[OK] Updated {success}/{len(tickers)} stocks")


if __name__ == "__main__":
    update_all_stocks()

