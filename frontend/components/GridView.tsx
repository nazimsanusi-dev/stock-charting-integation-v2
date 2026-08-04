"use client";

import { StockChart } from "@/components/StockChart";
import { useChartData } from "@/hooks/useChartData";
import type { ChartConfig } from "@/lib/types";

interface StockCardProps {
  stock: { name: string; ticker: string };
  period: string;
  timeframe: string;
  secondaryTimeframe: string;
  isCombine: boolean;
  config: ChartConfig;
  theme?: "light" | "dark";
}

function StockCard({
  stock,
  period,
  timeframe,
  secondaryTimeframe,
  isCombine,
  config,
  theme = "light",
}: StockCardProps) {
  // Fetch Data Timeframe Utama (Primary)
  const primaryData = useChartData(stock.ticker, period, timeframe, config.emaPeriods);

  // Fetch Data Timeframe Kedua (Secondary) jika Combine Mode ON
  const secondaryData = useChartData(
    isCombine ? stock.ticker : null,
    period,
    secondaryTimeframe,
    config.emaPeriods
  );

  return (
    <div className="flex flex-col border border-gray-200 dark:border-gray-800 rounded-lg p-3 bg-white dark:bg-gray-900 shadow-sm h-[480px]">
      <div className="flex justify-between items-center mb-2 px-1">
        <span className="font-bold text-gray-800 dark:text-gray-100 text-sm truncate">{stock.name}</span>
        <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{stock.ticker}</span>
      </div>

      <div className="flex-1 min-h-0">
        {isCombine ? (
          /* Side-by-Side View untuk 2 Timeframe */
          <div className="grid grid-cols-2 gap-2 h-full">
            <div className="flex flex-col h-full border-r border-gray-100 dark:border-gray-800 pr-1">
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">
                TF 1: {timeframe.toUpperCase()}
              </span>
              {primaryData.loading ? (
                <div className="flex-1 flex items-center justify-center text-xs text-gray-400 dark:text-gray-500">
                  Loading...
                </div>
              ) : primaryData.data ? (
                <StockChart data={primaryData.data} config={config} ticker={stock.ticker} mini theme={theme} />
              ) : null}
            </div>

            <div className="flex flex-col h-full pl-1">
              <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 mb-1">
                TF 2: {secondaryTimeframe.toUpperCase()}
              </span>
              {secondaryData.loading ? (
                <div className="flex-1 flex items-center justify-center text-xs text-gray-400 dark:text-gray-500">
                  Loading...
                </div>
              ) : secondaryData.data ? (
                <StockChart data={secondaryData.data} config={config} ticker={stock.ticker} mini theme={theme} />
              ) : null}
            </div>
          </div>
        ) : (
          /* Standard Single Chart View */
          <div className="h-full">
            {primaryData.loading ? (
              <div className="flex-1 flex items-center justify-center text-xs text-gray-400 dark:text-gray-500">
                Loading...
              </div>
            ) : primaryData.data ? (
              <StockChart data={primaryData.data} config={config} ticker={stock.ticker} mini theme={theme} />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

interface GridViewProps {
  stocks: Array<{ name: string; ticker: string }>;
  period: string;
  timeframe: string;
  secondaryTimeframe: string;
  isCombine: boolean;
  config: ChartConfig;
  columns: number;
  theme?: "light" | "dark";
}

export function GridView({
  stocks,
  period,
  timeframe,
  secondaryTimeframe,
  isCombine,
  config,
  columns,
  theme = "light",
}: GridViewProps) {
  if (!stocks.length) {
    return (
      <div className="flex flex-1 items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
        No stocks selected for grid view.
      </div>
    );
  }

  // Hadkan maksima 2 kolum jika Combine Timeframe di-ON-kan
  const activeColumns = isCombine ? Math.min(columns, 2) : columns;

  const gridClass =
    {
      1: "grid-cols-1",
      2: "grid-cols-2",
      3: "grid-cols-3",
      4: "grid-cols-4",
    }[activeColumns] || "grid-cols-2";

  return (
    <div className={`grid ${gridClass} gap-4 w-full`}>
      {stocks.map((stock) => (
        <StockCard
          key={stock.ticker}
          stock={stock}
          period={period}
          timeframe={timeframe}
          secondaryTimeframe={secondaryTimeframe}
          isCombine={isCombine}
          config={config}
          theme={theme}
        />
      ))}
    </div>
  );
}