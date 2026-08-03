import type { ChartData, SheetEntry, Stock } from "./types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8787";

// Define strict return types for API calls
export interface SheetsResponse {
  sheets: SheetEntry[];
}

export interface StocksResponse {
  stocks: Stock[];
}

export const api = {
  // Method aliases to match Sidebar.tsx calls
  async sheets(spreadsheetUrl: string = ""): Promise<SheetsResponse> {
    return this.getSheets(spreadsheetUrl);
  },

  async stocks(sheetName: string, spreadsheetUrl: string = ""): Promise<StocksResponse> {
    return this.getStockList(sheetName, spreadsheetUrl);
  },

  async getSpreadsheets() {
    const res = await fetch(`${API_BASE_URL}/api/sheets/options`);
    if (!res.ok) throw new Error("Failed to fetch spreadsheet options");
    return res.json();
  },

  async getSheets(spreadsheetUrl: string = ""): Promise<SheetsResponse> {
    const query = spreadsheetUrl
      ? `?spreadsheet_url=${encodeURIComponent(spreadsheetUrl)}`
      : "";
    const res = await fetch(`${API_BASE_URL}/api/sheets/names${query}`);
    if (!res.ok) throw new Error("Failed to fetch sheet names");
    return res.json();
  },

  async getStockList(sheetName: string, spreadsheetUrl: string = ""): Promise<StocksResponse> {
    const query = new URLSearchParams({
      sheet_name: sheetName,
      ...(spreadsheetUrl && { spreadsheet_url: spreadsheetUrl }),
    });
    const res = await fetch(`${API_BASE_URL}/api/sheets/stocks?${query}`);
    if (!res.ok) throw new Error("Failed to fetch stock list");
    return res.json();
  },

  async getChartData(
    symbol: string,
    period: string = "1y",
    interval: string = "1d",
    emaPeriods: number[] = [10, 20, 50, 100]
  ): Promise<ChartData> {
    const query = new URLSearchParams({
      symbol,
      period,
      interval,
      ema_periods: emaPeriods.join(","),
    });
    const res = await fetch(`${API_BASE_URL}/api/stocks/candles?${query}`);
    if (!res.ok) throw new Error("Failed to fetch chart data");
    return res.json();
  },
};