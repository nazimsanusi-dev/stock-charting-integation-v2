"use client";

import type {
  SubsectorRank,
  SubsectorBulkOHLC,
  ChartData,
} from "@/lib/types";
import { StockChart } from "@/components/StockChart";

interface Props {
  ranks: SubsectorRank[];
  ohlcData: SubsectorBulkOHLC;
  theme?: "light" | "dark"; // Ketatkan jenis theme
}

export function SubsectorChartGrid({
  ranks,
  ohlcData,
  theme = "dark",
}: Props) {
  if (!ranks || ranks.length === 0) {
    return (
      <div className="p-8 text-center text-gray-400 text-sm">
        Tiada data subsektor untuk dipaparkan.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {ranks.map((item) => {
        const rawOhlc = ohlcData[item.subsector_id];

        // Format data OHLC dan tentukan jenis sebagai ChartData
        const formattedData: ChartData | null =
        rawOhlc && rawOhlc.length > 0
            ? {
                ticker: item.subsector_name,
                ohlcv: rawOhlc.map((d) => ({
                time: Math.floor(new Date(d.date).getTime() / 1000),
                open: Number(d.open),
                high: Number(d.high),
                low: Number(d.low),
                close: Number(d.close),
                volume: 0,
                })),
                indicators: {} as ChartData["indicators"], // Lakukan type assertion di sini
            }
            : null;

        return (
          <div
            key={item.subsector_id}
            id={`chart-${item.subsector_id}`}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex flex-col gap-3 shadow-sm hover:border-teal-500/50 transition-colors"
          >
            {/* Header Kad Carta */}
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-[#26A69A] bg-[#26A69A]/10 px-2 py-0.5 rounded">
                  #{item.rank}
                </span>
                <h3 className="font-bold text-sm text-gray-800 dark:text-gray-100">
                  {item.subsector_name}
                </h3>
              </div>

              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="text-gray-500 dark:text-gray-400">
                  Score: <strong className="text-[#26A69A]">{item.score}</strong>
                </span>
                <span
                  className={`font-semibold ${
                    item.return_5d >= 0 ? "text-emerald-500" : "text-rose-500"
                  }`}
                >
                  {item.return_5d >= 0 ? `+${item.return_5d}%` : `${item.return_5d}%`}
                </span>
              </div>
            </div>

            {/* Tag Status Subsektor */}
            <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
              {item.status}
            </div>

            {/* Kawasan Canvas Carta TradingView */}
            <div className="h-64 w-full bg-gray-50 dark:bg-gray-950 rounded-lg overflow-hidden flex items-center justify-center border border-gray-100 dark:border-gray-800">
              {formattedData ? (
                <StockChart
                  data={formattedData}
                  config={{
                    emaPeriods: [10, 20, 50, 100],
                    showVolume: false,
                    showRsi: false,
                    showMacd: false,
                    showCvd: false,
                    showCmf: false,
                  }}
                  ticker={item.subsector_name}
                  theme={theme}
                />
              ) : (
                <span className="text-xs text-gray-400 animate-pulse">
                  Memuatkan data carta...
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}