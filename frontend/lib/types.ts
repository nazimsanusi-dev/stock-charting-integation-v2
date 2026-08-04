export interface SheetEntry {
  url: string;
  label: string;
}

export interface Stock {
  name: string;
  ticker: string;
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
