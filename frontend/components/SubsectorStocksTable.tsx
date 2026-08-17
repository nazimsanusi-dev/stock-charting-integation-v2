"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { StockChart } from "@/components/StockChart";
import { useChartData } from "@/hooks/useChartData";
import type { SubsectorRank, SubsectorStockItem } from "@/lib/types";
import { KLineStockChart } from "@/components/KLineStockChart";

interface Props {
  subsectors: SubsectorRank[];
  theme?: "dark" | "light";
}

const DEFAULT_CHART_CONFIG = {
  emaPeriods: [5, 10, 20, 50, 100, 200],
  showVolume: true,
  showRsi: false,
  showMacd: true,
  showCvd: false,
  showCmf: true,
};

export function SubsectorStocksTable({ subsectors, theme = "dark" }: Props) {
  const [selectedSubsector, setSelectedSubsector] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [minPrice, setMinPrice] = useState<string>("0.3"); // Default 0.3
  const [stocks, setStocks] = useState<SubsectorStockItem[]>([]);
  const [selectedStock, setSelectedStock] = useState<SubsectorStockItem | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 16;

  const loadStocks = async (subName: string, search: string, minP: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.subsectorStocks(subName, search, minP);
      setStocks(data);
      setCurrentPage(1);
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
    loadStocks(selectedSubsector, searchQuery, minPrice);
  }, [selectedSubsector]);

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadStocks(selectedSubsector, searchQuery, minPrice);
  };

  const activeTicker = selectedStock?.Code
    ? selectedStock.Code.includes(".KL")
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

  return (
    <div className="space-y-4">
      {/* Header Bar: Dropdown Subsektor, Input Min Price & Search */}
      <form
        onSubmit={handleFilterSubmit}
        className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-gray-100/60 dark:bg-gray-800/40 p-3 rounded-xl border border-gray-200 dark:border-gray-800"
      >
        <div className="flex flex-wrap items-center gap-3">
          {/* 1. Dropdown Subsektor */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              Subsektor:
            </label>
            <select
              value={selectedSubsector}
              onChange={(e) => setSelectedSubsector(e.target.value)}
              disabled={loading}
              className="text-xs py-1.5 px-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 font-medium"
            >
              <option value="">#0 All Stock (Semua Saham)</option>
              {subsectors.map((s) => (
                <option key={s.subsector_id} value={s.subsector_name}>
                  #{s.rank} {s.subsector_name} ({s.num_stocks} saham)
                </option>
              ))}
            </select>
          </div>

          {/* 2. Filter Min Price (Default: 0.3) */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
              Min Price (RM):
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.30"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="text-xs py-1.5 px-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 w-20 font-mono focus:outline-none focus:ring-1 focus:ring-[#26A69A]"
            />
          </div>

          {/* 3. Search Bar */}
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              placeholder="Cari kod atau nama..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs py-1.5 px-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#26A69A] w-36 sm:w-48"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-lg bg-[#26A69A] hover:bg-[#208a80] text-white font-medium transition shadow-sm"
          >
            Tapis & Cari
          </button>
        </div>

        <button
          type="button"
          onClick={() => loadStocks(selectedSubsector, searchQuery, minPrice)}
          disabled={loading}
          className="text-xs text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm transition self-end xl:self-auto"
        >
          <span className={loading ? "animate-spin" : ""}>🔄</span> Refresh
        </button>
      </form>

      {/* 2-Column Split View: Kiri (Table) & Kanan (Chart) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* Bahagian Kiri: Table Saham */}
        <div className="xl:col-span-7 flex flex-col space-y-2">
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
              Tiada saham melepasi kriteria penapisan (Min Price: RM{minPrice || "0"}).
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-gray-100 dark:bg-gray-800/80 text-gray-600 dark:text-gray-400 uppercase tracking-wider font-semibold border-b border-gray-200 dark:border-gray-800">
                    <tr>
                      <th className="py-2.5 px-3 text-left">Kod</th>
                      <th className="py-2.5 px-3 text-left">Nama</th>
                      <th className="py-2.5 px-2 text-center">Syariah</th>
                      <th className="py-2.5 px-3 text-right">Harga</th>
                      <th className="py-2.5 px-3 text-right">Perubahan</th>
                      <th className="py-2.5 px-3 text-right">Change %</th>
                      <th className="py-2.5 px-3 text-right">Volume</th>
                      <th className="py-2.5 px-3 text-right">MCap (M)</th>
                      <th className="py-2.5 px-3 text-left">Sector</th>
                      <th className="py-2.5 px-3 text-left">Subsector</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800/60">
                    {paginatedStocks.map((item, idx) => {
                      const changeVal = parseFloat(
                        item.Change_Percent.replace("%", "").replace("+", "")
                      );
                      const isPos = changeVal > 0;
                      const isNeg = changeVal < 0;
                      const isSelected = selectedStock?.Code === item.Code;

                      return (
                        <tr
                          key={idx}
                          onClick={() => setSelectedStock(item)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-amber-500/15 dark:bg-amber-500/20 font-semibold"
                              : "hover:bg-gray-100/70 dark:hover:bg-gray-800/50"
                          }`}
                        >
                          <td className="py-2 px-3 font-mono font-bold text-gray-900 dark:text-gray-100">
                            {isSelected && <span className="text-amber-500 mr-1">▶</span>}
                            {item.Code}
                          </td>
                          <td className="py-2 px-3 text-gray-800 dark:text-gray-200 truncate max-w-[120px]">
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
                            {item.Price}
                          </td>
                          <td
                            className={`py-2 px-3 text-right font-mono font-medium ${
                              isPos ? "text-emerald-500" : isNeg ? "text-rose-500" : "text-gray-400"
                            }`}
                          >
                            {item.Change}
                          </td>
                          <td
                            className={`py-2 px-3 text-right font-mono font-bold ${
                              isPos ? "text-emerald-500" : isNeg ? "text-rose-500" : "text-gray-400"
                            }`}
                          >
                            {item.Change_Percent}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-gray-500 dark:text-gray-400">
                            {item.Volume}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-gray-600 dark:text-gray-300">
                            {item.MCap_M}
                          </td>
                          <td className="py-2 px-3 text-left text-gray-500 dark:text-gray-400 truncate max-w-[110px]">
                            {item.Scraped_Sector || "-"}
                          </td>
                          <td className="py-2 px-3 text-left text-gray-500 dark:text-gray-400 truncate max-w-[120px]">
                            {item.Scraped_Subsector || "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Bar Pagination */}
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

        {/* Bahagian Kanan: Carta KLineCharts */}
        <div className="xl:col-span-5 flex flex-col bg-white dark:bg-[#121722] border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm min-h-[580px]">
          {selectedStock ? (
            <>
              <div className="p-3 bg-gray-50 dark:bg-slate-900/70 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      {selectedStock.Name}
                    </h3>
                    <span className="text-xs font-mono font-bold text-amber-500 dark:text-amber-400">
                      {selectedStock.Code}.KL
                    </span>
                    {selectedStock.Shariah === "Yes" && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-bold border border-emerald-500/30">
                        [S]
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    <span>Harga: <strong className="text-gray-800 dark:text-gray-200">RM{selectedStock.Price}</strong></span>
                    <span>•</span>
                    <span
                      className={`font-semibold ${
                        parseFloat(selectedStock.Change_Percent) >= 0 ? "text-emerald-500" : "text-rose-500"
                      }`}
                    >
                      {selectedStock.Change_Percent} ({selectedStock.Change})
                    </span>
                  </div>
                </div>

                <div className="text-right text-[11px] text-gray-500 dark:text-slate-400">
                  <div>Vol: <span className="font-mono text-gray-700 dark:text-gray-300">{selectedStock.Volume}</span></div>
                  <div>MCap: <span className="font-mono text-gray-700 dark:text-gray-300">RM{selectedStock.MCap_M}M</span></div>
                </div>
              </div>

              <div className="flex-1 p-2 min-h-[520px]">
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
                  <KLineStockChart
                    data={chart.data}
                    ticker={`${selectedStock.Code}.KL`}
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
    </div>
  );
}