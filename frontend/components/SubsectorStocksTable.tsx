"use client";

import { useState, useEffect, useMemo } from "react";
import { api, MarketType } from "@/lib/api";
import { useChartData } from "@/hooks/useChartData";
import type { SubsectorRank, SubsectorStockItem, ChartData } from "@/lib/types";
import dynamic from "next/dynamic";

const StockChart = dynamic(
  () => import("@/components/StockChart").then((mod) => mod.StockChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-full min-h-[300px] flex items-center justify-center text-xs text-gray-400">
        <span className="animate-spin inline-block mr-2">⏳</span> Memuatkan carta...
      </div>
    ),
  }
);

interface Props {
  subsectors: SubsectorRank[];
  theme?: "dark" | "light";
  market?: MarketType;
}

// Konfigurasi carta paparan penuh (Split View)
const DEFAULT_CHART_CONFIG = {
  emaPeriods: [5, 10, 20, 50, 100, 200],
  showVolume: true,
  showRsi: false,
  showMacd: true,
  showCvd: false,
  showCmf: true,
};

// Konfigurasi ringkas & kemas khas untuk paparan Grid (elak garisan berserabut)
const GRID_CHART_CONFIG = {
  emaPeriods: [5, 10, 20, 50, 100, 200],
  showVolume: true,
  showRsi: false,
  showMacd: true,
  showCvd: false,
  showCmf: false,
};

function renderRecommendationBadge(rec: string | null | undefined) {
  if (!rec || rec === "-" || rec === "None") {
    return <span className="text-gray-400 text-[10px]">-</span>;
  }
  const clean = rec.trim();
  const lower = clean.toLowerCase();

  let colorClass = "bg-gray-500/10 text-gray-400 border-gray-500/30";
  if (lower.includes("buy")) {
    colorClass = "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-bold";
  } else if (lower.includes("hold") || lower.includes("neutral")) {
    colorClass = "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 font-medium";
  } else if (lower.includes("sell") || lower.includes("underperform")) {
    colorClass = "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 font-bold";
  }

  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] border ${colorClass}`}>
      {clean}
    </span>
  );
}

function renderCapClassBadge(capClass: string | null | undefined) {
  if (!capClass || capClass === "-" || capClass === "None") {
    return <span className="text-gray-400 text-[10px]">-</span>;
  }
  const formatted = capClass.replace(/_/g, " ").trim();
  const lower = formatted.toLowerCase();

  let colorClass = "bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20";
  if (lower.includes("mega") || lower.includes("large")) {
    colorClass = "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30 font-semibold";
  } else if (lower.includes("mid")) {
    colorClass = "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30";
  } else if (lower.includes("small") || lower.includes("micro") || lower.includes("nano")) {
    colorClass = "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30";
  }

  return (
    <span className={`px-1.5 py-0.5 rounded text-[9px] border whitespace-nowrap ${colorClass}`}>
      {formatted}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-Komponen Kad Carta Individu (Grid View)
// ─────────────────────────────────────────────────────────────
function SingleStockGridCard({
  item,
  market,
  theme,
  currencySymbol,
  onAddToMonitoring,
  monitorStatus,
}: {
  item: SubsectorStockItem;
  market: MarketType;
  theme: "dark" | "light";
  currencySymbol: string;
  onAddToMonitoring: (item: any) => void;
  monitorStatus: string;
}) {
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const isDark = theme === "dark";

  const formattedTicker = item.Code
    ? market === "US"
      ? item.Code.replace(".KL", "").trim().toUpperCase()
      : item.Code.includes(".KL")
      ? item.Code
      : `${item.Code}.KL`
    : "";

  useEffect(() => {
    let isMounted = true;
    if (!formattedTicker) return;

    setLoading(true);
    setError(null);

    api
      .getChartData(formattedTicker, "1y", "1d", GRID_CHART_CONFIG.emaPeriods)
      .then((res) => {
        if (isMounted) setChartData(res);
      })
      .catch((err) => {
        if (isMounted) {
          console.error(`Gagal memuatkan carta ${formattedTicker}:`, err);
          setError("Data tidak tersedia");
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [formattedTicker, market]);

  return (
    <div
      className={`flex flex-col h-[480px] sm:h-[520px] rounded-xl overflow-hidden shadow-sm border transition-all ${
        isDark ? "bg-[#121722] border-gray-800" : "bg-white border-gray-200"
      }`}
    >
      {/* 1. Header Kad Saham */}
      <div
        className={`shrink-0 flex items-center justify-between px-3 py-2 border-b ${
          isDark
            ? "bg-[#18202f] border-gray-800 text-gray-100"
            : "bg-gray-100 border-gray-200 text-gray-800"
        }`}
      >
        <div className="flex items-center gap-1.5 truncate max-w-[65%]">
          <span className="font-mono font-bold text-xs text-amber-500">
            {item.Code}
          </span>
          <span
            className={`text-xs font-semibold truncate ${
              isDark ? "text-gray-200" : "text-gray-800"
            }`}
            title={item.Name}
          >
            {item.Name}
          </span>
          {item.Shariah === "Yes" && (
            <span className="px-1 py-0.2 text-[9px] font-bold rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
              [S]
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`font-mono font-bold text-xs ${
              isDark ? "text-gray-100" : "text-gray-900"
            }`}
          >
            {currencySymbol}
            {item.Price !== null && item.Price !== undefined
              ? Number(item.Price).toFixed(2)
              : "-"}
          </span>
          <button
            type="button"
            disabled={monitorStatus === "loading"}
            onClick={() => onAddToMonitoring(item)}
            className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold transition-all ${
              monitorStatus === "success"
                ? "bg-emerald-500 text-white"
                : monitorStatus === "loading"
                ? "bg-gray-200 dark:bg-slate-700 text-gray-400"
                : "bg-[#26A69A]/15 text-[#26A69A] hover:bg-[#26A69A] hover:text-white"
            }`}
            title="Tambah ke Stock Monitoring"
          >
            {monitorStatus === "loading" ? (
              <span className="w-2.5 h-2.5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            ) : monitorStatus === "success" ? (
              "✓"
            ) : (
              "+"
            )}
          </button>
        </div>
      </div>

      {/* 2. Badan Carta: Memenuhi baki ruang kad dengan selamat tanpa overflow */}
      <div className="flex-1 min-h-0 w-full p-1 relative overflow-hidden">
        {loading ? (
          <div className="h-full flex items-center justify-center text-xs text-gray-400">
            <span className="animate-spin mr-1.5">⏳</span> Memuatkan {item.Code}...
          </div>
        ) : error || !chartData ? (
          <div className="h-full flex items-center justify-center text-xs text-rose-500">
            {error || "Tiada data carta"}
          </div>
        ) : (
          <StockChart
            data={chartData}
            ticker={formattedTicker}
            config={GRID_CHART_CONFIG}
            theme={theme}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Komponen Utama SubsectorStocksTable
// ─────────────────────────────────────────────────────────────
export function SubsectorStocksTable({
  subsectors,
  theme = "dark",
  market = "MY",
}: Props) {
  const [selectedSubsector, setSelectedSubsector] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [minPrice, setMinPrice] = useState<string>(market === "US" ? "1.0" : "0.3");
  const [stocks, setStocks] = useState<SubsectorStockItem[]>([]);
  const [selectedStock, setSelectedStock] = useState<SubsectorStockItem | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Mod Paparan: "split" (Jadual + Carta Tunggal) | "grid" (Semua Carta Saham)
  const [viewMode, setViewMode] = useState<"split" | "grid">("split");

  // Pagination Jadual
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 16;

  // Pagination Grid Carta
  const [gridPage, setGridPage] = useState<number>(1);
  const gridPageSize = 6;

  const loadStocks = async (subName: string, search: string, minP: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.subsectorStocks(subName, search, minP, market);
      setStocks(data);
      setCurrentPage(1);
      setGridPage(1);
      if (data && data.length > 0) {
        setSelectedStock(data[0]);
      } else {
        setSelectedStock(null);
      }
    } catch (err: any) {
      setError("Gagal memuatkan senarai saham.");
      setSelectedStock(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedSubsector("");
    setSearchQuery("");
    setMinPrice(market === "US" ? "1.0" : "0.3");
  }, [market]);

  useEffect(() => {
    loadStocks(selectedSubsector, searchQuery, minPrice);
  }, [selectedSubsector, market]);

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadStocks(selectedSubsector, searchQuery, minPrice);
  };

  const activeTicker = selectedStock?.Code
    ? market === "US"
      ? selectedStock.Code.replace(".KL", "").trim().toUpperCase()
      : selectedStock.Code.includes(".KL")
      ? selectedStock.Code
      : `${selectedStock.Code}.KL`
    : null;

  const chart = useChartData(
    activeTicker,
    "1y",
    "1d",
    DEFAULT_CHART_CONFIG.emaPeriods
  );

  const totalPages = Math.ceil(stocks.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedStocks = stocks.slice(startIndex, startIndex + pageSize);

  const totalGridPages = Math.ceil(stocks.length / gridPageSize) || 1;
  const paginatedGridStocks = useMemo(() => {
    const start = (gridPage - 1) * gridPageSize;
    return stocks.slice(start, start + gridPageSize);
  }, [stocks, gridPage]);

  const [monitorStatus, setMonitorStatus] = useState<Record<string, "idle" | "loading" | "success">>({});

  const handleAddToMonitoring = async (item: any) => {
    const code = item.Code;
    if (monitorStatus[code] === "loading") return;

    setMonitorStatus((prev) => ({ ...prev, [code]: "loading" }));

    try {
      const res = await fetch("https://stock-charting-integation-v2.nazimsanusi01.workers.dev/api/monitoring/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: item.Code,
          name: item.Name,
          price: item.Price,
          sector: item.Scraped_Sector || "-",
          subsector: item.Scraped_Subsector || "-",
          source_table: market === "US" ? "US Subsector Analysis" : "Subsector Analysis",
          market: market,
        }),
      });

      if (!res.ok) throw new Error("Gagal memasukkan rekod");

      setMonitorStatus((prev) => ({ ...prev, [code]: "success" }));

      setTimeout(() => {
        setMonitorStatus((prev) => ({ ...prev, [code]: "idle" }));
      }, 1500);
    } catch (err) {
      console.error("Gagal menambah ke database:", err);
      setMonitorStatus((prev) => ({ ...prev, [code]: "idle" }));
    }
  };

  const currencySymbol = market === "US" ? "$" : "RM";

  return (
    <div className="space-y-4">
      {/* ─────────────────────────────────────────────────────────────
          1. Header Bar & Bar Penapisan
      ───────────────────────────────────────────────────────────── */}
      <form
        onSubmit={handleFilterSubmit}
        className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-gray-100/60 dark:bg-gray-800/40 p-3 rounded-xl border border-gray-200 dark:border-gray-800"
      >
        <div className="flex flex-wrap items-center gap-3">
          {/* Dropdown Subsektor / Industri */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              {market === "US" ? "Industri:" : "Subsektor:"}
            </label>
            <select
              value={selectedSubsector}
              onChange={(e) => setSelectedSubsector(e.target.value)}
              disabled={loading}
              className="text-xs py-1.5 px-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 font-medium cursor-pointer"
            >
              <option value="">#0 All Stock (Semua Saham)</option>
              {subsectors.map((s) => (
                <option key={s.subsector_id} value={s.subsector_name}>
                  #{s.rank} {s.subsector_name} ({s.num_stocks} saham)
                </option>
              ))}
            </select>
          </div>

          {/* Filter Min Price */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
              Min Price ({currencySymbol}):
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder={market === "US" ? "1.00" : "0.30"}
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="text-xs py-1.5 px-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 w-20 font-mono focus:outline-none focus:ring-1 focus:ring-[#26A69A]"
            />
          </div>

          {/* Search Bar */}
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              placeholder={market === "US" ? "Cari Symbol / Syarikat US..." : "Cari kod atau nama..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs py-1.5 px-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#26A69A] w-36 sm:w-48"
            />
          </div>

          {/* Butang Tapis & Cari */}
          <button
            type="submit"
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-lg bg-[#26A69A] hover:bg-[#208a80] text-white font-medium transition shadow-sm"
          >
            Tapis & Cari
          </button>

          {/* ⭐ Butang Toggle Paparan Grid vs Jadual */}
          <button
            type="button"
            disabled={loading || stocks.length === 0}
            onClick={() => setViewMode((prev) => (prev === "split" ? "grid" : "split"))}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition shadow-sm flex items-center gap-1.5 ${
              viewMode === "grid"
                ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-500"
                : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-700 hover:border-amber-500"
            }`}
            title="Tukar paparan antara jadual dan grid semua carta"
          >
            {viewMode === "grid" ? (
              <>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <path d="M3 9h18M9 21V9" />
                </svg>
                <span>Paparan Jadual</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect width="7" height="7" x="3" y="3" rx="1" />
                  <rect width="7" height="7" x="14" y="3" rx="1" />
                  <rect width="7" height="7" x="14" y="14" rx="1" />
                  <rect width="7" height="7" x="3" y="14" rx="1" />
                </svg>
                <span>Papar Semua Carta ({stocks.length})</span>
              </>
            )}
          </button>
        </div>

        {/* Butang Refresh */}
        <button
          type="button"
          onClick={() => loadStocks(selectedSubsector, searchQuery, minPrice)}
          disabled={loading}
          className="text-xs text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm transition self-end xl:self-auto"
        >
          <span className={loading ? "animate-spin" : ""}>🔄</span> Refresh
        </button>
      </form>

      {/* ─────────────────────────────────────────────────────────────
          2. Kandungan Utama (Mod Grid vs Mod Split)
      ───────────────────────────────────────────────────────────── */}
      {viewMode === "grid" ? (
        /* ═════════════════════════════════════════════════════════════
           MOD A: GRID SEMUA CARTA SAHAM
        ═════════════════════════════════════════════════════════════ */
        <div className="space-y-4">
          {loading ? (
            <div className="py-24 text-center text-xs text-gray-400 border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900/30">
              <span className="animate-spin inline-block mr-2 text-base">⏳</span>
              Memuatkan senarai carta...
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-xl text-center">
              {error}
            </div>
          ) : stocks.length === 0 ? (
            <div className="py-20 text-center text-xs text-gray-400 border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900/30">
              Tiada saham melepasi kriteria penapisan.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {paginatedGridStocks.map((item) => (
                  <SingleStockGridCard
                    key={item.Code}
                    item={item}
                    market={market}
                    theme={theme}
                    currencySymbol={currencySymbol}
                    onAddToMonitoring={handleAddToMonitoring}
                    monitorStatus={monitorStatus[item.Code] || "idle"}
                  />
                ))}
              </div>

              {/* Pagination Grid */}
              {totalGridPages > 1 && (
                <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-900/90 border border-gray-200 dark:border-gray-800 rounded-xl text-[11px] text-gray-500 dark:text-gray-400">
                  <div>
                    Menunjukkan {(gridPage - 1) * gridPageSize + 1}–
                    {Math.min(gridPage * gridPageSize, stocks.length)} daripada {stocks.length} carta saham
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setGridPage((p) => Math.max(1, p - 1))}
                      disabled={gridPage === 1}
                      className="px-2 py-0.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      ◀ Prev
                    </button>
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {gridPage}/{totalGridPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setGridPage((p) => Math.min(totalGridPages, p + 1))}
                      disabled={gridPage === totalGridPages}
                      className="px-2 py-0.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next ▶
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        /* ═════════════════════════════════════════════════════════════
           MOD B: SPLIT VIEW (JADUAL KIRI + CARTA KANAN)
        ═════════════════════════════════════════════════════════════ */
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
          {/* Bahagian Kiri: Jadual Saham */}
          <div className="xl:col-span-6 flex flex-col space-y-2">
            {loading ? (
              <div className="py-24 text-center text-xs text-gray-400 border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900/30">
                <span className="animate-spin inline-block mr-2 text-base">⏳</span>
                Memuatkan senarai saham...
              </div>
            ) : error ? (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-xl text-center">
                {error} -{" "}
                <button
                  onClick={() => loadStocks(selectedSubsector, searchQuery, minPrice)}
                  className="underline font-bold"
                >
                  Cuba Lagi
                </button>
              </div>
            ) : stocks.length === 0 ? (
              <div className="py-20 text-center text-xs text-gray-400 border border-gray-200 dark:border-gray-800 rounded-xl">
                Tiada saham melepasi kriteria penapisan (Min Price: {currencySymbol}{minPrice || "0"}).
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 shadow-sm">
                <div className="overflow-x-auto [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-thumb]:rounded-full">
                  <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
                    <thead className="bg-gray-100 dark:bg-gray-800/80 text-gray-600 dark:text-gray-400 uppercase tracking-wider font-semibold border-b border-gray-200 dark:border-gray-800">
                      <tr>
                        <th className="py-2.5 px-3 text-left sticky left-0 z-20 bg-gray-100 dark:bg-gray-800 min-w-[75px] max-w-[75px]">
                          {market === "US" ? "Symbol" : "Kod"}
                        </th>
                        <th className="py-2.5 px-3 text-left sticky left-[75px] z-20 bg-gray-100 dark:bg-gray-800 min-w-[125px] max-w-[125px] border-r border-gray-200 dark:border-gray-800 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.12)]">
                          Nama
                        </th>
                        <th className="py-2.5 px-2 text-center">Syariah</th>
                        <th className="py-2.5 px-3 text-right">Harga</th>

                        {market === "US" ? (
                          <>
                            <th className="py-2.5 px-3 text-center">Rec.</th>
                            <th className="py-2.5 px-3 text-center">Cap Class</th>
                            <th className="py-2.5 px-3 text-right">MCap (M)</th>
                            <th className="py-2.5 px-3 text-left">Sector</th>
                            <th className="py-2.5 px-3 text-left">Industry</th>
                          </>
                        ) : (
                          <>
                            <th className="py-2.5 px-3 text-right">Perubahan</th>
                            <th className="py-2.5 px-3 text-right">Change %</th>
                            <th className="py-2.5 px-3 text-right">Volume</th>
                            <th className="py-2.5 px-3 text-right">MCap (M)</th>
                            <th className="py-2.5 px-3 text-left">Sector</th>
                            <th className="py-2.5 px-3 text-left">Subsector</th>
                          </>
                        )}

                        <th className="py-2.5 px-2 text-center sticky right-0 z-20 bg-gray-100 dark:bg-gray-800 w-12 min-w-[48px] border-l border-gray-200 dark:border-gray-800">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800/60">
                      {paginatedStocks.map((item: any, idx: number) => {
                        const changeVal = parseFloat(
                          String(item.Change_Percent || "0").replace("%", "").replace("+", "")
                        );
                        const isPos = changeVal > 0;
                        const isNeg = changeVal < 0;
                        const isSelected = selectedStock?.Code === item.Code;
                        const status = monitorStatus[item.Code] || "idle";

                        const stickyBg = isSelected
                          ? "bg-amber-100/90 dark:bg-[#281e0f]"
                          : "bg-white dark:bg-[#111827] group-hover:bg-gray-100 dark:group-hover:bg-gray-800";

                        return (
                          <tr
                            key={idx}
                            onClick={() => setSelectedStock(item)}
                            className={`group cursor-pointer transition-colors ${
                              isSelected
                                ? "bg-amber-500/15 dark:bg-amber-500/20 font-semibold"
                                : "hover:bg-gray-100/70 dark:hover:bg-gray-800/50"
                            }`}
                          >
                            <td
                              className={`py-2 px-3 font-mono font-bold text-gray-900 dark:text-gray-100 sticky left-0 z-[5] min-w-[75px] max-w-[75px] ${stickyBg}`}
                            >
                              {isSelected && <span className="text-amber-500 mr-1">▶</span>}
                              {item.Code}
                            </td>

                            <td
                              className={`py-2 px-3 text-gray-800 dark:text-gray-200 truncate min-w-[125px] max-w-[125px] sticky left-[75px] z-[5] border-r border-gray-200 dark:border-gray-800 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.12)] ${stickyBg}`}
                            >
                              {item.Name}
                            </td>

                            <td className="py-2 px-2 text-center">
                              {item.Shariah === "Yes" ? (
                                <span className="px-1 py-0.5 text-[9px] font-bold rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
                                  [S]
                                </span>
                              ) : (
                                <span className="text-[10px] text-gray-400">-</span>
                              )}
                            </td>

                            <td className="py-2 px-3 text-right font-mono font-semibold text-gray-900 dark:text-gray-100">
                              {item.Price !== null && item.Price !== undefined ? Number(item.Price).toFixed(2) : "-"}
                            </td>

                            {market === "US" ? (
                              <>
                                <td className="py-2 px-3 text-center">
                                  {renderRecommendationBadge(item.recommendation)}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  {renderCapClassBadge(item.marketCapClassification)}
                                </td>
                                <td className="py-2 px-3 text-right font-mono text-gray-600 dark:text-gray-300">
                                  {item.MCap_M !== null && item.MCap_M !== undefined ? Number(item.MCap_M).toLocaleString() : "-"}
                                </td>
                                <td className="py-2 px-3 text-left text-gray-500 dark:text-gray-400 truncate max-w-[110px]">
                                  {item.Scraped_Sector || "-"}
                                </td>
                                <td className="py-2 px-3 text-left text-gray-500 dark:text-gray-400 truncate max-w-[120px]">
                                  {item.Scraped_Subsector || "-"}
                                </td>
                              </>
                            ) : (
                              <>
                                <td
                                  className={`py-2 px-3 text-right font-mono font-medium ${
                                    isPos ? "text-emerald-500" : isNeg ? "text-rose-500" : "text-gray-400"
                                  }`}
                                >
                                  {item.Change ?? "-"}
                                </td>
                                <td
                                  className={`py-2 px-3 text-right font-mono font-bold ${
                                    isPos ? "text-emerald-500" : isNeg ? "text-rose-500" : "text-gray-400"
                                  }`}
                                >
                                  {item.Change_Percent ?? "-"}
                                </td>
                                <td className="py-2 px-3 text-right font-mono text-gray-500 dark:text-gray-400">
                                  {item.Volume ?? "-"}
                                </td>
                                <td className="py-2 px-3 text-right font-mono text-gray-600 dark:text-gray-300">
                                  {item.MCap_M ?? "-"}
                                </td>
                                <td className="py-2 px-3 text-left text-gray-500 dark:text-gray-400 truncate max-w-[110px]">
                                  {item.Scraped_Sector || "-"}
                                </td>
                                <td className="py-2 px-3 text-left text-gray-500 dark:text-gray-400 truncate max-w-[120px]">
                                  {item.Scraped_Subsector || "-"}
                                </td>
                              </>
                            )}

                            <td
                              className={`py-1.5 px-2 text-center sticky right-0 z-[5] w-12 min-w-[48px] border-l border-gray-200 dark:border-gray-800 ${stickyBg}`}
                            >
                              <button
                                type="button"
                                disabled={status === "loading"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddToMonitoring(item);
                                }}
                                className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold transition-all mx-auto ${
                                  status === "success"
                                    ? "bg-emerald-500 text-white shadow-sm"
                                    : status === "loading"
                                    ? "bg-gray-200 dark:bg-slate-700 text-gray-400"
                                    : "bg-[#26A69A]/15 text-[#26A69A] hover:bg-[#26A69A] hover:text-white border border-[#26A69A]/30"
                                }`}
                                title="Tambah ke Stock Monitoring"
                              >
                                {status === "loading" ? (
                                  <span className="w-3 h-3 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                                ) : status === "success" ? (
                                  "✓"
                                ) : (
                                  "+"
                                )}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Jadual */}
                {stocks.length > pageSize && (
                  <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-900/90 border-t border-gray-200 dark:border-gray-800 text-[11px] text-gray-500 dark:text-gray-400">
                    <div>
                      {startIndex + 1}–{Math.min(startIndex + pageSize, stocks.length)} dari {stocks.length} saham
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-2 py-0.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        ◀ Prev
                      </button>
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        {currentPage}/{totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-2 py-0.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Next ▶
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bahagian Kanan: Carta Saham Pilihan (Split View) */}
          <div className="xl:col-span-6 flex flex-col bg-white dark:bg-[#121722] border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm h-[560px] xl:h-[620px]">
            {selectedStock ? (
              <>
                <div className="p-3 bg-gray-50 dark:bg-slate-900/70 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                        {selectedStock.Name}
                      </h3>
                      <span className="text-xs font-mono font-bold text-amber-500 dark:text-amber-400">
                        {activeTicker}
                      </span>
                      {selectedStock.Shariah === "Yes" && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-bold border border-emerald-500/30">
                          [S]
                        </span>
                      )}
                      {market === "US" && selectedStock.recommendation && (
                        renderRecommendationBadge(selectedStock.recommendation)
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                      <span>Harga: <strong className="text-gray-800 dark:text-gray-200">{currencySymbol}{selectedStock.Price}</strong></span>
                      {market === "US" && selectedStock.marketCapClassification && (
                        <>
                          <span>•</span>
                          <span>Cap: <strong className="text-gray-800 dark:text-gray-200">{selectedStock.marketCapClassification.replace(/_/g, " ")}</strong></span>
                        </>
                      )}
                      {market !== "US" && selectedStock.Change_Percent && (
                        <>
                          <span>•</span>
                          <span
                            className={`font-semibold ${
                              parseFloat(String(selectedStock.Change_Percent)) >= 0 ? "text-emerald-500" : "text-rose-500"
                            }`}
                          >
                            {selectedStock.Change_Percent} ({selectedStock.Change ?? "-"})
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-right text-[11px] text-gray-500 dark:text-slate-400">
                    {market !== "US" && (
                      <div>Vol: <span className="font-mono text-gray-700 dark:text-gray-300">{selectedStock.Volume ?? "-"}</span></div>
                    )}
                    <div>MCap: <span className="font-mono text-gray-700 dark:text-gray-300">{currencySymbol}{selectedStock.MCap_M ?? "-"}M</span></div>
                  </div>
                </div>

                <div className="flex-1 min-h-0 w-full p-2 relative overflow-hidden">
                  {chart.loading ? (
                    <div className="h-full flex items-center justify-center text-xs text-gray-400">
                      <span className="animate-spin inline-block mr-2">⏳</span> Memuatkan carta...
                    </div>
                  ) : chart.error ? (
                    <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-2">
                      <p className="text-xs text-rose-500">{chart.error}</p>
                      <button
                        type="button"
                        onClick={chart.refetch}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs"
                      >
                        🔄 Cuba Semula
                      </button>
                    </div>
                  ) : chart.data ? (
                    <StockChart
                      data={chart.data}
                      ticker={activeTicker || ""}
                      config={DEFAULT_CHART_CONFIG}
                      theme={theme}
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-gray-400">
                      Tiada data carta didapati.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="h-full min-h-[450px] flex items-center justify-center text-xs text-gray-400 p-8 text-center">
                Pilih mana-mana baris saham di sebelah kiri untuk melihat carta.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}