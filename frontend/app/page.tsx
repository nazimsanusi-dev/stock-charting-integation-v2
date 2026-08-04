"use client";

import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { StockChart } from "@/components/StockChart";
import { GridView } from "@/components/GridView";
import { TableView } from "@/components/TableView";
import { OHLCSummary } from "@/components/OHLCSummary";
import { useChartData } from "@/hooks/useChartData";
import type { SidebarParams } from "@/lib/types";

const DEFAULT_PARAMS: SidebarParams = {
  selectedSheet: null,
  worksheet: "Sheet1",
  allStocks: [],
  selectedStocks: [],
  viewMode: "single",
  gridColumns: 2,
  timeframe: "1d",
  period: "1y",
  chartConfig: {
    emaPeriods: [10, 20, 50],
    showVolume: true,
    showRsi: false,
    showMacd: true,
    showCvd: true,
    showCmf: false,
  },
};

function SingleView({ params }: { params: SidebarParams }) {
  const stock = params.selectedStocks[0] ?? null;
  const { data, loading, error } = useChartData(
    stock?.ticker ?? null,
    params.period,
    params.timeframe,
    params.chartConfig.emaPeriods,
  );

  if (!stock) {
    return (
      <div className="flex flex-1 items-center justify-center text-gray-400 text-sm">
        Select a stock from the sidebar
      </div>
    );
  }
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-gray-400 text-sm animate-pulse">
        Loading {stock.ticker}…
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center text-red-400 text-sm px-8 text-center">
        {error}
      </div>
    );
  }
  if (!data) return null;

  const lastBar = data.ohlcv[data.ohlcv.length - 1] ?? null;

  return (
    <div className="flex flex-col flex-1 min-w-0">
      <div className="px-4 pt-3">
        <span className="text-base font-semibold text-gray-800">{stock.name}</span>
        <span className="ml-2 text-sm text-gray-400">{stock.ticker}</span>
      </div>
      <div className="flex-1 px-2 pt-1">
        <StockChart data={data} config={params.chartConfig} ticker={stock.ticker} />
      </div>
      <OHLCSummary bar={lastBar} ticker={stock.ticker} />
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
        ) : params.viewMode === "grid" ? (
          <div className="p-4">
            <GridView
              stocks={params.allStocks}
              period={params.period}
              interval={params.timeframe}
              config={params.chartConfig}
              columns={params.gridColumns}
            />
          </div>
        ) : (
          <TableView
            selectedSheet={params.selectedSheet}
            worksheet={params.worksheet}
          />
        )}
      </main>
    </div>
  );
}


