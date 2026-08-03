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
  showRsi: boolean;
  showMacd: boolean;
  showCvd: boolean;
  showCmf: boolean;
}

export interface SidebarParams {
  selectedSheet: SheetEntry | null;
  worksheet: string;
  selectedStocks: Stock[];
  viewMode: "single" | "grid";
  timeframe: "1d" | "1wk" | "1mo";
  period: string;
  chartConfig: ChartConfig;
}
