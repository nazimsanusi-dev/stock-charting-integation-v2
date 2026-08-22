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

// Sanitasi asas URL backend (buang trailing slash)
const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
).replace(/\/+$/, "");

const APP_KEY = process.env.NEXT_PUBLIC_APP_KEY || "";
const DEFAULT_TIMEOUT_MS = 12000; // 12 saat timeout automatik

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

/**
 * Sanitasi & Validasi Input (Menyekat aksara berbahaya / kawalan sebelum dihantar)
 */
function sanitizeInput(val: string | number | undefined | null): string {
  if (val === null || val === undefined) return "";
  // Buang aksara kawalan tidak sah, hadkan panjang teks input
  return String(val).replace(/[\x00-\x1F\x7F]/g, "").trim().slice(0, 200);
}

function sanitizeUrl(urlStr: string): string {
  const clean = sanitizeInput(urlStr);
  if (!clean) return "";
  // Pastikan hanya skema http/https dibenarkan
  if (!/^https?:\/\//i.test(clean)) return "";
  return clean;
}

/**
 * Wrapper Fetch Berpusat dengan Kawalan Keselamatan:
 * 1. AbortController Timeout (Elak hanging connection)
 * 2. Custom App Key Injection
 * 3. Sanitasi Ralat (Tidak mendedahkan stack trace pelayan)
 */
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_TIME_OUT_MS_WRAPPER
): Promise<T> {
  const targetUrl = endpoint.startsWith("http")
    ? endpoint
    : `${API_BASE_URL}${endpoint}`;

  // AbortController untuk had masa panggilan
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.headers as Record<string, string>),
  };

  // Suntik kunci jika wujud
  if (APP_KEY) {
    headers["X-App-Key"] = APP_KEY;
  }

  try {
    const res = await fetch(targetUrl, {
      ...options,
      signal: options.signal || controller.signal,
      headers,
    });

    if (!res.ok) {
      const errorBody = await res.text().catch(() => "");
      
      // Log ralat hanya di fasa development
      if (process.env.NODE_ENV !== "production") {
        console.error(`[API Error] ${res.status} on ${targetUrl}:`, errorBody);
      }

      let parsedMessage = `Ralat pelayan (${res.status})`;
      try {
        const jsonErr = JSON.parse(errorBody);
        if (jsonErr.error || jsonErr.message) {
          parsedMessage = sanitizeInput(jsonErr.error || jsonErr.message);
        }
      } catch {
        if (errorBody && errorBody.length < 80) {
          parsedMessage = sanitizeInput(errorBody);
        }
      }

      throw new Error(parsedMessage);
    }

    return await res.json();
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new Error("Permintaan tamat masa (Request Timeout). Sila cuba lagi.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

const DEFAULT_TIME_OUT_MS_WRAPPER = DEFAULT_TIMEOUT_MS;

export const api = {
  // GET /api/sheets
  async sheets(): Promise<SheetsResponse> {
    return apiFetch<SheetsResponse>("/api/sheets");
  },

  // GET /api/worksheets?sheet_url=...
  async worksheets(sheetUrl: string): Promise<WorksheetsResponse> {
    const cleanUrl = sanitizeUrl(sheetUrl);
    const query = new URLSearchParams({ sheet_url: cleanUrl });
    return apiFetch<WorksheetsResponse>(`/api/worksheets?${query.toString()}`);
  },

  // GET /api/stocks?sheet_url=...&worksheet=...
  async stocks(
    sheetUrl: string,
    worksheet: string = "Name"
  ): Promise<StocksResponse> {
    const cleanUrl = sanitizeUrl(sheetUrl);
    const cleanWs = sanitizeInput(worksheet) || "Name";
    const query = new URLSearchParams({
      sheet_url: cleanUrl,
      worksheet: cleanWs,
    });
    return apiFetch<StocksResponse>(`/api/stocks?${query.toString()}`);
  },

  // GET /api/chart?ticker=...&period=...&interval=...&ema_periods=...
  async getChartData(
    ticker: string,
    period: string = "1y",
    interval: string = "1d",
    emaPeriods: number[] = [5, 10, 20, 50, 100, 200]
  ): Promise<ChartData> {
    // Tapis input ticker (huruf, nombor, titik, sengkang sahaja)
    const cleanTicker = sanitizeInput(ticker).replace(/[^A-Za-z0-9._-]/g, "");
    const cleanPeriod = sanitizeInput(period) || "1y";
    const cleanInterval = sanitizeInput(interval) || "1d";
    const cleanEmas = emaPeriods
      .filter((n) => typeof n === "number" && !isNaN(n) && n > 0 && n <= 500)
      .slice(0, 10);

    const query = new URLSearchParams({
      ticker: cleanTicker,
      period: cleanPeriod,
      interval: cleanInterval,
      ema_periods: cleanEmas.join(","),
    });

    return apiFetch<ChartData>(`/api/chart?${query.toString()}`);
  },

  // GET /api/table?sheet_url=...&worksheet=...
  async tableData(sheetUrl: string, worksheet: string): Promise<TableData> {
    const cleanUrl = sanitizeUrl(sheetUrl);
    const cleanWs = sanitizeInput(worksheet);
    const query = new URLSearchParams({
      sheet_url: cleanUrl,
      worksheet: cleanWs,
    });
    return apiFetch<TableData>(`/api/table?${query.toString()}`);
  },

  // GET /api/subsector_ranks
  async subsectorRanks(market: MarketType = "MY"): Promise<SubsectorRank[]> {
    const cleanMarket = market === "US" ? "US" : "MY";
    const params = new URLSearchParams({ market: cleanMarket });
    return apiFetch<SubsectorRank[]>(
      `/api/subsector_ranks?${params.toString()}`,
      { cache: "no-store" }
    );
  },

  // GET /api/subsector_ohlc/bulk
  async subsectorBulkOHLC(
    market: MarketType = "MY"
  ): Promise<SubsectorBulkOHLC> {
    const cleanMarket = market === "US" ? "US" : "MY";
    const params = new URLSearchParams({ market: cleanMarket });
    return apiFetch<SubsectorBulkOHLC>(
      `/api/subsector_ohlc/bulk?${params.toString()}`,
      { cache: "no-store" }
    );
  },

  // GET /api/subsector_heatmap
  async subsectorHeatmap(
    market: MarketType = "MY"
  ): Promise<SubsectorHeatmapItem[]> {
    const cleanMarket = market === "US" ? "US" : "MY";
    const params = new URLSearchParams({ market: cleanMarket });
    return apiFetch<SubsectorHeatmapItem[]>(
      `/api/subsector_heatmap?${params.toString()}`,
      { cache: "no-store" }
    );
  },

  // GET /api/subsector-stocks
  async subsectorStocks(
    subsectorName: string = "",
    search: string = "",
    minPrice: string = "0.3",
    market: MarketType = "MY",
    emaBullish: boolean = false,
  ): Promise<SubsectorStockItem[]> {
    const cleanMarket = market === "US" ? "US" : "MY";
    const params = new URLSearchParams({ market: cleanMarket });
    params.set("ema_bullish", emaBullish ? "true" : "false");

    const cleanSub = sanitizeInput(subsectorName);
    const cleanSearch = sanitizeInput(search);
    const cleanMinP = sanitizeInput(minPrice);

    if (cleanSub && cleanSub !== "All Stock") params.set("subsector", cleanSub);
    if (cleanSearch) params.set("search", cleanSearch);
    if (cleanMinP) params.set("min_price", cleanMinP);

    const data = await apiFetch<{ stocks?: SubsectorStockItem[] }>(
      `/api/subsector-stocks?${params.toString()}`,
      { cache: "no-store" }
    );
    return data.stocks ?? [];
  },

  // GET /api/subsector_ohlc/:id
  async subsectorSingleOHLC(
    subsectorId: number | string,
    market: string = "MY"
  ): Promise<ChartData> {
    const cleanMarket = market === "US" ? "US" : "MY";
    const cleanId = sanitizeInput(subsectorId).replace(/[^A-Za-z0-9_-]/g, "");
    const params = new URLSearchParams({ market: cleanMarket });

    return apiFetch<ChartData>(
      `/api/subsector_ohlc/${encodeURIComponent(cleanId)}?${params.toString()}`,
      { cache: "no-store" }
    );
  },

  // POST /api/monitoring/add
  async addToMonitoring(payload: AddMonitoringPayload) {
    // Sanitasi payload sebelum dihantar
    const cleanPayload = {
      code: sanitizeInput(payload.code).slice(0, 20),
      name: sanitizeInput(payload.name).slice(0, 100),
      price: typeof payload.price === "number" ? payload.price : Number(payload.price) || 0,
      sector: sanitizeInput(payload.sector).slice(0, 50),
      subsector: sanitizeInput(payload.subsector).slice(0, 50),
      source_table: sanitizeInput(payload.source_table).slice(0, 50),
      market: payload.market === "US" ? "US" : "MY",
    };

    return apiFetch<{ success: boolean; message?: string }>(
      "/api/monitoring/add",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanPayload),
      }
    );
  },

  // GET /api/monitoring/table
  async monitoringTableData(): Promise<{
    headers: string[];
    rows: string[][];
  }> {
    return apiFetch<{ headers: string[]; rows: string[][] }>(
      "/api/monitoring/table",
      { cache: "no-store" }
    );
  },
};