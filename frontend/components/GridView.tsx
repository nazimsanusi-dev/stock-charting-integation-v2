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
  theme = "dark",
}: StockCardProps) {
  // Fetch Primary Timeframe Data
  const primaryData = useChartData(stock.ticker, period, timeframe, config.emaPeriods);

  // Fetch Secondary Timeframe Data if Combine Mode ON
  const secondaryData = useChartData(
    isCombine ? stock.ticker : null,
    period,
    secondaryTimeframe,
    config.emaPeriods
  );

  return (
    <div className="flex flex-col border border-gray-200 dark:border-gray-800 rounded-xl p-2.5 bg-white dark:bg-[#121722] shadow-sm h-[580px] sm:h-[620px] w-full overflow-hidden">
      {/* Top Header Ringkas */}
      <div className="flex justify-between items-center px-2 py-1 mb-1 border-b border-gray-100 dark:border-gray-800/80">
        <div className="flex items-center gap-2 truncate">
          <span className="font-bold text-gray-900 dark:text-gray-100 text-xs sm:text-sm truncate">
            {stock.name}
          </span>
          <span className="text-[11px] font-mono font-semibold text-amber-500 dark:text-amber-400">
            {stock.ticker}
          </span>
        </div>
        <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 uppercase">
          {isCombine ? `${timeframe.toUpperCase()} / ${secondaryTimeframe.toUpperCase()}` : timeframe.toUpperCase()}
        </span>
      </div>

      <div className="flex-1 min-h-0 flex flex-col w-full">
        {isCombine ? (
          /* Side-by-Side View for 2 Timeframes */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 h-full w-full">
            {/* TF 1 */}
            <div className="flex flex-col h-full border-b md:border-b-0 md:border-r border-gray-100 dark:border-gray-800/80 pr-0 md:pr-1 overflow-hidden">
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 px-2 py-0.5">
                TF 1: {timeframe.toUpperCase()}
              </span>

              {primaryData.loading ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-xs text-gray-400 dark:text-gray-500 min-h-[160px]">
                  <div className="relative flex items-center justify-center w-6 h-6">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#26A69A] opacity-20" />
                    <span className="w-5 h-5 border-2 border-transparent border-t-[#26A69A] border-r-[#26A69A] rounded-full animate-spin" />
                  </div>
                  <span className="font-mono text-[11px]">Loading data...</span>
                </div>
              ) : primaryData.data ? (
                <div className="flex-1 min-h-0 w-full">
                  <StockChart
                    data={primaryData.data}
                    config={config}
                    ticker={stock.ticker}
                    mini={false}
                    theme={theme}
                  />
                </div>
              ) : null}
            </div>

            {/* TF 2 */}
            <div className="flex flex-col h-full pl-0 md:pl-1 overflow-hidden">
              <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 px-2 py-0.5">
                TF 2: {secondaryTimeframe.toUpperCase()}
              </span>

              {secondaryData.loading ? (
                <div className="flex-1 flex items-center justify-center text-xs text-gray-400 dark:text-gray-500">
                  <span className="animate-spin mr-1.5">⏳</span> Memuatkan...
                </div>
              ) : secondaryData.data ? (
                <div className="flex-1 min-h-0 w-full">
                  <StockChart
                    data={secondaryData.data}
                    config={config}
                    ticker={stock.ticker}
                    mini={false}
                    theme={theme}
                  />
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          /* Standard Single Chart View dengan Toolbar Lengkap */
          <div className="flex flex-col h-full w-full">
            {primaryData.loading ? (
              <div className="flex-1 flex items-center justify-center text-xs text-gray-400 dark:text-gray-500">
                <span className="animate-spin mr-1.5">⏳</span> { }Memuatkan data carta...
              </div>
            ) : primaryData.data ? (
              <div className="flex-1 min-h-0 w-full">
                <StockChart
                  data={primaryData.data}
                  config={config}
                  ticker={stock.ticker}
                  mini={false}
                  theme={theme}
                />
              </div>
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
  theme = "dark",
}: GridViewProps) {
  if (!stocks.length) {
    return (
      <div className="flex flex-1 items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
        Tiada saham dipilih untuk Paparan Grid.
      </div>
    );
  }

  const activeColumns = isCombine ? Math.min(columns, 2) : columns;

  const gridClass =
    {
      1: "grid-cols-1",
      2: "grid-cols-1 lg:grid-cols-2",
      3: "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
      4: "grid-cols-1 md:grid-cols-2 2xl:grid-cols-4",
    }[activeColumns] || "grid-cols-1 lg:grid-cols-2";

  return (
    <div className={`grid ${gridClass} gap-4 w-full pb-8`}>
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