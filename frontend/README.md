# Stock Monitor — Frontend

Next.js 15 frontend for the Stock Monitor app. Provides an interactive UI for browsing stock charts, configuring indicators, and switching between single and grid views.

Deployed as a **static site** on Cloudflare Pages — no server required.

---

## Tech

- **Next.js 15** — App Router, `output: 'export'` (static)
- **TypeScript** — strict mode
- **Tailwind CSS 4** — utility-first styling
- **lightweight-charts v5** (TradingView) — candlestick charts + multi-pane indicators

---

## Project Structure

```
frontend/
├── app/
│   ├── layout.tsx          # Root layout — Inter font, page metadata
│   ├── page.tsx            # Dashboard: holds SidebarParams state, renders Sidebar + chart view
│   └── globals.css         # Tailwind base + shared utility classes (.label, .input, .select)
│
├── components/
│   ├── Sidebar.tsx         # Left panel — sheet selector, stock checklist, view/timeframe/period/indicator controls
│   ├── StockChart.tsx      # lightweight-charts v5 wrapper — candlestick + EMA overlays + indicator panes
│   ├── GridView.tsx        # CSS grid of SingleChart cards for multi-stock view
│   └── OHLCSummary.tsx     # Compact O/H/L/C + volume + % change strip below each chart
│
├── hooks/
│   └── useChartData.ts     # Calls GET /api/chart; returns { data, loading, error, refetch }
│
├── lib/
│   ├── api.ts              # Typed fetch wrapper; base URL from NEXT_PUBLIC_API_URL
│   └── types.ts            # Shared interfaces: ChartData, OHLCVBar, IndicatorData, SidebarParams, etc.
│
├── next.config.ts          # Static export config for Cloudflare Pages
├── tailwind.config.ts      # (auto-generated, Tailwind v4 uses CSS-first config)
├── tsconfig.json
└── .env.example            # NEXT_PUBLIC_API_URL template
```

---

## Local Development

### Prerequisites

- Node.js 20+
- The backend running at `http://localhost:8000` (see [`../backend/README.md`](../backend/README.md))

### Steps

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# .env.local contains: NEXT_PUBLIC_API_URL=http://localhost:8000

# 3. Start dev server
npm run dev
# → http://localhost:3000
```

### Other Commands

```bash
npm run build        # Build static site → out/
npm run start        # Serve built output locally (requires prior build)
```

---

## Key Concepts

### State architecture

All UI state lives in a single `SidebarParams` object in `app/page.tsx`:

```typescript
interface SidebarParams {
  selectedSheet: SheetEntry | null;
  worksheet: string;
  selectedStocks: Stock[];
  viewMode: "single" | "grid";
  timeframe: "1d" | "1wk" | "1mo";
  period: string;
  chartConfig: {
    emaPeriods: number[];
    showRsi: boolean;
    showMacd: boolean;
    showCvd: boolean;
    showCmf: boolean;
  };
}
```

`<Sidebar onChange={setParams}>` calls `onChange` with the full updated object — no prop drilling, no external state library.

### Chart rendering

`StockChart.tsx` lazy-imports `lightweight-charts` (browser-only library) inside a `useEffect`:

```typescript
import("lightweight-charts").then(({ createChart, CandlestickSeries, LineSeries, ... }) => {
  const chart = createChart(containerRef.current, options);

  // Main pane: candlestick + EMA line series
  chart.addSeries(CandlestickSeries, { ... });

  // Sub-panes (if enabled): each indicator gets chart.addPane()
  const rsiPane = chart.addPane();
  rsiPane.addSeries(LineSeries, { color: "#9C27B0", ... });
});
```

Never import `lightweight-charts` at the module level — it breaks SSR.

### API client

All backend calls go through `lib/api.ts`:

```typescript
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const api = {
  sheets: () => get("/api/sheets"),
  stocks: (sheetUrl, worksheet) => get("/api/stocks", { sheet_url, worksheet }),
  chart: (ticker, period, interval, emaPeriods) => get("/api/chart", { ... }),
};
```

---

## Cloudflare Pages Deployment

```bash
# Build static output
NEXT_PUBLIC_API_URL=https://your-worker.workers.dev npm run build

# Deploy (first run creates the Pages project)
npx wrangler pages deploy out --project-name=stock-monitor
```

**Cloudflare Pages settings:**
| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Build output directory | `out` |
| Root directory | `frontend` |
| Environment variable | `NEXT_PUBLIC_API_URL` = your Worker URL |

---

## Color Palette

| Usage | Hex |
|---|---|
| Candle up | `#26A69A` |
| Candle down | `#EF5350` |
| RSI | `#9C27B0` |
| MACD line | `#2196F3` |
| MACD signal | `#FF9800` |
| CVD | `#00BCD4` |
| CMF | `#4CAF50` |
| Grid lines | `#F0F0F0` |

EMA periods cycle through: `#2196F3` → `#FF9800` → `#9C27B0` → `#E91E63` → `#00BCD4` → `#8BC34A`
