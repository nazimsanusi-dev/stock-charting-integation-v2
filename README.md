# 📈 Stock Monitor

A lightweight, self-hosted stock price monitor for Bursa Malaysia and global equities. No TradingView subscription required — just a Google Sheet as your stock list and Yahoo Finance as your data source.

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi)
![Cloudflare](https://img.shields.io/badge/Cloudflare-Free_Tier-F38020?logo=cloudflare)

---

## ✨ Features

- 📊 Interactive candlestick charts (zoom, pan, hover)
- 📈 Technical indicators — EMA, RSI (14), MACD, CVD, CMF (20)
- 🗂️ Multi-sheet support — switch between multiple Google Sheets
- 👁️ Single chart or multi-stock grid view
- ⏱️ Timeframes — Daily, Weekly, Monthly
- 📅 Periods — 3M, 6M, 1Y, 2Y, 5Y, Max
- 💾 Stock list managed in Google Sheets (no database needed)
- 🚀 Fully hosted on Cloudflare free tier

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLOUDFLARE FREE TIER                         │
│                                                                     │
│   ┌─────────────────────────┐    ┌──────────────────────────────┐  │
│   │    Cloudflare Pages     │    │    Cloudflare Workers        │  │
│   │                         │    │    (Python runtime)          │  │
│   │  Next.js 15             │    │                              │  │
│   │  ├─ app/page.tsx        │───▶│  FastAPI                     │  │
│   │  ├─ components/         │    │  ├─ GET /api/sheets          │  │
│   │  │   ├─ Sidebar         │    │  ├─ GET /api/stocks          │  │
│   │  │   ├─ StockChart      │    │  └─ GET /api/chart           │  │
│   │  │   ├─ GridView        │    │                              │  │
│   │  │   └─ OHLCSummary     │    │  Services                    │  │
│   │  ├─ hooks/              │    │  ├─ yahoo_service.py         │  │
│   │  └─ lib/api.ts          │    │  ├─ sheets_service.py        │  │
│   │                         │    │  └─ indicators.py            │  │
│   └─────────────────────────┘    └──────────┬───────────────────┘  │
│                                             │                       │
└─────────────────────────────────────────────┼───────────────────────┘
                                              │
                          ┌───────────────────┼───────────────────┐
                          │                   │                   │
                 ┌────────▼───────┐  ┌────────▼──────┐  ┌────────▼──────┐
                 │  Yahoo Finance │  │ Google Sheets │  │  (computed)   │
                 │  v8 API        │  │  REST API v4  │  │  Indicators   │
                 │  (OHLCV data)  │  │  (stock list) │  │  (numpy)      │
                 └────────────────┘  └───────────────┘  └───────────────┘
```

### Directory Structure

```
stock-charting-integration/
├── frontend/                        # Next.js app → Cloudflare Pages
│   ├── app/
│   │   ├── layout.tsx               # Root layout (Inter font, metadata)
│   │   ├── page.tsx                 # Main dashboard (single state root)
│   │   └── globals.css              # Tailwind base + shared .label/.input/.select
│   ├── components/
│   │   ├── Sidebar.tsx              # Sheet selector, stock checklist, controls
│   │   ├── StockChart.tsx           # lightweight-charts v5 candlestick + indicators
│   │   ├── GridView.tsx             # CSS grid of multiple StockChart instances
│   │   └── OHLCSummary.tsx          # Last-bar OHLC/volume/change strip
│   ├── hooks/
│   │   └── useChartData.ts          # Fetches /api/chart; returns {data, loading, error}
│   ├── lib/
│   │   ├── api.ts                   # fetch wrapper; BASE_URL = NEXT_PUBLIC_API_URL
│   │   └── types.ts                 # Shared TypeScript interfaces
│   ├── next.config.ts               # output: 'export' + trailingSlash for CF Pages
│   └── .env.example                 # NEXT_PUBLIC_API_URL template
│
├── backend/                         # FastAPI app → Cloudflare Workers (Python)
│   ├── worker.py                    # Workers entry point: on_fetch handler
│   ├── src/
│   │   ├── main.py                  # FastAPI app + CORS middleware
│   │   ├── config.py                # Settings from os.environ
│   │   ├── models.py                # Pydantic response models
│   │   ├── worker_adapter.py        # ASGI ↔ Cloudflare Workers bridge
│   │   ├── routers/
│   │   │   ├── sheets.py            # /api/sheets, /api/stocks, /api/worksheets
│   │   │   └── stocks.py            # /api/chart
│   │   └── services/
│   │       ├── yahoo_service.py     # Yahoo Finance v8 API (httpx)
│   │       ├── sheets_service.py    # Google Sheets REST + PyJWT auth (httpx)
│   │       └── indicators.py        # EMA, RSI, MACD, CVD, CMF (numpy)
│   ├── requirements.txt             # Python dependencies
│   ├── wrangler.toml                # Cloudflare Workers config
│   └── .dev.vars.example            # Local secrets template
│
├── .github/
│   ├── copilot-instructions.md      # AI assistant conventions
│   └── workflows/
│       ├── deploy-frontend.yml      # Push → Cloudflare Pages
│       └── deploy-backend.yml       # Push → Cloudflare Workers
│
└── .devcontainer/devcontainer.json  # VS Code / Codespaces dev environment
```

### Data Flow

```
User selects stock in Sidebar
        │
        ▼
useChartData hook  →  GET /api/chart?ticker=1155.KL&period=1y&interval=1d&ema_periods=10,20,50
                                │
                       FastAPI router (stocks.py)
                                │
                    ┌───────────┴────────────┐
                    ▼                        ▼
           yahoo_service.py          indicators.py
           (fetch OHLCV from         (calc EMA, RSI,
            Yahoo Finance v8)         MACD, CVD, CMF
                    │                 using numpy)
                    └───────────┬────────────┘
                                ▼
                    JSON response: { ticker, ohlcv[], indicators{} }
                                │
                       StockChart component
                       (lightweight-charts v5)
                       ├─ Candlestick series (pane 0)
                       ├─ EMA line overlays  (pane 0)
                       ├─ RSI sub-pane       (pane 1, if enabled)
                       ├─ MACD sub-pane      (pane 2, if enabled)
                       ├─ CVD sub-pane       (pane 3, if enabled)
                       └─ CMF sub-pane       (pane 4, if enabled)
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites

- Python 3.11+
- Node.js 20+
- A Google Cloud service account with Sheets + Drive API access
- A Google Sheet with `Stock_Name` (col A) and `Ticker_Code` (col B)

### Step 1 — Clone & enter the repo

```bash
git clone https://github.com/nazimsanusi-dev/stock-charting-integration.git
cd stock-charting-integration
```

### Step 2 — Set up the Backend

```bash
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Copy secrets template and fill in your credentials
cp .dev.vars.example .dev.vars
# Edit .dev.vars — add your GCP service account JSON and Google Sheet URLs

# Start FastAPI dev server
uvicorn src.main:app --reload --port 8000
```

API is now live at **http://localhost:8000**  
Interactive docs at **http://localhost:8000/docs**

### Step 3 — Set up the Frontend

Open a second terminal:

```bash
cd frontend

# Install Node dependencies
npm install

# Copy env template
cp .env.example .env.local
# .env.local already has: NEXT_PUBLIC_API_URL=http://localhost:8000

# Start Next.js dev server
npm run dev
```

App is now live at **http://localhost:3000**

---

## 🗂️ Google Sheet Setup

1. Create a Google Sheet with this structure:

   | A (Stock_Name) | B (Ticker_Code) |
   |---|---|
   | Maybank | 1155.KL |
   | CIMB | 1023.KL |
   | Apple | AAPL |
   | DBS | D05.SI |

2. Row 1 must be the header row (`Stock_Name`, `Ticker_Code`)
3. The default worksheet name is `Stock_List` (configurable)

**Ticker format by exchange:**

| Exchange | Format | Example |
|---|---|---|
| Bursa Malaysia | `{number}.KL` | `1155.KL` |
| US (NYSE / NASDAQ) | `{symbol}` | `AAPL` |
| Singapore (SGX) | `{symbol}.SI` | `D05.SI` |
| Hong Kong (HKEX) | `{number}.HK` | `0700.HK` |

---

## ☁️ Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com) → create or select a project
2. Enable **Google Sheets API** and **Google Drive API**
3. Go to **IAM & Admin → Service Accounts** → create a service account
4. Create a JSON key → download it
5. Share your Google Sheet with the service account's email address (Viewer role)
6. Minify the JSON to a single line — you'll use it as `GCP_SERVICE_ACCOUNT`

---

## ☁️ Cloudflare Deployment

### Step 1 — Install Wrangler CLI

```bash
npm install -g wrangler
wrangler login   # opens browser to authenticate with Cloudflare
```

### Step 2 — Deploy the Backend (Cloudflare Workers Python)

```bash
cd backend

# Set secrets — paste values when prompted
wrangler secret put SHEET_URLS
# Enter: '["https://docs.google.com/spreadsheets/d/YOUR_ID/edit"]'

wrangler secret put SHEET_LABELS
# Enter: '["My Stock List"]'

wrangler secret put GCP_SERVICE_ACCOUNT
# Enter: the full single-line service account JSON

# Deploy
wrangler deploy
# Workers URL: https://stock-monitor-api.YOUR-ACCOUNT.workers.dev
```

### Step 3 — Deploy the Frontend (Cloudflare Pages)

```bash
cd frontend

# Build static site (uses NEXT_PUBLIC_API_URL from env)
NEXT_PUBLIC_API_URL=https://stock-monitor-api.YOUR-ACCOUNT.workers.dev npm run build

# Deploy to Cloudflare Pages (first time creates the project)
wrangler pages deploy out --project-name=stock-monitor
# Pages URL: https://stock-monitor.pages.dev
```

### Step 4 — Set up CI/CD (GitHub Actions)

Add these secrets to your GitHub repository (**Settings → Secrets → Actions**):

| Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | API token with **Workers Scripts Edit** + **Pages Edit** permissions |
| `CLOUDFLARE_ACCOUNT_ID` | Found on Cloudflare dashboard right sidebar |
| `NEXT_PUBLIC_API_URL` | Your Worker URL from Step 2 |

After this, every push to `main` will:
- Auto-deploy the backend if anything in `backend/` changed
- Auto-deploy the frontend if anything in `frontend/` changed

---

## 🔌 API Reference

All endpoints return JSON.

### `GET /health`
```json
{ "status": "ok" }
```

### `GET /api/sheets`
Returns configured sheet entries (from `SHEET_URLS` / `SHEET_LABELS` env vars).
```json
{
  "sheets": [
    { "url": "https://docs.google.com/...", "label": "My Stocks" }
  ]
}
```

### `GET /api/stocks`
| Query param | Required | Example |
|---|---|---|
| `sheet_url` | ✅ | `https://docs.google.com/spreadsheets/d/...` |
| `worksheet` | ❌ (default: `Stock_List`) | `Sheet1` |

```json
{
  "stocks": [
    { "name": "Maybank", "ticker": "1155.KL" },
    { "name": "Apple",   "ticker": "AAPL" }
  ]
}
```

### `GET /api/chart`
| Query param | Required | Default | Options |
|---|---|---|---|
| `ticker` | ✅ | — | `1155.KL`, `AAPL`, etc. |
| `period` | ❌ | `1y` | `3mo` `6mo` `1y` `2y` `5y` `max` |
| `interval` | ❌ | `1d` | `1d` `1wk` `1mo` |
| `ema_periods` | ❌ | `10,20,50` | comma-separated integers |

```json
{
  "ticker": "1155.KL",
  "ohlcv": [
    { "time": 1704067200, "open": 8.50, "high": 8.70, "low": 8.40, "close": 8.60, "volume": 1200000 }
  ],
  "indicators": {
    "ema": { "10": [null, ..., 8.55], "20": [...], "50": [...] },
    "rsi": [null, ..., 62.4],
    "macd": [...], "macd_signal": [...], "macd_histogram": [...],
    "cvd": [...],
    "cmf": [...]
  }
}
```

---

## 🛠️ Tech Stack

| | Technology | Why |
|---|---|---|
| **Frontend framework** | Next.js 15 (App Router) | Static export, React Server Components |
| **Styling** | Tailwind CSS 4 | Utility-first, no stylesheet bloat |
| **Charts** | lightweight-charts v5 (TradingView) | Financial-grade, interactive, lightweight |
| **Backend framework** | FastAPI | Async Python, auto-docs, Pydantic validation |
| **HTTP client** | httpx | Async HTTP for Yahoo Finance + Sheets API |
| **JWT auth** | PyJWT[crypto] | Google OAuth2 service account JWT signing |
| **Indicators** | numpy | Pure math — no pandas-ta dependency (Pyodide-compatible) |
| **Frontend hosting** | Cloudflare Pages | Free, global CDN, auto-deploys from Git |
| **Backend hosting** | Cloudflare Workers (Python) | Serverless, free 100k req/day |

---

## 🎨 Design

Minimalist, Muji-inspired color palette:

| Element | Color |
|---|---|
| Candle Up | `#26A69A` (teal) |
| Candle Down | `#EF5350` (soft red) |
| Background | `#FFFFFF` |
| Grid | `#F0F0F0` |
| Text | `#424242` |
| RSI | `#9C27B0` |
| MACD | `#2196F3` |
| MACD Signal | `#FF9800` |
| CVD | `#00BCD4` |
| CMF | `#4CAF50` |

EMA lines cycle through: `#2196F3` → `#FF9800` → `#9C27B0` → `#E91E63` → `#00BCD4` → `#8BC34A`

---

## 🐛 Troubleshooting

**Backend: `Google credentials not configured`**  
→ `GCP_SERVICE_ACCOUNT` env var is missing or empty. Check `.dev.vars` (local) or Wrangler secrets (production).

**Backend: Yahoo Finance returns no data**  
→ The ticker format may be wrong. Double-check the exchange suffix (`.KL`, `.SI`, `.HK`).

**Frontend: Charts not showing**  
→ Confirm the backend is running at `NEXT_PUBLIC_API_URL`. Check browser console for CORS or fetch errors.

**Workers deploy: `python_workers` flag not found**  
→ Ensure `wrangler` CLI is up to date: `npm install -g wrangler@latest`
