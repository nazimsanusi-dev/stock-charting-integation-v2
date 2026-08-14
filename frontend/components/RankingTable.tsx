"use client";

import React, { useState } from "react";
import type { SubsectorRank } from "@/lib/types";

interface RankingTableProps {
  data: SubsectorRank[];
}

export function RankingTable({ data = [] }: RankingTableProps) {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredData = (data || []).filter((item) =>
    (item.subsector_name || "").toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentRows = filteredData.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="space-y-3">
      {/* Search Bar & Total Count */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="relative w-full sm:w-72">
          <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Cari subsektor..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Jumlah: <strong className="text-gray-800 dark:text-gray-200">{filteredData.length}</strong> subsektor
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-100 dark:bg-gray-800/80 text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 uppercase font-medium">
            <tr>
              <th className="py-2.5 px-3"># Rank</th>
              <th className="py-2.5 px-3">Subsektor</th>
              <th className="py-2.5 px-3 text-center">Score</th>
              <th className="py-2.5 px-3 text-center">Status</th>
              <th className="py-2.5 px-3 text-right">Return 5D</th>
              <th className="py-2.5 px-3 text-right">Return 20D</th>
              <th className="py-2.5 px-3 text-right">Close Index</th>
              <th className="py-2.5 px-3 text-center">Stocks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-900">
            {currentRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-6 text-center text-gray-400">
                  Tiada rekod ditemui.
                </td>
              </tr>
            ) : (
              currentRows.map((row, idx) => {
                const r5 = Number(row.return_5d || 0);
                const r20 = Number(row.return_20d || 0);
                return (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="py-2 px-3 font-bold text-blue-600 dark:text-blue-400">#{row.rank}</td>
                    <td className="py-2 px-3 font-medium text-gray-900 dark:text-gray-100">{row.subsector_name}</td>
                    <td className="py-2 px-3 text-center">
                      <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-semibold">
                        {row.score}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800/50">
                        {row.status || "BULLISH"}
                      </span>
                    </td>
                    <td className={`py-2 px-3 text-right font-medium ${r5 >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                      {r5 >= 0 ? `+${r5.toFixed(2)}%` : `${r5.toFixed(2)}%`}
                    </td>
                    <td className={`py-2 px-3 text-right font-medium ${r20 >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                      {r20 >= 0 ? `+${r20.toFixed(2)}%` : `${r20.toFixed(2)}%`}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">{Number(row.close_index || 0).toFixed(2)}</td>
                    <td className="py-2 px-3 text-center text-gray-500 dark:text-gray-400">{row.num_stocks}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1 text-xs text-gray-500 dark:text-gray-400">
        <div>
          Menunjukkan {filteredData.length === 0 ? 0 : startIndex + 1} - {Math.min(startIndex + itemsPerPage, filteredData.length)} daripada {filteredData.length} rekod
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700"
          >
            &larr; Prev
          </button>
          <span className="px-2.5 py-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded font-medium">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages || filteredData.length === 0}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700"
          >
            Next &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}

export default RankingTable;