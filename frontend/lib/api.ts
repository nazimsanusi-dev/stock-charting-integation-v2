import type { ChartData, SheetEntry, Stock } from "./types";

// Matches NEXT_PUBLIC_API_URL in .env.example / .env.local
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

console.log("[api] API_BASE_URL =", API_BASE_URL);

export interface SheetsResponse {
  sheets: SheetEntry[];
}

export interface StocksResponse {
  stocks: Stock[];
}

async function apiFetch(url: string): Promise<Response> {
  console.log("[api] →", url);
  const res = await fetch(url);
  console.log("[api] ←", res.status, res.statusText, url);
  if (!res.ok) {
    const body = await res.text().catch(() => "(no body)");
    console.error("[api] error body:", body);
    throw new Error(`HTTP ${res.status} ${res.statusText} — ${url}\n${body}`);
  }
  return res;
}

export const api = {
  // GET /api/sheets → { sheets: [{url, label}] }
  async sheets(): Promise<SheetsResponse> {
    const res = await apiFetch(`${API_BASE_URL}/api/sheets`);
    const data: SheetsResponse = await res.json();
    console.log("[api] sheets:", data.sheets.length, "entries", data.sheets);
    return data;
  },

  // GET /api/stocks?sheet_url=...&worksheet=... → { stocks: [{name, ticker}] }
  async stocks(sheetUrl: string, worksheet: string = "Stock_List"): Promise<StocksResponse> {
    const query = new URLSearchParams({ sheet_url: sheetUrl, worksheet });
    const res = await apiFetch(`${API_BASE_URL}/api/stocks?${query}`);
    const data: StocksResponse = await res.json();
    console.log("[api] stocks:", data.stocks.length, "entries");
    return data;
  },

  // GET /api/chart?ticker=...&period=...&interval=...&ema_periods=...
  async getChartData(
    ticker: string,
    period: string = "1y",
    interval: string = "1d",
    emaPeriods: number[] = [10, 20, 50],
  ): Promise<ChartData> {
    const query = new URLSearchParams({
      ticker,
      period,
      interval,
      ema_periods: emaPeriods.join(","),
    });
    const res = await apiFetch(`${API_BASE_URL}/api/chart?${query}`);
    const data: ChartData = await res.json();
    console.log("[api] chart:", ticker, "→", data.ohlcv.length, "bars");
    return data;
  },
};