# Stock Monitor — Backend

FastAPI backend for the Stock Monitor app. Fetches stock data from Yahoo Finance and stock lists from Google Sheets, calculates technical indicators, and returns JSON to the frontend.

Deployed as a **Cloudflare Workers Python** app — serverless, no infrastructure to manage.

---

## Tech

- **FastAPI** — async Python web framework, auto-generates `/docs`
- **httpx** — async HTTP client for Yahoo Finance + Google Sheets API
- **PyJWT[crypto]** — Google OAuth2 service account JWT signing
- **numpy** — technical indicator calculations (EMA, RSI, MACD, CVD, CMF)
- **Cloudflare Workers Python** — runtime via Pyodide (compatible with above packages)

---

## Project Structure

```
backend/
├── worker.py                    # Cloudflare Workers entry point
│                                # Exposes `on_fetch(request, env)` handler
│                                # Copies env secret bindings → os.environ
│
├── src/
│   ├── main.py                  # FastAPI app instance + CORS + router registration
│   ├── config.py                # Settings class; reads SHEET_URLS, SHEET_LABELS,
│   │                            # GCP_SERVICE_ACCOUNT from os.environ (JSON strings)
│   ├── models.py                # Pydantic models: OHLCVBar, IndicatorData, ChartResponse
│   ├── worker_adapter.py        # ASGI adapter: translates Workers request/response
│   │                            # to/from ASGI scope/receive/send protocol
│   │
│   ├── routers/
│   │   ├── sheets.py            # GET /api/sheets  — list configured spreadsheets
│   │   │                        # GET /api/stocks  — stock list from a sheet
│   │   │                        # GET /api/worksheets — tab names in a spreadsheet
│   │   └── stocks.py            # GET /api/chart   — OHLCV + all indicators
│   │
│   └── services/
│       ├── yahoo_service.py     # Calls Yahoo Finance v8 API via httpx
│       │                        # Parses timestamps, OHLCV arrays → list[OHLCVBar]
│       ├── sheets_service.py    # Google Sheets REST API v4 via httpx
│       │                        # Handles JWT auth (service account → access token)
│       └── indicators.py        # Pure numpy: EMA, RSI(14), MACD(12,26,9),
│                                # CVD (candle-direction approximation), CMF(20)
│
├── requirements.txt             # Python dependencies (local dev + Cloudflare Workers)
├── wrangler.toml                # Workers project config (name, entry, compat flags)
└── .dev.vars.example            # Template for local secrets file
```

---

## Local Development

### Prerequisites

- Python 3.11+
- A GCP service account JSON key
- A Google Sheet with `Stock_Name` / `Ticker_Code` columns

### Steps

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Set up local secrets
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars` and fill in:

```bash
SHEET_URLS='["https://docs.google.com/spreadsheets/d/YOUR_ID/edit"]'
SHEET_LABELS='["My Stocks"]'
GCP_SERVICE_ACCOUNT='{"type":"service_account","project_id":"...","private_key":"-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n","client_email":"...@....iam.gserviceaccount.com",...}'
```

```bash
# 3. Export env vars and start server
export $(grep -v '^#' .dev.vars | xargs)
uvicorn src.main:app --reload --port 8000

# API: http://localhost:8000
# Docs: http://localhost:8000/docs
```

---

## API Endpoints

### `GET /health`
Quick liveness check.
```json
{ "status": "ok" }
```

---

### `GET /api/sheets`
Lists all Google Sheets configured via env vars (`SHEET_URLS` / `SHEET_LABELS`).
```json
{
  "sheets": [
    { "url": "https://docs.google.com/spreadsheets/d/ABC/edit", "label": "My Stocks" }
  ]
}
```

---

### `GET /api/stocks`
Fetches the stock list from a specific Google Sheet + worksheet.

| Parameter | Required | Default | Description |
|---|---|---|---|
| `sheet_url` | ✅ | — | Full Google Sheets URL |
| `worksheet` | ❌ | `Stock_List` | Tab name inside the spreadsheet |

```json
{
  "stocks": [
    { "name": "Maybank", "ticker": "1155.KL" },
    { "name": "Apple", "ticker": "AAPL" }
  ]
}
```

---

### `GET /api/worksheets`
Lists all tab names inside a spreadsheet (useful for sheet switching).

| Parameter | Required | Description |
|---|---|---|
| `sheet_url` | ✅ | Full Google Sheets URL |

```json
{ "worksheets": ["Stock_List", "Watchlist", "Archived"] }
```

---

### `GET /api/chart`
Returns OHLCV bars + all technical indicators for a ticker.

| Parameter | Required | Default | Options |
|---|---|---|---|
| `ticker` | ✅ | — | `1155.KL`, `AAPL`, `D05.SI`, `0700.HK` |
| `period` | ❌ | `1y` | `3mo` `6mo` `1y` `2y` `5y` `max` |
| `interval` | ❌ | `1d` | `1d` `1wk` `1mo` |
| `ema_periods` | ❌ | `10,20,50` | comma-separated integers |

```json
{
  "ticker": "1155.KL",
  "ohlcv": [
    { "time": 1704067200, "open": 8.50, "high": 8.70, "low": 8.40, "close": 8.60, "volume": 1200000.0 }
  ],
  "indicators": {
    "ema": {
      "10":  [null, null, ..., 8.55, 8.57],
      "20":  [null, null, ..., 8.42, 8.44],
      "50":  [null, null, ..., 8.30, 8.32]
    },
    "rsi":             [null, ..., 62.4, 63.1],
    "macd":            [null, ..., 0.12, 0.14],
    "macd_signal":     [null, ..., 0.10, 0.11],
    "macd_histogram":  [null, ..., 0.02, 0.03],
    "cvd":             [150000, 320000, ..., 1800000],
    "cmf":             [null, ..., 0.18, 0.22]
  }
}
```

`time` values are Unix timestamps (seconds).  
`null` entries appear at the start of a series while the indicator accumulates enough data.

---

## Indicator Formulas

| Indicator | Formula | Lookback |
|---|---|---|
| EMA(n) | Exponential moving average | n bars |
| RSI | Wilder's RSI using EMA of gains/losses | 14 bars |
| MACD | EMA(12) − EMA(26); signal = EMA(9) of MACD | 34 bars |
| CVD | Cumulative sum of `+volume` (bull candle) / `−volume` (bear candle) | 1 bar |
| CMF | Σ(MFV, 20) / Σ(Volume, 20) where MFV = MFM × Volume | 20 bars |

---

## Cloudflare Workers Deployment

### First-time setup

```bash
npm install -g wrangler
wrangler login
```

### Set secrets

```bash
cd backend

wrangler secret put SHEET_URLS
# Paste: '["https://docs.google.com/spreadsheets/d/YOUR_ID/edit"]'

wrangler secret put SHEET_LABELS
# Paste: '["My Stock List"]'

wrangler secret put GCP_SERVICE_ACCOUNT
# Paste: the full single-line GCP service account JSON
```

### Deploy

```bash
wrangler deploy
# → https://stock-monitor-api.YOUR-ACCOUNT.workers.dev
```

### Test the deployment

```bash
curl https://stock-monitor-api.YOUR-ACCOUNT.workers.dev/health
# → {"status":"ok"}

curl "https://stock-monitor-api.YOUR-ACCOUNT.workers.dev/api/chart?ticker=AAPL&period=3mo"
# → { ticker, ohlcv, indicators }
```

---

## How Cloudflare Workers Python Works

```
Cloudflare Edge
      │
      │  HTTP request
      ▼
worker.py: on_fetch(request, env)
      │
      │  1. Copies env bindings → os.environ
      │  2. Calls handle_asgi(app, request, env)
      ▼
worker_adapter.py: handle_asgi()
      │
      │  Translates Workers request → ASGI scope/receive/send
      │  Awaits FastAPI to process the request
      │  Translates FastAPI response → Workers Response
      ▼
src/main.py: FastAPI app
      │
      │  Routes request to appropriate router
      ▼
src/routers/{sheets,stocks}.py
      │
      │  Calls services
      ▼
src/services/{yahoo,sheets,indicators}.py
      │
      │  Makes async HTTP calls (don't count toward CPU time limit)
      │  Computes indicators with numpy
      ▼
JSON response returned up the chain
```

**Cloudflare Workers free tier limits:**  
- 100,000 requests / day  
- 10ms CPU time per request (I/O like HTTP calls does not count)

---

## Environment Variables

| Variable | Format | Description |
|---|---|---|
| `SHEET_URLS` | JSON array string | `'["https://docs.google.com/..."]'` |
| `SHEET_LABELS` | JSON array string | `'["My Stocks"]'` |
| `GCP_SERVICE_ACCOUNT` | JSON object string | Full service account key (single line) |

All three are set via `wrangler secret put` in production, or exported from `.dev.vars` locally.
