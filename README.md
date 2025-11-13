# Silent Whale - Stock Accumulation Tracker

A PWA that shows where institutional investors and insiders are accumulating stocks. Zero manual data entry - everything automated.

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Hosting**: Netlify
- **Data Sources**: 
  - Yahoo Finance (yfinance Python library)
  - SEC EDGAR API (insider transactions)

## Setup Instructions

### 1. Supabase Setup

1. Create a new Supabase project at https://supabase.com
2. Run the SQL schema from `database_schema.sql` in the Supabase SQL Editor
3. Get your project URL and anon key from Settings > API

### 2. Environment Variables

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```bash
cp .env.example .env
```

For the Python pipeline, also add:
```
SUPABASE_URL=your_supabase_url_here
SUPABASE_SERVICE_KEY=your_service_key_here
```

### 3. Frontend Setup

```bash
npm install
npm run dev
```

Build for production:
```bash
npm run build
```

### 4. Python Data Pipeline Setup

```bash
cd data_pipeline
pip install -r requirements.txt
```

Create a `.env` file in the `data_pipeline` directory with your Supabase credentials.

Run the pipeline manually:
```bash
python update_stocks.py
```

### 5. Automate Data Updates

**Windows (Task Scheduler):**
1. Open Task Scheduler
2. Create Basic Task
3. Set trigger to Daily at 6:00 AM
4. Action: Start a program
5. Program: `python`
6. Arguments: `C:\path\to\silent\data_pipeline\update_stocks.py`
7. Start in: `C:\path\to\silent\data_pipeline`

**Mac/Linux (cron):**
```bash
crontab -e
# Add this line:
0 6 * * * cd /path/to/silent && /usr/bin/python3 data_pipeline/update_stocks.py
```

### 6. Deploy to Netlify

1. Connect your repository to Netlify
2. Build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
3. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

## Project Structure

```
silent-whale/
├── src/
│   ├── components/
│   │   ├── StockCard.jsx
│   │   ├── StockDetail.jsx
│   │   ├── StockList.jsx
│   │   └── StageIndicator.jsx
│   ├── lib/
│   │   └── supabase.js
│   ├── App.jsx
│   └── main.jsx
├── data_pipeline/
│   ├── update_stocks.py
│   └── requirements.txt
├── database_schema.sql
└── package.json
```

## Features

- **Stage Analysis**: Weinstein stage classification (Basing, Advancing, Topping, Declining)
- **Institutional Tracking**: Monitor institutional ownership changes
- **Insider Activity**: Track insider buys and sells
- **Smart Filtering**: Filter by stage or accumulation signals
- **Mobile-First**: Responsive design for all devices

## Data Sources

- **Yahoo Finance**: Stock prices, financials, market data
- **SEC EDGAR**: Insider transaction filings (to be implemented)

## License

MIT


