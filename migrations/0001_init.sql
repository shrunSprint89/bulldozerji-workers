-- Migration number: 0001 	 2025-05-21T17:52:31.927Z
-- Companies (main table)
DROP TABLE IF EXISTS companies;
DROP TABLE IF EXISTS peer_companies;
DROP TABLE IF EXISTS financial_data;
DROP TABLE IF EXISTS key_metrics;

CREATE TABLE IF NOT EXISTS companies (
    company_id TEXT PRIMARY KEY,
    company_name TEXT NOT NULL,
    industry TEXT NOT NULL,
    exchange_code_bse TEXT,
    exchange_code_nse TEXT,
    percent_change TEXT,
    year_high TEXT,
    year_low TEXT,
    current_price_bse TEXT,
    current_price_nse TEXT,
    company_description TEXT,
    mg_industry TEXT NOT NULL,
    is_in_id TEXT NOT NULL
);

-- Peer Companies (updated primary key)
CREATE TABLE IF NOT EXISTS peer_companies (
    company_id TEXT NOT NULL,
    ticker_id TEXT PRIMARY KEY,
    company_name TEXT NOT NULL,
    price_to_book_value_ratio REAL,
    price_to_earnings_value_ratio REAL,
    market_cap REAL,
    price REAL,
    percent_change REAL,
    net_change REAL,
    return_on_avg_equity_5yr REAL,
    return_on_avg_equity_ttm REAL,
    lt_debt_per_equity_fy REAL,
    net_profit_margin_5yr REAL,
    net_profit_margin_ttm REAL,
    dividend_yield REAL,
    shares_outstanding REAL,
    language_support TEXT,
    image_url TEXT,
    overall_rating TEXT,
    ylow REAL,
    yhigh REAL,
    FOREIGN KEY (company_id) REFERENCES companies(company_id)
);

-- Merged Financial Statements + Metrics (compound primary key)
CREATE TABLE IF NOT EXISTS financial_data (
    company_id TEXT NOT NULL,
    financial_type TEXT CHECK(financial_type IN ('CAS', 'BAL', 'INC')),
    fiscal_year TEXT NOT NULL,
    end_date TEXT NOT NULL,
    statement_date TEXT,
    fiscal_period_number TEXT,
    display_name TEXT,
    financial_key TEXT NOT NULL,
    value TEXT,
    yqoq_comp TEXT,
    qoq_comp TEXT,
    PRIMARY KEY (financial_type, financial_key, fiscal_year, end_date),
    FOREIGN KEY (company_id) REFERENCES companies(company_id)
);

-- Key Metrics (remains unchanged from previous structure)
CREATE TABLE IF NOT EXISTS key_metrics (
    company_id TEXT NOT NULL,
    metric_category TEXT CHECK(metric_category IN ('mgmt_effectiveness', 'margins', 'financial_strength', 'valuation', 'income_statement', 'growth', 'per_share_data', 'price_and_volume')),
    display_name TEXT NOT NULL,
    metric_key TEXT NOT NULL,
    value TEXT,
    PRIMARY KEY (metric_category, metric_key),
    FOREIGN KEY (company_id) REFERENCES companies(company_id)
);
