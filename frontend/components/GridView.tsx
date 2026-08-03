"use client";

import { useChartData } from "@/hooks/useChartData";
import { StockChart } from "./StockChart";
import { OHLCSummary } from "./OHLCSummary";
import type { Stock, ChartConfig } from "@/lib/types";

interface SingleChartProps {
  stock: Stock;
  period: string;
  interval: string;
  config: ChartConfig;
}

function SingleChart({ stock, period, interval, config }: SingleChartProps) {
  const { data, loading, error } = useChartData(stock.ticker, period, interval, config.emaPeriods);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm animate-pulse">
        Loading {stock.ticker}…
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center justify-center h-24 text-red-400 text-sm px-4 text-center">
        {error}
      </div>
    );
  }
  if (!data) return null;

  const lastBar = data.ohlcv[data.ohlcv.length - 1] ?? null;

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden bg-white">
      <div className="px-3 pt-2 pb-0">
        <span className="text-sm font-semibold text-gray-700">{stock.name}</span>
        <span className="ml-2 text-xs text-gray-400">{stock.ticker}</span>
      </div>
      <StockChart data={data} config={config} ticker={stock.ticker} />
      <OHLCSummary bar={lastBar} ticker={stock.ticker} />
    </div>
  );
}

interface GridViewProps {
  stocks: Stock[];
  period: string;
  interval: string;
  config: ChartConfig;
  columns: 2 | 3 | 4;
}

export function GridView({ stocks, period, interval, config, columns }: GridViewProps) {
  const colClass = {
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 xl:grid-cols-4",
  }[columns];

  if (!stocks.length) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Select stocks from the sidebar
      </div>
    );
  }

  return (
    <div className={`grid ${colClass} gap-4`}>
      {stocks.map((s) => (
        <SingleChart key={s.ticker} stock={s} period={period} interval={interval} config={config} />
      ))}
    </div>
  );
}
