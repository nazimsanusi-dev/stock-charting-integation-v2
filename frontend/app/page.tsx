"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Sidebar } from "@/components/Sidebar";
import { StockChart } from "@/components/StockChart";
import { GridView } from "@/components/GridView";
import { TableView } from "@/components/TableView";
import { OHLCSummary } from "@/components/OHLCSummary";
import { RankingTable } from "@/components/RankingTable";
import { SubsectorHeatmap } from "@/components/SubsectorHeatmap";
import { SubsectorChartGrid } from "@/components/SubsectorChartGrid";
import { SubsectorStocksTable } from "@/components/SubsectorStocksTable";

import { api, MarketType } from "@/lib/api";
import { useChartData } from "@/hooks/useChartData";
import type {
  SidebarParams,
  SubsectorRank,
  SubsectorHeatmapItem,
  SubsectorBulkOHLC,
} from "@/lib/types";

export interface ExtendedSidebarParams extends SidebarParams {
  activeTab?: "subsector" | "sheets" | "monitoring" | "us_subsector";
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
  secondaryTimeframe: "1wk",
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

  // States untuk Subsector Analysis (Bursa & US)
  const [ranksData, setRanksData] = useState<SubsectorRank[]>([]);
  const [heatmapData, setHeatmapData] = useState<SubsectorHeatmapItem[]>([]);
  const [ohlcBulkData, setOhlcBulkData] = useState<SubsectorBulkOHLC>({});
  const [loadingSubsector, setLoadingSubsector] = useState<boolean>(true);
  const [subsectorError, setSubsectorError] = useState<string | null>(null);

  // States untuk Hide/Unhide Section (Default: Tutup / False)
  const [showHeatmap, setShowHeatmap] = useState<boolean>(false);
  const [showRanking, setShowRanking] = useState<boolean>(false);
  const [showStocksTable, setShowStocksTable] = useState<boolean>(false);
  const [showChartGrid, setShowChartGrid] = useState<boolean>(false);

  // State & Ref untuk Scroll Position Memory
  const [scrollMode, setScrollMode] = useState<"hidden" | "up" | "down">("hidden");
  const [lastScrollPos, setLastScrollPos] = useState<number | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", params.theme === "dark");
  }, [params.theme]);

  const activeTab = params.activeTab ?? "subsector";
  const currentMarket: MarketType = activeTab === "us_subsector" ? "US" : "MY";
  const isSubsectorView = activeTab === "subsector" || activeTab === "us_subsector";

  // Fungsi Panggilan API Subsektor Dinamik mengikut Pasaran (MY / US)
  const fetchSubsectorData = useCallback(async () => {
    setLoadingSubsector(true);
    setSubsectorError(null);

    try {
      const [ranks, heatmap, ohlcBulk] = await Promise.all([
        api.subsectorRanks(currentMarket),
        api.subsectorHeatmap(currentMarket),
        api.subsectorBulkOHLC(currentMarket),
      ]);

      setRanksData(Array.isArray(ranks) ? ranks : []);
      setHeatmapData(Array.isArray(heatmap) ? heatmap : []);
      setOhlcBulkData(ohlcBulk && typeof ohlcBulk === "object" ? ohlcBulk : {});
    } catch (err: any) {
      console.error(`Failed to fetch ${currentMarket} subsector data:`, err);
      setSubsectorError(
        err?.message || `Gagal mengambil data pasaran ${currentMarket} dari server. Sila semak sambungan API.`
      );
    } finally {
      setLoadingSubsector(false);
    }
  }, [currentMarket]);

  useEffect(() => {
    if (isSubsectorView) {
      fetchSubsectorData();
    }
  }, [isSubsectorView, fetchSubsectorData]);

  // Pantau Posisi Skrol
  const handleScroll = () => {
    if (!mainRef.current) return;
    const currentScroll = mainRef.current.scrollTop;

    if (currentScroll > 300) {
      setScrollMode("up");
    } else if (currentScroll <= 50 && lastScrollPos && lastScrollPos > 300) {
      setScrollMode("down");
    } else if (!lastScrollPos) {
      setScrollMode("hidden");
    }
  };

  // Fungsi Toggle: Naik ke Atas / Kembali ke Posisi Terakhir
  const handleScrollToggle = () => {
    if (!mainRef.current) return;

    if (scrollMode === "up") {
      setLastScrollPos(mainRef.current.scrollTop);
      mainRef.current.scrollTo({ top: 0, behavior: "smooth" });
    } else if (scrollMode === "down" && lastScrollPos) {
      mainRef.current.scrollTo({ top: lastScrollPos, behavior: "smooth" });
      setLastScrollPos(null);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-gray-950 relative">
      <Sidebar params={params} onChange={setParams} />

      <main
        ref={mainRef}
        onScroll={handleScroll}
        className="flex flex-col flex-1 min-w-0 overflow-y-auto bg-white dark:bg-gray-950 p-4 sm:p-6 space-y-6 scroll-smooth"
      >
        {isSubsectorView ? (
          /* ================================================================
              MAIN PAGE: SUBSECTOR ANALYSIS (BURSA & US SHARIAH)
             ================================================================ */
          <div className="space-y-6 w-full">
            <header className="border-b border-gray-200 dark:border-gray-800 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <span>{currentMarket === "US" ? "🇺🇸" : "🇲🇾"}</span>
                  <span>
                    {currentMarket === "US"
                      ? "Analisis & Ranking Industri Pasaran US"
                      : "Analisis & Ranking Subsektor Pasaran Bursa"}
                  </span>
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {currentMarket === "US"
                    ? "Data industri US Shariah dikemas kini dari BigQuery (us_stocks_data)"
                    : "Data subsektor Bursa Malaysia dikemas kini dari BigQuery (bursa_dataset)"}
                </p>
              </div>

              {/* Butang Refresh Top Header */}
              <button
                onClick={fetchSubsectorData}
                disabled={loadingSubsector}
                title="Segarkan data terkini"
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg border border-gray-300 dark:border-gray-700 transition disabled:opacity-50 w-fit shadow-sm"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`h-4 w-4 ${loadingSubsector ? "animate-spin text-blue-500" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span>{loadingSubsector ? "Memuatkan..." : "Refresh Data"}</span>
              </button>
            </header>

            {loadingSubsector ? (
              <div className="flex flex-col items-center justify-center p-16 space-y-4">
                <style>{`
                  @keyframes loadProgress35 {
                    0% { width: 0%; }
                    30% { width: 35%; }
                    70% { width: 75%; }
                    100% { width: 98%; }
                  }
                `}</style>

                <div className="w-full max-w-sm space-y-2.5">
                  <div className="flex justify-between items-center text-xs font-semibold text-gray-600 dark:text-gray-400">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-blue-500 animate-ping"></span>
                      Memuatkan data {currentMarket === "US" ? "industri US" : "subsektor Bursa"}...
                    </span>
                    <span className="text-[10px] font-mono tracking-wider text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                      BIGQUERY API
                    </span>
                  </div>

                  {/* Progress Bar Container */}
                  <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2 overflow-hidden relative">
                    <div
                      className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 h-full rounded-full"
                      style={{
                        animation: "loadProgress35 3.0s ease-out forwards",
                      }}
                    />
                  </div>
                </div>

                <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center max-w-xs leading-relaxed">
                  Menyusun ranking momentum, indeks Base 100, & data lilin pasaran {currentMarket}.
                </p>
              </div>
            ) : subsectorError ? (
              <div className="flex flex-col items-center justify-center p-8 rounded-xl bg-rose-500/10 border border-rose-500/30 text-center space-y-3">
                <div className="text-3xl">⚠️</div>
                <div className="text-rose-600 dark:text-rose-400 font-semibold text-base">
                  Ralat Memuatkan Data {currentMarket === "US" ? "Industri US" : "Subsektor"}
                </div>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 max-w-md">
                  {subsectorError}
                </p>
                <button
                  onClick={fetchSubsectorData}
                  className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-medium rounded-lg shadow-sm transition"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  <span>Cuba Semula (Retry)</span>
                </button>
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
                        {currentMarket === "US" ? "Heatmap Industri US" : "Heatmap Subsektor"}
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

                {/* 2. Table & Carta Ranking Subsektor (Collapsible - Split View) */}
                <section className="bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
                  <div
                    onClick={() => setShowRanking(!showRanking)}
                    className="flex items-center justify-between px-4 py-3.5 cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-blue-500"></span>
                      <h2 className="text-base font-bold text-gray-800 dark:text-gray-200">
                        {currentMarket === "US" ? "Ranking Industri US" : "Ranking Subsektor"}
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
                      <RankingTable data={ranksData} theme={params.theme} market={currentMarket} />
                    </div>
                  )}
                </section>

                {/* 3. Table Saham Mengikut Subsektor (Collapsible - Split View) */}
                <section className="bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
                  <div
                    onClick={() => setShowStocksTable(!showStocksTable)}
                    className="flex items-center justify-between px-4 py-3.5 cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
                      <h2 className="text-base font-bold text-gray-800 dark:text-gray-200">
                        {currentMarket === "US"
                          ? "Senarai Saham Mengikut Industri US"
                          : "Senarai Saham Mengikut Subsektor"}
                      </h2>
                    </div>
                    <button
                      type="button"
                      className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-700 shadow-sm"
                    >
                      <span>{showStocksTable ? "Tutup" : "Buka"}</span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-4 w-4 transition-transform duration-200 ${
                          showStocksTable ? "rotate-180" : ""
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  {showStocksTable && (
                    <div className="p-4 border-t border-gray-200 dark:border-gray-800">
                      <SubsectorStocksTable
                        subsectors={ranksData}
                        theme={params.theme}
                        market={currentMarket}
                      />
                    </div>
                  )}
                </section>

                {/* 4. Grid Carta Subsektor (Collapsible - Default: Tutup) */}
                <section className="bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm w-full">
                  <div
                    onClick={() => setShowChartGrid(!showChartGrid)}
                    className="flex items-center justify-between px-4 py-3.5 cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-indigo-500"></span>
                      <h2 className="text-base font-bold text-gray-800 dark:text-gray-200">
                        {currentMarket === "US"
                          ? "Carta Indeks Industri US"
                          : "Carta Indeks Subsektor"}
                      </h2>
                    </div>
                    <button
                      type="button"
                      className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-700 shadow-sm"
                    >
                      <span>{showChartGrid ? "Tutup" : "Buka"}</span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-4 w-4 transition-transform duration-200 ${
                          showChartGrid ? "rotate-180" : ""
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  {showChartGrid && (
                    <div className="p-4 border-t border-gray-200 dark:border-gray-800">
                      <SubsectorChartGrid
                        ranks={ranksData}
                        ohlcData={ohlcBulkData}
                        theme={params.theme}
                      />
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        ) : (
          /* ================================================================
              SECONDARY TAB: GOOGLE SHEETS & MONITORING TRACKER
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
            ) : params.activeTab === "monitoring" ? (
              <TableView
                selectedSheet={{ label: "Stock Monitoring (BigQuery)", url: "monitoring_db" }}
                worksheet="Active Watchlist"
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

      {/* BUTANG TOGGLE SCROLL MEMORY (UP / DOWN) */}
      {scrollMode !== "hidden" && (
        <button
          type="button"
          onClick={handleScrollToggle}
          className={`fixed bottom-6 right-6 z-50 p-3 rounded-full text-white shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-110 focus:outline-none flex items-center justify-center border border-white/20 ${
            scrollMode === "up"
              ? "bg-[#26A69A] hover:bg-[#208a80]"
              : "bg-indigo-600 hover:bg-indigo-700 animate-bounce"
          }`}
          aria-label={scrollMode === "up" ? "Scroll to top" : "Back to last position"}
          title={scrollMode === "up" ? "Naik ke atas" : "Kembali ke kedudukan terakhir"}
        >
          {scrollMode === "up" ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}