"use client";

import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { StockChart } from "@/components/StockChart";
import { GridView } from "@/components/GridView";
import { OHLCSummary } from "@/components/OHLCSummary";
import { useChartData } from "@/hooks/useChartData";
import type { SidebarParams } from "@/lib/types";

const DEFAULT_PARAMS: SidebarParams = {
  selectedSheet: null,
  worksheet: "Sheet1",
  allStocks: [],
  selectedStocks: [],
  viewMode: "single",
  timeframe: "1d",
  period: "1y",
  isCombineTimeframe: false,
  secondaryTimeframe: "1w",
  gridColumns: 2,
  chartConfig: {
    emaPeriods: [10, 20, 50],
    showVolume: true,
    showRsi: false,
    showMacd: false,
    showCvd: false,
    showCmf: false,
  },
};

function SingleView({ params }: { params: SidebarParams }) {
  const stock = params.selectedStocks[0] ?? null;

  // Primary Timeframe Data
  const primary = useChartData(
    stock?.ticker ?? null,
    params.period,
    params.timeframe,
    params.chartConfig.emaPeriods
  );

  // Secondary Timeframe Data (jika Combine ON)
  const secondary = useChartData(
    params.isCombineTimeframe && stock?.ticker ? stock.ticker : null,
    params.period,
    params.secondaryTimeframe,
    params.chartConfig.emaPeriods
  );

  if (!stock) {
    return (
      <div className="flex flex-1 items-center justify-center text-gray-400 text-sm">
        Select a stock from the sidebar
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-w-0 h-full">
      <div className="px-4 pt-3 flex justify-between items-center">
        <div>
          <span className="text-base font-semibold text-gray-800">{stock.name}</span>
          <span className="ml-2 text-sm text-gray-400">{stock.ticker}</span>
        </div>
      </div>

      <div className="flex-1 px-2 pt-1 min-h-0">
        {params.isCombineTimeframe ? (
          /* Single View: Gabungan 2 Timeframe Kiri-Kanan */
          <div className="grid grid-cols-2 gap-3 h-full">
            <div className="flex flex-col h-full">
              <span className="text-xs font-bold text-blue-600 mb-1">TF 1: {params.timeframe.toUpperCase()}</span>
              {primary.loading ? (
                <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading...</div>
              ) : primary.data ? (
                <StockChart data={primary.data} config={params.chartConfig} ticker={stock.ticker} />
              ) : null}
            </div>

            <div className="flex flex-col h-full">
              <span className="text-xs font-bold text-purple-600 mb-1">TF 2: {params.secondaryTimeframe.toUpperCase()}</span>
              {secondary.loading ? (
                <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading...</div>
              ) : secondary.data ? (
                <StockChart data={secondary.data} config={params.chartConfig} ticker={stock.ticker} />
              ) : null}
            </div>
          </div>
        ) : (
          /* Single View Biasa */
          <div className="h-full">
            {primary.loading ? (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading...</div>
            ) : primary.data ? (
              <StockChart data={primary.data} config={params.chartConfig} ticker={stock.ticker} />
            ) : null}
          </div>
        )}
      </div>

      {primary.data && (
        <OHLCSummary
          bar={primary.data.ohlcv[primary.data.ohlcv.length - 1] ?? null}
          ticker={stock.ticker}
        />
      )}
    </div>
  );
}

export default function Home() {
  const [params, setParams] = useState<SidebarParams>(DEFAULT_PARAMS);

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar params={params} onChange={setParams} />

      <main className="flex flex-col flex-1 min-w-0 overflow-y-auto">
        {params.viewMode === "single" ? (
          <SingleView params={params} />
        ) : (
          <div className="p-4">
            <GridView
              stocks={params.selectedStocks}
              period={params.period}
              timeframe={params.timeframe}
              secondaryTimeframe={params.secondaryTimeframe}
              isCombine={params.isCombineTimeframe}
              config={params.chartConfig}
              columns={params.gridColumns}
            />
          </div>
        )}
      </main>
    </div>
  );
}