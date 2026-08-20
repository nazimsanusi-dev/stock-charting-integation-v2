import type {
  ChartData,
  SheetEntry,
  Stock,
  TableData,
  SubsectorRank,
  SubsectorBulkOHLC,
  SubsectorHeatmapItem,
  SubsectorStockItem,
  AddMonitoringPayload,
} from "./types";

export type MarketType = "MY" | "US";

// Matches NEXT_PUBLIC_API_URL in .env.example / .env.local
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface SheetsResponse {
  sheets: SheetEntry[];
}

export interface StocksResponse {
  stocks: Stock[];
}

export interface WorksheetsResponse {
  worksheets: string[];
}

export interface TableDataResponse {
  headers: string[];
  rows: string[][];
}

async function apiFetch(url: string): Promise<Response> {
  const res = await fetch(url);
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
    return data;
  },

  // GET /api/worksheets?sheet_url=... → { worksheets: [...] }
  async worksheets(sheetUrl: string): Promise<WorksheetsResponse> {
    const query = new URLSearchParams({ sheet_url: sheetUrl });
    const res = await apiFetch(`${API_BASE_URL}/api/worksheets?${query}`);
    return res.json();
  },

  // GET /api/stocks?sheet_url=...&worksheet=... → { stocks: [{name, ticker}] }
  async stocks(sheetUrl: string, worksheet: string = "Name"): Promise<StocksResponse> {
    const query = new URLSearchParams({ sheet_url: sheetUrl, worksheet });
    const res = await apiFetch(`${API_BASE_URL}/api/stocks?${query}`);
    const data: StocksResponse = await res.json();
    return data;
  },

  // GET /api/chart?ticker=...&period=...&interval=...&ema_periods=...
  async getChartData(
    ticker: string,
    period: string = "1y",
    interval: string = "1d",
    emaPeriods: number[] = [5, 10, 20, 50, 100, 200],
  ): Promise<ChartData> {
    const query = new URLSearchParams({
      ticker,
      period,
      interval,
      ema_periods: emaPeriods.join(","),
    });
    const res = await apiFetch(`${API_BASE_URL}/api/chart?${query}`);
    const data: ChartData = await res.json();
    return data;
  },

  // GET /api/table?sheet_url=...&worksheet=... → { headers: [...], rows: [[...]] }
  async tableData(sheetUrl: string, worksheet: string): Promise<TableData> {
    const query = new URLSearchParams({ sheet_url: sheetUrl, worksheet });
    const res = await apiFetch(`${API_BASE_URL}/api/table?${query}`);
    const data: TableData = await res.json();
    return data;
  },

  /**
   * Tarik senarai ranking subsektor terkini (MY / US)
   */
  async subsectorRanks(market: MarketType = "MY"): Promise<SubsectorRank[]> {
    const params = new URLSearchParams({ market });
    const res = await fetch(`${API_BASE_URL}/api/subsector_ranks?${params.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Gagal mengambil data subsector_ranks");
    return res.json();
  },

  /**
   * Tarik data pukal OHLC (Base 100) bagi semua subsektor (MY / US)
   */
  async subsectorBulkOHLC(market: MarketType = "MY"): Promise<SubsectorBulkOHLC> {
    const params = new URLSearchParams({ market });
    const res = await fetch(`${API_BASE_URL}/api/subsector_ohlc/bulk?${params.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Gagal mengambil data subsector_ohlc");
    return res.json();
  },

  /**
   * Tarik data gabungan sektor/subsektor untuk Heatmap (MY / US)
   */
  async subsectorHeatmap(market: MarketType = "MY"): Promise<SubsectorHeatmapItem[]> {
    const params = new URLSearchParams({ market });
    const res = await fetch(`${API_BASE_URL}/api/subsector_heatmap?${params.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Gagal mengambil data subsector_heatmap");
    return res.json();
  },

  /**
   * Tarik senarai saham di bawah subsektor (MY / US)
   */
  async subsectorStocks(
    subsectorName: string = "",
    search: string = "",
    minPrice: string = "0.3",
    market: MarketType = "MY",
  ): Promise<SubsectorStockItem[]> {
    const params = new URLSearchParams({ market });
    if (subsectorName && subsectorName !== "All Stock") params.set("subsector", subsectorName);
    if (search) params.set("search", search);
    if (minPrice) params.set("min_price", minPrice);

    const res = await fetch(`${API_BASE_URL}/api/subsector-stocks?${params.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Gagal mengambil senarai saham subsektor");
    const data = await res.json();
    return data.stocks ?? [];
  },

  /**
   * Tarik data tunggal OHLC bagi subsektor tertentu (MY / US)
   */
  subsectorSingleOHLC: async (
    subsectorId: number | string,
    market: MarketType = "MY",
  ): Promise<ChartData> => {
    const params = new URLSearchParams({ market });
    const res = await fetch(`${API_BASE_URL}/api/subsector_ohlc/${subsectorId}?${params.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Gagal memuatkan data carta subsektor.");
    return res.json();
  },

  addToMonitoring: async (payload: AddMonitoringPayload) => {
    const res = await fetch(`${API_BASE_URL}/api/monitoring/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Gagal menambah ke database");
    }
    return res.json();
  },

  monitoringTableData: async (): Promise<{ headers: string[]; rows: string[][] }> => {
    const res = await fetch(`${API_BASE_URL}/api/monitoring/table`, {
      cache: "no-store",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Gagal memuatkan data monitoring");
    }
    return res.json();
  },
};