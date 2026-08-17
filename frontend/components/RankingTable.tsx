"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { SubsectorRank, ChartData } from "@/lib/types";
import dynamic from "next/dynamic";

const StockChart = dynamic(
  () => import("@/components/StockChart").then((mod) => mod.StockChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-full min-h-[500px] flex items-center justify-center text-xs text-gray-400">
        <span className="animate-spin inline-block mr-2">⏳</span> Memuatkan carta...
      </div>
    ),
  }
);

interface Props {
  data: SubsectorRank[];
  theme?: "light" | "dark";
}

const DEFAULT_CHART_CONFIG = {
  emaPeriods: [5, 10, 20, 50, 100, 200],
  showVolume: true,
  showRsi: false,
  showMacd: true,
  showCvd: false,
  showCmf: true,
};

export function RankingTable({ data, theme = "dark" }: Props) {
  const [selectedSubsector, setSelectedSubsector] = useState<SubsectorRank | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 12;

  // State untuk Data Carta Single Subsector
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [chartLoading, setChartLoading] = useState<boolean>(false);
  const [chartError, setChartError] = useState<string | null>(null);

  // Set subsektor pertama secara default
  useEffect(() => {
    if (data && data.length > 0 && !selectedSubsector) {
      setSelectedSubsector(data[0]);
    }
  }, [data, selectedSubsector]);

  // Panggil API Single Subsector apabila selectedSubsector bertukar
  useEffect(() => {
    if (!selectedSubsector) return;

    let isMounted = true;
    setChartLoading(true);
    setChartError(null);

    api
      .subsectorSingleOHLC(selectedSubsector.subsector_id)
      .then((res) => {
        if (isMounted) {
          setChartData({
            ...res,
            ticker: selectedSubsector.subsector_name,
          });
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error(err);
          setChartError("Gagal memuatkan data carta.");
          setChartData(null);
        }
      })
      .finally(() => {
        if (isMounted) setChartLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedSubsector]);

  // Penapisan Carian
  const filteredData = data.filter((item) =>
    item.subsector_name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedData = filteredData.slice(startIndex, startIndex + pageSize);

  return (
    <div className="space-y-4">
      {/* Search Header */}
      <div className="flex items-center justify-between gap-3 bg-gray-100/60 dark:bg-gray-800/40 p-2.5 rounded-xl border border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Cari nama subsektor..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="text-xs py-1.5 px-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-48 sm:w-64"
          />
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Jumlah: {filteredData.length} subsektor
          </span>
        </div>
      </div>

      {/* 2-Column Split View: Kiri (Table) & Kanan (Chart) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* Bahagian Kiri: Jadual Ranking */}
        <div className="xl:col-span-7 flex flex-col space-y-2">
          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-gray-100 dark:bg-gray-800/80 text-gray-600 dark:text-gray-400 uppercase tracking-wider font-semibold border-b border-gray-200 dark:border-gray-800">
                  <tr>
                    <th className="py-2.5 px-3 text-center">Rank</th>
                    <th className="py-2.5 px-3 text-left">Subsektor</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Score</th>
                    <th className="py-2.5 px-3 text-right">5D %</th>
                    <th className="py-2.5 px-3 text-right">20D %</th>
                    <th className="py-2.5 px-3 text-right">Close Index</th>
                    <th className="py-2.5 px-3 text-right">Saham</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800/60">
                  {paginatedData.map((item) => {
                    const isSelected = selectedSubsector?.subsector_id === item.subsector_id;
                    const is5dPos = (item.return_5d ?? 0) >= 0;
                    const is20dPos = (item.return_20d ?? 0) >= 0;

                    return (
                      <tr
                        key={item.subsector_id}
                        onClick={() => setSelectedSubsector(item)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-blue-500/15 dark:bg-blue-500/20 font-semibold"
                            : "hover:bg-gray-100/70 dark:hover:bg-gray-800/50"
                        }`}
                      >
                        <td className="py-2.5 px-3 text-center font-bold">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${
                              item.rank <= 3
                                ? "bg-amber-500 text-white font-black"
                                : item.rank <= 10
                                ? "bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold"
                                : "text-gray-500"
                            }`}
                          >
                            #{item.rank}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-gray-900 dark:text-gray-100">
                          {isSelected && <span className="text-blue-500 mr-1">▶</span>}
                          {item.subsector_name}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              item.status === "Bullish"
                                ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30"
                                : item.status === "Bearish"
                                ? "bg-rose-500/10 text-rose-600 border border-rose-500/30"
                                : "bg-gray-500/10 text-gray-400"
                            }`}
                          >
                            {item.status || "-"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-800 dark:text-gray-200">
                          {item.score !== undefined ? item.score.toFixed(2) : "-"}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono font-medium ${
                            is5dPos ? "text-emerald-500" : "text-rose-500"
                          }`}
                        >
                          {item.return_5d !== undefined
                            ? `${is5dPos ? "+" : ""}${item.return_5d.toFixed(2)}%`
                            : "-"}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono ${
                            is20dPos ? "text-emerald-500" : "text-rose-500"
                          }`}
                        >
                          {item.return_20d !== undefined
                            ? `${is20dPos ? "+" : ""}${item.return_20d.toFixed(2)}%`
                            : "-"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-gray-600 dark:text-gray-300">
                          {item.close_index !== undefined ? item.close_index.toFixed(2) : "-"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-gray-500 dark:text-gray-400">
                          {item.num_stocks ?? "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {filteredData.length > pageSize && (
              <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-900/90 border-t border-gray-200 dark:border-gray-800 text-[11px] text-gray-500 dark:text-gray-400">
                <div>
                  {startIndex + 1}–{Math.min(startIndex + pageSize, filteredData.length)} dari {filteredData.length} subsektor
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
        </div>

        {/* Bahagian Kanan: Carta Indeks Subsektor */}
        <div className="xl:col-span-5 flex flex-col bg-white dark:bg-[#121722] border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm min-h-[580px]">
          {selectedSubsector ? (
            <>
              <div className="p-3 bg-gray-50 dark:bg-slate-900/70 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-xs">
                      #{selectedSubsector.rank}
                    </span>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      {selectedSubsector.subsector_name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    <span>
                      Score:{" "}
                      <strong className="text-gray-800 dark:text-gray-200">
                        {selectedSubsector.score?.toFixed(2) ?? "-"}
                      </strong>
                    </span>
                    <span>•</span>
                    <span>Close: <strong className="text-gray-800 dark:text-gray-200">{selectedSubsector.close_index?.toFixed(2) ?? "-"}</strong></span>
                    <span>•</span>
                    <span>{selectedSubsector.num_stocks ?? 0} saham</span>
                  </div>
                </div>

                <div className="text-right text-[11px] text-gray-500 dark:text-slate-400">
                  <div>
                    5D:{" "}
                    <span
                      className={`font-mono font-semibold ${
                        (selectedSubsector.return_5d ?? 0) >= 0 ? "text-emerald-500" : "text-rose-500"
                      }`}
                    >
                      {(selectedSubsector.return_5d ?? 0) >= 0 ? "+" : ""}
                      {selectedSubsector.return_5d?.toFixed(2) ?? "0.00"}%
                    </span>
                  </div>
                  <div>
                    20D:{" "}
                    <span
                      className={`font-mono font-semibold ${
                        (selectedSubsector.return_20d ?? 0) >= 0 ? "text-emerald-500" : "text-rose-500"
                      }`}
                    >
                      {(selectedSubsector.return_20d ?? 0) >= 0 ? "+" : ""}
                      {selectedSubsector.return_20d?.toFixed(2) ?? "0.00"}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex-1 p-2 min-h-[520px]">
                {chartLoading ? (
                  <div className="h-full flex items-center justify-center text-xs text-gray-400">
                    <span className="animate-spin inline-block mr-2">⏳</span> Memuatkan carta indeks...
                  </div>
                ) : chartError ? (
                  <div className="h-full flex items-center justify-center text-xs text-rose-500">
                    {chartError}
                  </div>
                ) : chartData ? (
                  <StockChart
                    data={chartData}
                    ticker={selectedSubsector.subsector_name}
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
              Pilih mana-mana baris subsektor di sebelah kiri untuk melihat carta.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}