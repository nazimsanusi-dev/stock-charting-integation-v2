# Copilot Instructions

## Running Locally

```bash
# Backend (FastAPI) — port 8000
cd backend && pip install -r requirements.txt
uvicorn src.main:app --reload --port 8000

# Frontend (Next.js) — port 3000
cd frontend && npm install
npm run dev
```

## Architecture

```
frontend/   → Next.js 15 (static export) → Cloudflare Pages
backend/    → FastAPI (Python 3.11)       → Cloudflare Workers (Python)
```

### Backend layers (strict separation)

```
backend/
├── worker.py              # Cloudflare Workers entry point (on_fetch)
├── src/
│   ├── main.py            # FastAPI app + CORS
│   ├── config.py          # Settings read from os.environ
│   ├── models.py          # Pydantic response models
│   ├── worker_adapter.py  # ASGI ↔ Cloudflare Workers bridge
│   ├── routers/
│   │   ├── sheets.py      # GET /api/sheets, /api/stocks, /api/worksheets
│   │   └── stocks.py      # GET /api/chart
│   └── services/
│       ├── yahoo_service.py   # Yahoo Finance v8 API (httpx, no yfinance)
│       ├── sheets_service.py  # Google Sheets REST API (httpx + PyJWT, no gspread)
│       └── indicators.py      # numpy-based TA: EMA, RSI, MACD, CVD, CMF
```

- **`services/`** — pure data/computation; no FastAPI types, no UI
- **`routers/`** — HTTP concerns only; call services, return JSON
- **`worker.py`** — Cloudflare Workers entry; copies env bindings → `os.environ`

### Frontend structure

```
frontend/
├── app/page.tsx            # Main dashboard (client component)
├── components/
│   ├── Sidebar.tsx         # Controls; calls api.sheets() + api.stocks() on mount
│   ├── StockChart.tsx      # lightweight-charts (lazy-imported); synced sub-charts
│   ├── GridView.tsx        # Grid of SingleChart instances
│   └── OHLCSummary.tsx     # Last-bar OHLC display bar
├── hooks/useChartData.ts   # Calls api.chart(); returns {data, loading, error}
└── lib/
    ├── api.ts              # fetch wrapper; BASE_URL from NEXT_PUBLIC_API_URL
    └── types.ts            # Shared TypeScript interfaces
```

## Key Conventions

### Backend — no non-Pyodide packages
`yahoo_service.py` calls Yahoo Finance API directly via `httpx` (no `yfinance`).  
`sheets_service.py` calls Google Sheets REST API via `httpx` + `PyJWT` (no `gspread`).  
`indicators.py` uses only `numpy` (no `pandas-ta`).

### Backend — all functions are async
```python
async def fetch_ohlcv(ticker: str, period: str = "1y", interval: str = "1d") -> list[OHLCVBar]:
```

### Frontend — lightweight-charts is lazy-imported (browser-only)
```typescript
import("lightweight-charts").then(({ createChart, ... }) => { ... })
```
Never import it at the module level — SSR will break.

### Frontend — SidebarParams is the single state container
`app/page.tsx` holds one `useState<SidebarParams>` and passes it to `<Sidebar onChange>`.  
`Sidebar` calls `onChange` with the full updated object.

### API base URL via env var
```typescript
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
```
Set `NEXT_PUBLIC_API_URL` in `frontend/.env.local` for dev or as GitHub secret for CI.

### Cloudflare Workers secrets
Backend secrets set via `wrangler secret put`:
- `SHEET_URLS` — JSON array of spreadsheet URLs
- `SHEET_LABELS` — JSON array of display labels
- `GCP_SERVICE_ACCOUNT` — full service account JSON (single line)

`worker.py` copies these bindings into `os.environ` before the FastAPI app initialises.

## Adding a New Indicator

1. **`services/indicators.py`** — add numpy calculation, include in `calculate_all()` return dict
2. **`lib/types.ts`** — add field to `IndicatorData`
3. **`components/Sidebar.tsx`** — add checkbox, wire to `chartConfig`
4. **`components/StockChart.tsx`** — add sub-chart creation inside `addSubChart()` block
5. **`routers/stocks.py`** — no change needed (indicators dict is passed through)

## Ticker Code Format

| Exchange | Format | Example |
|---|---|---|
| Bursa Malaysia | `{number}.KL` | `1155.KL` |
| US (NYSE/NASDAQ) | `{symbol}` | `AAPL` |
| SGX | `{symbol}.SI` | `D05.SI` |
| HKEX | `{number}.HK` | `0700.HK` |

## Color Palette

```
Candle up:  #26A69A   Candle down: #EF5350
RSI:        #9C27B0   MACD:        #2196F3
MACD sig:   #FF9800   CVD:         #00BCD4
CMF:        #4CAF50   Grid:        #F0F0F0
```

EMA colors rotate through: `#2196F3 #FF9800 #9C27B0 #E91E63 #00BCD4 #8BC34A`
