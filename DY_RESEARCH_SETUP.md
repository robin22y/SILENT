# D.Y. Research System Setup Guide

## Overview
The D.Y. (Do Your Own) Research system helps users conduct thorough research before making investment decisions. It includes:
- 30+ research questions across 8 categories
- Decision tracking (BUY/HOLD/SELL)
- Chart link storage
- PDF report generation
- Data source hints for each question

## Database Setup

### Step 1: Run Database Schema
Execute the SQL in `database_schema.sql` to create the D.Y. Research tables:
- `dy_questions` - Pre-defined research questions
- `dy_answers` - User answers to questions
- `dy_decisions` - User investment decisions
- `dy_meta` - Additional metadata (chart links, notes)

### Step 2: Insert Starter Questions
Run the SQL file `database_schema_dy_questions.sql` in your Supabase SQL Editor to populate the questions.

This will insert 30 questions across 8 categories:
1. Business Understanding (4 questions)
2. Market & Competition (4 questions)
3. Financial Health (4 questions)
4. Management & Governance (4 questions)
5. Valuation (3 questions)
6. Technical & Timing (4 questions)
7. Risk Assessment (4 questions)
8. Personal Conviction (3 questions)
9. Final Exit Plan (1 question)

### Step 3: Set Up Row Level Security (RLS)

Enable RLS on all D.Y. Research tables:

```sql
-- Enable RLS
ALTER TABLE dy_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dy_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE dy_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dy_meta ENABLE ROW LEVEL SECURITY;

-- Questions are public (read-only for all)
CREATE POLICY "Questions are viewable by everyone"
  ON dy_questions FOR SELECT
  USING (true);

-- Users can only see their own answers
CREATE POLICY "Users can view own answers"
  ON dy_answers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own answers"
  ON dy_answers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own answers"
  ON dy_answers FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can only see their own decisions
CREATE POLICY "Users can view own decisions"
  ON dy_decisions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own decisions"
  ON dy_decisions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own decisions"
  ON dy_decisions FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can only see their own metadata
CREATE POLICY "Users can view own meta"
  ON dy_meta FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own meta"
  ON dy_meta FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own meta"
  ON dy_meta FOR UPDATE
  USING (auth.uid() = user_id);
```

## Component Structure

```
src/components/DYResearch/
├── index.jsx              # Main container component
├── DecisionButtons.jsx    # BUY/HOLD/SELL buttons
├── ChartLink.jsx         # TradingView chart link storage
├── ResearchQuestions.jsx  # Question/answer interface
└── PDFGenerator.jsx      # PDF report generation
```

## Features

### 1. Research Questions
- Questions are grouped by category
- Each question shows:
  - Guidance text (💡 hint)
  - Data sources (📚 links to Yahoo Finance, StockAnalysis, Finviz, etc.)
  - Checkbox to mark as completed
  - Text area for answers
- Answers auto-save on blur
- Dynamic questions can be filtered based on stock data availability

### 2. Decision Buttons
- Three buttons: BUY (green), HOLD (yellow), SELL (red)
- Saves decision immediately on click
- Shows saved decision status

### 3. Chart Link
- Optional TradingView chart URL storage
- Auto-saves on blur
- Quick link to open chart in new tab

### 4. PDF Generator
- Generates comprehensive PDF report with:
  - User info and date
  - Decision (BUY/HOLD/SELL)
  - All answered questions by category
  - Chart link (if provided)
- Downloads as `{TICKER}_DY_Research_{DATE}.pdf`

## Data Sources

Each question includes hints about where to find information:
- **Yahoo Finance**: `https://finance.yahoo.com/quote/{TICKER}/...`
- **StockAnalysis**: `https://www.stockanalysis.com/stocks/{TICKER}/...`
- **Finviz**: `https://www.finviz.com/quote.ashx?t={TICKER}`
- **TradingView**: `https://www.tradingview.com/chart/?symbol={TICKER}`
- **SEC EDGAR**: `https://www.sec.gov/...`
- **OpenInsider**: `https://www.openinsider.com/?q={TICKER}`
- **This app**: Links to relevant sections in Silent Whale

## Integration

The D.Y. Research system is integrated into `StockDetail.jsx`:
- Appears below the stock details and insider transactions
- Only visible to authenticated users
- Shows sign-in prompt for guests

## Testing Checklist

- [ ] Questions load from Supabase
- [ ] Answers auto-save on blur
- [ ] Decision buttons save immediately
- [ ] Chart link saves on blur
- [ ] PDF generates with all answers
- [ ] Dynamic questions filter correctly
- [ ] Multi-category grouping works
- [ ] RLS policies allow user access only
- [ ] Mobile responsive
- [ ] Data source links work correctly
- [ ] {TICKER} placeholders are replaced in URLs

## Usage

1. Navigate to any stock detail page (e.g., `/stock/AAPL`)
2. Scroll down to "D.Y. Research System"
3. Click BUY/HOLD/SELL to record your decision
4. Optionally save a TradingView chart link
5. Answer research questions (all optional)
6. Click "Generate Research PDF" to download a report

## Notes

- All questions are optional - users can answer as many or as few as they want
- Answers are saved per user per ticker
- The system encourages thorough research before making investment decisions
- PDF reports can be used for record-keeping and sharing with advisors

