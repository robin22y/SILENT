-- ============================================
-- DY RESEARCH STARTER QUESTIONS
-- ============================================
-- 
-- IMPORTANT: Run database_schema_dy_fix.sql FIRST if you get 
-- "column data_sources does not exist" error
--

-- Category: Business Understanding
INSERT INTO dy_questions (category, question, guidance, data_sources, is_dynamic, is_active, sort_order) VALUES
('Business Understanding', 'What does this company actually do? (Explain like I''m 5)', 'Describe the core business in simple terms', '["https://simplywall.st/stocks/us/{TICKER}", "https://finance.yahoo.com/quote/{TICKER}/profile", "https://www.stockanalysis.com/stocks/{TICKER}/", "Company website About page"]', false, true, 1),
('Business Understanding', 'How do they make money? What are their main revenue streams?', 'List 2-3 primary revenue sources', '["https://simplywall.st/stocks/us/{TICKER}", "https://finance.yahoo.com/quote/{TICKER}/financials", "https://www.stockanalysis.com/stocks/{TICKER}/financials/", "10-K filing (SEC.gov)"]', false, true, 2),
('Business Understanding', 'Who are their customers? (B2B, B2C, Government?)', 'Identify target market segments', '["https://simplywall.st/stocks/us/{TICKER}", "https://finance.yahoo.com/quote/{TICKER}/profile", "https://www.stockanalysis.com/stocks/{TICKER}/", "10-K filing - Business section"]', false, true, 3),
('Business Understanding', 'Is the business model simple or complex? Can I understand it in 5 minutes?', 'Assess business clarity - Warren Buffett''s circle of competence test', '["https://simplywall.st/stocks/us/{TICKER}", "https://finance.yahoo.com/quote/{TICKER}/profile", "Company investor relations page"]', false, true, 4);

-- Category: Market & Competition
INSERT INTO dy_questions (category, question, guidance, data_sources, is_dynamic, is_active, sort_order) VALUES
('Market & Competition', 'Who are the top 3 competitors?', 'List direct competitors by market share', '["https://simplywall.st/stocks/us/{TICKER}", "https://finance.yahoo.com/quote/{TICKER}/analysis", "https://www.stockanalysis.com/stocks/{TICKER}/competitors/", "10-K filing - Competition section"]', false, true, 5),
('Market & Competition', 'What gives this company an edge? (Moat, network effects, patents, brand?)', 'Identify competitive advantages', '["https://simplywall.st/stocks/us/{TICKER}", "https://finance.yahoo.com/quote/{TICKER}/analysis", "https://www.finviz.com/quote.ashx?t={TICKER}", "10-K filing - Business section"]', false, true, 6),
('Market & Competition', 'Is the industry growing, mature, or declining?', 'Assess TAM (Total Addressable Market) trajectory', '["https://simplywall.st/stocks/us/{TICKER}", "https://www.stockanalysis.com/stocks/{TICKER}/", "Industry reports (IBISWorld, Statista)", "10-K filing - Market section"]', false, true, 7),
('Market & Competition', 'Market share: Are they #1, #2, or a distant player?', 'Position within industry pecking order', '["https://simplywall.st/stocks/us/{TICKER}", "https://finance.yahoo.com/quote/{TICKER}/analysis", "Industry research reports", "10-K filing"]', false, true, 8);

-- Category: Financial Health
INSERT INTO dy_questions (category, question, guidance, data_sources, is_dynamic, is_active, sort_order) VALUES
('Financial Health', 'Are revenues growing consistently? (Check last 3-5 years)', 'Look for 15%+ YoY growth or steady trajectory', '["https://simplywall.st/stocks/us/{TICKER}", "https://finance.yahoo.com/quote/{TICKER}/financials", "https://www.stockanalysis.com/stocks/{TICKER}/financials/", "10-K filings (SEC.gov)"]', false, true, 9),
('Financial Health', 'Are they profitable? What''s the profit margin trend?', 'Check net margin: improving, stable, or declining?', '["https://simplywall.st/stocks/us/{TICKER}", "https://finance.yahoo.com/quote/{TICKER}/financials", "https://www.stockanalysis.com/stocks/{TICKER}/financials/", "https://www.finviz.com/quote.ashx?t={TICKER}"]', false, true, 10),
('Financial Health', 'Do they have manageable debt? (Debt/Equity ratio)', 'Red flag if Debt/Equity > 2x without strong cash flow', '["https://simplywall.st/stocks/us/{TICKER}", "https://finance.yahoo.com/quote/{TICKER}/balance-sheet", "https://www.stockanalysis.com/stocks/{TICKER}/financials/", "https://www.finviz.com/quote.ashx?t={TICKER}"]', false, true, 11),
('Financial Health', 'Free cash flow: Are they generating actual cash or just accounting profits?', 'Positive FCF = real money, negative = potentially burning cash', '["https://simplywall.st/stocks/us/{TICKER}", "https://finance.yahoo.com/quote/{TICKER}/cash-flow", "https://www.stockanalysis.com/stocks/{TICKER}/financials/", "10-K filing - Cash Flow Statement"]', false, true, 12);

-- Category: Management & Governance
INSERT INTO dy_questions (category, question, guidance, data_sources, is_dynamic, is_active, sort_order) VALUES
('Management & Governance', 'Does management have skin in the game? (Insider ownership %)', 'High insider ownership (>5%) = alignment with shareholders', '["https://simplywall.st/stocks/us/{TICKER}", "https://finance.yahoo.com/quote/{TICKER}/holders", "https://www.finviz.com/quote.ashx?t={TICKER}", "DEF 14A proxy statement (SEC.gov)"]', false, true, 13),
('Management & Governance', 'Any recent insider buying or selling? What does that signal?', 'Check Form 4 filings - buying = bullish, selling = caution', '["https://simplywall.st/stocks/us/{TICKER}", "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={CIK}&type=4", "https://www.openinsider.com/?q={TICKER}", "This app''s insider summary"]', false, true, 14),
('Management & Governance', 'CEO track record: Have they delivered on past promises?', 'Research CEO history, previous company performance', '["https://simplywall.st/stocks/us/{TICKER}", "CEO LinkedIn profile", "Company investor relations - Management bios", "News articles about CEO"]', false, true, 15),
('Management & Governance', 'Any red flags? (Lawsuits, accounting issues, executive turnover?)', 'Check recent news for governance concerns', '["https://simplywall.st/stocks/us/{TICKER}", "https://finance.yahoo.com/quote/{TICKER}/news", "SEC.gov - Recent filings", "Google News search: {TICKER} lawsuit OR scandal"]', false, true, 16);

-- Category: Valuation
INSERT INTO dy_questions (category, question, guidance, data_sources, is_dynamic, is_active, sort_order) VALUES
('Valuation', 'Is the stock expensive, cheap, or fairly valued vs. peers?', 'Compare P/E, P/S, P/B to sector average', '["https://simplywall.st/stocks/us/{TICKER}", "https://finance.yahoo.com/quote/{TICKER}/analysis", "https://www.stockanalysis.com/stocks/{TICKER}/", "https://www.finviz.com/quote.ashx?t={TICKER}"]', false, true, 17),
('Valuation', 'Price vs 52-week range: Near high, mid, or low?', 'Context: buying near 52W high = momentum, near low = contrarian', '["https://simplywall.st/stocks/us/{TICKER}", "https://finance.yahoo.com/quote/{TICKER}", "https://www.tradingview.com/chart/?symbol={TICKER}", "This app''s stock detail page"]', false, true, 18),
('Valuation', 'What''s the market expecting? (Is growth priced in?)', 'High multiple = high expectations, low = pessimism or value', '["https://simplywall.st/stocks/us/{TICKER}", "https://finance.yahoo.com/quote/{TICKER}/analysis", "Analyst estimates and price targets", "https://www.stockanalysis.com/stocks/{TICKER}/"]', false, true, 19);

-- Category: Technical & Timing
INSERT INTO dy_questions (category, question, guidance, data_sources, is_dynamic, is_active, sort_order) VALUES
('Technical & Timing', 'What stage is the stock in? (Weinstein Stage 1-4)', 'Stage 2 = uptrend, avoid Stage 4', '["This app''s stock detail page", "https://www.tradingview.com/chart/?symbol={TICKER}", "30-week moving average on chart"]', false, true, 20),
('Technical & Timing', 'Is volume confirming the trend? (Higher volume on up days?)', 'Volume validates price action', '["https://www.tradingview.com/chart/?symbol={TICKER}", "https://finance.yahoo.com/quote/{TICKER}", "Volume indicators on chart"]', false, true, 21),
('Technical & Timing', 'Relative strength: Outperforming or underperforming the market?', 'RS > 1 = beating SPY, < 1 = lagging', '["This app''s stock detail page (RS 6mo)", "https://www.tradingview.com/chart/?symbol={TICKER}", "Compare to SPY chart"]', true, true, 22),
('Technical & Timing', 'Any major catalysts coming? (Earnings, product launch, FDA approval?)', 'Time entry around known events', '["https://finance.yahoo.com/quote/{TICKER}/calendar", "Company investor relations - Events", "Earnings calendar websites"]', true, true, 23);

-- Category: Risk Assessment
INSERT INTO dy_questions (category, question, guidance, data_sources, is_dynamic, is_active, sort_order) VALUES
('Risk Assessment', 'What could go wrong? List 3 bear case scenarios.', 'Steel-man the opposite view', '["https://simplywall.st/stocks/us/{TICKER}", "10-K filing - Risk Factors section", "https://finance.yahoo.com/quote/{TICKER}/news", "Seeking Alpha bear case articles"]', false, true, 24),
('Risk Assessment', 'Regulatory risks? (Government scrutiny, new regulations?)', 'Check industry-specific regulatory landscape', '["https://simplywall.st/stocks/us/{TICKER}", "10-K filing - Risk Factors", "Industry news", "Regulatory body websites (FDA, SEC, etc.)"]', false, true, 25),
('Risk Assessment', 'How concentrated is revenue? (Single customer = high risk)', 'Diversified revenue = lower risk', '["https://simplywall.st/stocks/us/{TICKER}", "10-K filing - Business section", "https://www.stockanalysis.com/stocks/{TICKER}/", "Company investor presentations"]', false, true, 26),
('Risk Assessment', 'Macro risks: Interest rates, inflation, recession exposure?', 'Cyclical stocks suffer in downturns', '["https://simplywall.st/stocks/us/{TICKER}", "10-K filing - Risk Factors", "Economic indicators", "Sector analysis"]', false, true, 27);

-- Category: Personal Conviction
INSERT INTO dy_questions (category, question, guidance, data_sources, is_dynamic, is_active, sort_order) VALUES
('Personal Conviction', 'Do I understand this business well enough to hold through a 30% drop?', 'Conviction test - can you hold through volatility?', '["Your own research notes", "Company understanding"]', false, true, 28),
('Personal Conviction', 'Would I be comfortable holding this for 1+ years?', 'Time horizon alignment check', '["Your investment strategy", "Long-term thesis"]', false, true, 29),
('Personal Conviction', 'Am I buying because of FOMO or genuine conviction?', 'Emotional check - remove recency bias', '["Self-reflection", "Investment journal"]', false, true, 30);

-- Category: Final Exit Plan (ALWAYS LAST)
INSERT INTO dy_questions (category, question, guidance, data_sources, is_dynamic, is_active, sort_order) VALUES
('Final Exit Plan', 'What is my exit plan? (Target price, stop loss, time horizon)', 'Define exit BEFORE entry: Target +X%, Stop -Y%, Review in Z months', '["Your trading plan", "Technical analysis for stop loss", "Price targets from analysis"]', false, true, 100);

-- Verify insertion
SELECT category, COUNT(*) as question_count 
FROM dy_questions 
WHERE is_active = true 
GROUP BY category 
ORDER BY MIN(sort_order);

