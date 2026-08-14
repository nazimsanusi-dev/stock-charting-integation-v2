"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { StockChart } from "@/components/StockChart";
import { GridView } from "@/components/GridView";
import { TableView } from "@/components/TableView";
import { OHLCSummary } from "@/components/OHLCSummary";
import { RankingTable } from "@/components/RankingTable";
import { SubsectorHeatmap } from "@/components/SubsectorHeatmap";
import { SubsectorChartGrid } from "@/components/SubsectorChartGrid";

import { api } from "@/lib/api";
import { useChartData } from "@/hooks/useChartData";
import type {
  SidebarParams,
  SubsectorRank,
  SubsectorHeatmapItem,
  SubsectorBulkOHLC,
} from "@/lib/types";

interface ExtendedSidebarParams extends SidebarParams {
  activeTab?: "subsector" | "sheets";
}

const DEFAULT_PARAMS: ExtendedSidebarParams = {
  activeTab: "subsector",
  selectedSheet: null,
  worksheet: "Sheet1",
  allStocks: [],
  theme: "dark",
  selectedStocks: [],
  viewMode: "table",
  timeframe: "1d",
  period: "1y",
  isCombineTimeframe: false,
  secondaryTimeframe: "1w",
  gridColumns: 2,
  chartConfig: {
    emaPeriods: [5, 10, 20, 50, 100, 200],
    showVolume: true,
    showRsi: false,
    showMacd: true,
    showCvd: false,
    showCmf: true,
  },
};

function SingleView({ params }: { params: ExtendedSidebarParams }) {
  const stock = params.selectedStocks[0] ?? null;

  const primary = useChartData(
    stock?.ticker ?? null,
    params.period,
    params.timeframe,
    params.chartConfig.emaPeriods
  );

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
          <span className="text-base font-semibold text-gray-800 dark:text-gray-100">
            {stock.name}
          </span>
          <span className="ml-2 text-sm text-gray-400 dark:text-gray-500">
            {stock.ticker}
          </span>
        </div>
      </div>

      <div className="flex-1 px-2 pt-1 min-h-0">
        {params.isCombineTimeframe ? (
          <div className="grid grid-cols-2 gap-3 h-full">
            <div className="flex flex-col h-full">
              <span className="text-xs font-bold text-blue-600 mb-1">
                TF 1: {params.timeframe.toUpperCase()}
              </span>
              {primary.loading ? (
                <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                  Loading...
                </div>
              ) : primary.data ? (
                <StockChart
                  data={primary.data}
                  config={params.chartConfig}
                  ticker={stock.ticker}
                  theme={params.theme}
                />
              ) : null}
            </div>

            <div className="flex flex-col h-full">
              <span className="text-xs font-bold text-purple-600 mb-1">
                TF 2: {params.secondaryTimeframe.toUpperCase()}
              </span>
              {secondary.loading ? (
                <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                  Loading...
                </div>
              ) : secondary.data ? (
                <StockChart
                  data={secondary.data}
                  config={params.chartConfig}
                  ticker={stock.ticker}
                  theme={params.theme}
                />
              ) : null}
            </div>
          </div>
        ) : (
          <div className="h-full">
            {primary.loading ? (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                Loading...
              </div>
            ) : primary.data ? (
              <StockChart
                data={primary.data}
                config={params.chartConfig}
                ticker={stock.ticker}
                theme={params.theme}
              />
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
  const [params, setParams] = useState<ExtendedSidebarParams>(DEFAULT_PARAMS);

  // States untuk Subsector Analysis (BigQuery)
  const [ranksData, setRanksData] = useState<SubsectorRank[]>([]);
  const [heatmapData, setHeatmapData] = useState<SubsectorHeatmapItem[]>([]);
  const [ohlcBulkData, setOhlcBulkData] = useState<SubsectorBulkOHLC>({});
  const [loadingSubsector, setLoadingSubsector] = useState<boolean>(true);
  const [subsectorError, setSubsectorError] = useState<string | null>(null);

  // States untuk Hide/Unhide Section (Default: Hidden / False)
  const [showHeatmap, setShowHeatmap] = useState<boolean>(false);
  const [showRanking, setShowRanking] = useState<boolean>(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", params.theme === "dark");
  }, [params.theme]);

  const activeTab = params.activeTab ?? "subsector";

  useEffect(() => {
    if (activeTab !== "subsector") return;

    setLoadingSubsector(true);
    setSubsectorError(null);

    Promise.all([
      api.subsectorRanks(),
      api.subsectorHeatmap(),
      api.subsectorBulkOHLC(),
    ])
      .then(([ranks, heatmap, ohlcBulk]) => {
        setRanksData(ranks);
        setHeatmapData(heatmap);
        setOhlcBulkData(ohlcBulk);
      })
      .catch((err) => {
        console.error("Failed to fetch subsector data:", err);
        setSubsectorError("Gagal mengambil data subsektor dari server.");
      })
      .finally(() => setLoadingSubsector(false));
  }, [activeTab]);

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-gray-950">
      <Sidebar params={params} onChange={setParams} />

      <main className="flex flex-col flex-1 min-w-0 overflow-y-auto bg-white dark:bg-gray-950 p-4 sm:p-6 space-y-6">
        {activeTab === "subsector" ? (
          /* ================================================================
             MAIN PAGE: SUBSECTOR ANALYSIS (END-TO-END FULL WIDTH)
             ================================================================ */
          <div className="space-y-6 w-full">
            <header className="border-b border-gray-200 dark:border-gray-800 pb-4">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Analisis & Ranking Subsektor Pasaran
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Data dikemas kini secara automatik dari BigQuery
              </p>
            </header>

            {loadingSubsector ? (
              <div className="flex flex-col items-center justify-center p-12 text-gray-400 gap-2">
                <span className="animate-spin text-2xl">⏳</span>
                <p className="text-sm">Memuatkan data subsektor...</p>
              </div>
            ) : subsectorError ? (
              <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-500 text-sm text-center">
                ⚠ {subsectorError}
              </div>
            ) : (
              <>
                {/* 1. Heatmap Subsektor (Collapsible) */}
                <section className="bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
                  <div
                    onClick={() => setShowHeatmap(!showHeatmap)}
                    className="flex items-center justify-between px-4 py-3.5 cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                      <h2 className="text-base font-bold text-gray-800 dark:text-gray-200">
                        Heatmap Subsektor
                      </h2>
                    </div>
                    <button
                      type="button"
                      className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-700 shadow-sm"
                    >
                      <span>{showHeatmap ? "Tutup" : "Buka"}</span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-4 w-4 transition-transform duration-200 ${
                          showHeatmap ? "rotate-180" : ""
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  {showHeatmap && (
                    <div className="p-4 border-t border-gray-200 dark:border-gray-800">
                      <SubsectorHeatmap data={heatmapData} />
                    </div>
                  )}
                </section>

                {/* 2. Table Ranking Subsektor (Collapsible) */}
                <section className="bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
                  <div
                    onClick={() => setShowRanking(!showRanking)}
                    className="flex items-center justify-between px-4 py-3.5 cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-blue-500"></span>
                      <h2 className="text-base font-bold text-gray-800 dark:text-gray-200">
                        Ranking Subsektor
                      </h2>
                    </div>
                    <button
                      type="button"
                      className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-700 shadow-sm"
                    >
                      <span>{showRanking ? "Tutup" : "Buka"}</span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-4 w-4 transition-transform duration-200 ${
                          showRanking ? "rotate-180" : ""
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  {showRanking && (
                    <div className="p-4 border-t border-gray-200 dark:border-gray-800">
                      <RankingTable data={ranksData} />
                    </div>
                  )}
                </section>

                {/* 3. Grid Carta Subsektor (End-to-End) */}
                <section className="w-full">
                  <h2 className="text-base font-bold mb-3 text-gray-800 dark:text-gray-200 flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-indigo-500"></span>
                    Carta Indeks Subsektor
                  </h2>
                  <SubsectorChartGrid
                    ranks={ranksData}
                    ohlcData={ohlcBulkData}
                    theme={params.theme}
                  />
                </section>
              </>
            )}
          </div>
        ) : (
          /* ================================================================
             SECONDARY TAB: GOOGLE SHEETS TRACKER
             ================================================================ */
          <div className="w-full">
            {params.viewMode === "single" ? (
              <SingleView params={params} />
            ) : params.viewMode === "grid" ? (
              <GridView
                stocks={params.allStocks ?? []}
                period={params.period}
                timeframe={params.timeframe}
                secondaryTimeframe={params.secondaryTimeframe}
                isCombine={params.isCombineTimeframe}
                config={params.chartConfig}
                columns={params.gridColumns}
                theme={params.theme}
              />
            ) : (
              <TableView
                selectedSheet={params.selectedSheet}
                worksheet={params.worksheet}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}