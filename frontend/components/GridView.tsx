"use client";

import { memo } from "react";
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

const SingleChart = memo(function SingleChart({ stock, period, interval, config }: SingleChartProps) {
  const { data, loading, error } = useChartData(stock.ticker, period, interval, config.emaPeriods);

  if (loading) {
    return (
      <div className="border border-gray-100 rounded-lg overflow-hidden bg-white">
        <div className="px-3 pt-2 pb-1">
          <span className="text-sm font-semibold text-gray-700">{stock.name}</span>
          <span className="ml-2 text-xs text-gray-400">{stock.ticker}</span>
        </div>
        <div className="flex items-center justify-center h-[200px] text-gray-400 text-sm animate-pulse">
          Loading…
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="border border-gray-100 rounded-lg overflow-hidden bg-white">
        <div className="px-3 pt-2 pb-1">
          <span className="text-sm font-semibold text-gray-700">{stock.name}</span>
          <span className="ml-2 text-xs text-gray-400">{stock.ticker}</span>
        </div>
        <div className="flex items-center justify-center h-[200px] text-red-400 text-xs px-4 text-center">
          {error}
        </div>
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
      <div style={{ height: 200 }}>
        <StockChart data={data} config={config} ticker={stock.ticker} mini />
      </div>
      <OHLCSummary bar={lastBar} ticker={stock.ticker} />
    </div>
  );
});

interface GridViewProps {
  stocks: Stock[];
  period: string;
  interval: string;
  config: ChartConfig;
  columns: 1 | 2 | 3 | 4;
}

export function GridView({ stocks, period, interval, config, columns }: GridViewProps) {
  const colClass: Record<number, string> = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  };

  if (!stocks.length) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        No stocks available
      </div>
    );
  }

  return (
    <div className={`grid ${colClass[columns]} gap-3`}>
      {stocks.map((s) => (
        <SingleChart key={s.ticker} stock={s} period={period} interval={interval} config={config} />
      ))}
    </div>
  );
}
