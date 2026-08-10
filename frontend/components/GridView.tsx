"use client";

import { StockChart } from "@/components/StockChart";
import { OHLCSummary } from "@/components/OHLCSummary";
import { useChartData } from "@/hooks/useChartData";
import type { ChartConfig, OHLCVBar } from "@/lib/types";

interface StockCardProps {
  stock: { name: string; ticker: string };
  period: string;
  timeframe: string;
  secondaryTimeframe: string;
  isCombine: boolean;
  config: ChartConfig;
  theme?: "light" | "dark";
}

// Helper to safely extract latest bar and previous close price
function extractBars(chartData: any): { lastBar: OHLCVBar | null; prevClose: number | null } {
  if (!chartData) return { lastBar: null, prevClose: null };

  const bars: OHLCVBar[] = Array.isArray(chartData)
    ? chartData
    : chartData.ohlcv || chartData.bars || chartData.candles || [];

  if (!bars || bars.length === 0) return { lastBar: null, prevClose: null };

  const lastBar = bars[bars.length - 1];
  const prevBar = bars.length > 1 ? bars[bars.length - 2] : null;

  return { lastBar, prevClose: prevBar ? prevBar.close : null };
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

  const primaryBars = extractBars(primaryData.data);
  const secondaryBars = extractBars(secondaryData.data);

  return (
    <div className="flex flex-col border border-gray-200 dark:border-gray-800 rounded-lg p-3 bg-white dark:bg-gray-900 shadow-sm h-[520px]">
      {/* Top Header */}
      <div className="flex justify-between items-center mb-1 px-1">
        <span className="font-bold text-gray-800 dark:text-gray-100 text-sm truncate">
          {stock.name}
        </span>
        <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{stock.ticker}</span>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {isCombine ? (
          /* Side-by-Side View for 2 Timeframes */
          <div className="grid grid-cols-2 gap-2 h-full">
            {/* TF 1 */}
            <div className="flex flex-col h-full border-r border-gray-100 dark:border-gray-800 pr-1 overflow-hidden">
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-0.5">
                TF 1: {timeframe.toUpperCase()}
              </span>

              {primaryBars.lastBar && (
                <OHLCSummary
                  bar={primaryBars.lastBar}
                  ticker={stock.ticker}
                  prevClose={primaryBars.prevClose}
                />
              )}

              {primaryData.loading ? (
                <div className="flex-1 flex items-center justify-center text-xs text-gray-400 dark:text-gray-500">
                  Loading...
                </div>
              ) : primaryData.data ? (
                <div className="flex-1 min-h-0">
                  <StockChart
                    data={primaryData.data}
                    config={config}
                    ticker={stock.ticker}
                    mini
                    theme={theme}
                  />
                </div>
              ) : null}
            </div>

            {/* TF 2 */}
            <div className="flex flex-col h-full pl-1 overflow-hidden">
              <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 mb-0.5">
                TF 2: {secondaryTimeframe.toUpperCase()}
              </span>

              {secondaryBars.lastBar && (
                <OHLCSummary
                  bar={secondaryBars.lastBar}
                  ticker={stock.ticker}
                  prevClose={secondaryBars.prevClose}
                />
              )}

              {secondaryData.loading ? (
                <div className="flex-1 flex items-center justify-center text-xs text-gray-400 dark:text-gray-500">
                  Loading...
                </div>
              ) : secondaryData.data ? (
                <div className="flex-1 min-h-0">
                  <StockChart
                    data={secondaryData.data}
                    config={config}
                    ticker={stock.ticker}
                    mini
                    theme={theme}
                  />
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          /* Standard Single Chart View */
          <div className="flex flex-col h-full">
            {primaryBars.lastBar && (
              <OHLCSummary
                bar={primaryBars.lastBar}
                ticker={stock.ticker}
                prevClose={primaryBars.prevClose}
              />
            )}

            {primaryData.loading ? (
              <div className="flex-1 flex items-center justify-center text-xs text-gray-400 dark:text-gray-500">
                Loading...
              </div>
            ) : primaryData.data ? (
              <div className="flex-1 min-h-0">
                <StockChart
                  data={primaryData.data}
                  config={config}
                  ticker={stock.ticker}
                  mini
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
        No stocks selected for grid view.
      </div>
    );
  }

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