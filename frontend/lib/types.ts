export interface SheetEntry {
  url: string;
  label: string;
}

export interface Stock {
  name: string;
  ticker: string;
  change: number | string;
}

export interface OHLCVBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorData {
  ema: Record<string, (number | null)[]>;
  rsi: (number | null)[];
  macd: (number | null)[];
  macd_signal: (number | null)[];
  macd_histogram: (number | null)[];
  cvd: number[];
  cmf: (number | null)[];
}

export interface ChartData {
  ticker: string;
  ohlcv: OHLCVBar[];
  indicators: IndicatorData;
}

export interface ChartConfig {
  emaPeriods: number[];
  showVolume: boolean;
  showRsi: boolean;
  showMacd: boolean;
  showCvd: boolean;
  showCmf: boolean;
}

export interface TableData {
  headers: string[];
  rows: string[][];
}

export interface SidebarParams {
  selectedSheet: SheetEntry | null;
  worksheet: string;
  allStocks: Stock[];
  selectedStocks: Stock[];
  viewMode: "single" | "grid" | "table";
  gridColumns: number;               // 1 | 2 | 3 | 4;
  timeframe: string;                 //"1d" | "1wk" | "1mo";
  period: string;
  isCombineTimeframe: boolean;       // Status Feature Combine Timeframe
  secondaryTimeframe: string;        // Timeframe Kedua (cth: "1w" atau "1m")
  chartConfig: ChartConfig;
  theme: "light" | "dark";           // Tambah tetapan tema
}

// ==============================================================================
// SUBSECTOR ANALYSIS TYPES (BIGQUERY)
// ==============================================================================

export interface SubsectorRank {
  date: string;
  rank: number;
  subsector_id: number;
  subsector_name: string;
  score: number;
  status: string;
  return_20d: number;
  return_5d: number;
  close_index: number;
  num_stocks: number;
}

export interface SubsectorOHLC {
  subsector_id: number;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export type SubsectorBulkOHLC = Record<string | number, SubsectorOHLC[]>;

export interface SubsectorHeatmapItem {
  subsector_id: number;
  subsector_name: string;
  sector_name: string;
  score: number;
  return_5d: number;
  return_20d: number;
  num_stocks: number;
}

export interface SubsectorStockItem {
  Name: string;
  Code: string;
  Shariah: string;
  Price: string;
  Change: string;
  Change_Percent: string;
  Volume: string;
  MCap_M: string;
  PE: string;
  ROE: string;
  DY: string;
  Scraped_Subsector: string;
}