"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "@/lib/api";
import type { SheetEntry } from "@/lib/types";

interface Props {
  selectedSheet: SheetEntry | null;
  worksheet: string;
}

type SortDir = "asc" | "desc";

// Helper Pemformatan Sel Pintar (Badges, Peratusan & Simbol)
function renderCellContent(header: string, rawVal: string) {
  if (rawVal === undefined || rawVal === null || rawVal === "") {
    return <span className="text-gray-300 dark:text-gray-600">-</span>;
  }

  const val = String(rawVal).trim();
  const hLower = header.toLowerCase();

  // 1. Format Boolean (TRUE / FALSE)
  if (val.toUpperCase() === "TRUE") {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
        ✓ TRUE
      </span>
    );
  }
  if (val.toUpperCase() === "FALSE") {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-500/10 text-gray-500 dark:text-gray-400 border border-gray-500/20">
        ✕ FALSE
      </span>
    );
  }

  // 2. Format Peratusan / Changes
  if (hLower.includes("percent") || hLower.includes("%") || val.endsWith("%")) {
    const cleanNum = parseFloat(val.replace(/[%+]/g, ""));
    if (!isNaN(cleanNum)) {
      const isPositive = cleanNum > 0;
      const isNegative = cleanNum < 0;
      return (
        <span
          className={`font-mono font-semibold text-[11px] ${
            isPositive
              ? "text-emerald-600 dark:text-emerald-400"
              : isNegative
              ? "text-rose-600 dark:text-rose-400"
              : "text-gray-500 dark:text-gray-400"
          }`}
        >
          {isPositive ? `+${cleanNum.toFixed(2)}%` : `${cleanNum.toFixed(2)}%`}
        </span>
      );
    }
  }

  // 3. Format Simbol Saham / Ticker (.KL)
  if (hLower.includes("symbol") || hLower.includes("ticker") || hLower.includes("code") || val.includes(".KL")) {
    return (
      <span className="font-mono font-medium text-sky-600 dark:text-sky-400 bg-sky-500/10 dark:bg-sky-500/15 px-1.5 py-0.5 rounded border border-sky-500/20 text-[11px]">
        {val}
      </span>
    );
  }

  // 4. Format Tarikh / Timestamp (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}/.test(val)) {
    return (
      <span className="font-mono text-gray-500 dark:text-gray-400 text-[11px]">
        {val}
      </span>
    );
  }

  // 5. Nombor Biasa (Price, EMA, Spread, CMF, etc)
  const numVal = parseFloat(val);
  if (!isNaN(numVal) && !isNaN(Number(val))) {
    return (
      <span className="font-mono text-gray-800 dark:text-gray-200">
        {val}
      </span>
    );
  }

  // 6. Teks Standard (Nama Syarikat, dll)
  return (
    <span className="font-medium text-gray-800 dark:text-gray-200">
      {val}
    </span>
  );
}

export function TableView({ selectedSheet, worksheet }: Props) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (!selectedSheet) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.tableData(selectedSheet.url, worksheet);
      setHeaders(data.headers || []);
      setRows(data.rows || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [selectedSheet?.url, worksheet]); // eslint-disable-line

  useEffect(() => {
    load();
  }, [load]);

  // Pengendali Sort Lajur
  const handleSort = (colIdx: number) => {
    if (sortCol === colIdx) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(colIdx);
      setSortDir("asc");
    }
  };

  // Carian Teks
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? rows.filter((r) => r.some((cell) => String(cell).toLowerCase().includes(q)))
      : rows;
  }, [rows, search]);

  // Susunan Data (Auto-Detect Numeric & String)
  const sortedRows = useMemo(() => {
    if (sortCol === null) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      const av = String(a[sortCol] ?? "").trim();
      const bv = String(b[sortCol] ?? "").trim();

      const cleanA = av.replace(/[%RM,+]/g, "");
      const cleanB = bv.replace(/[%RM,+]/g, "");

      const an = parseFloat(cleanA);
      const bn = parseFloat(cleanB);

      const isNumA = !isNaN(an) && !isNaN(Number(cleanA));
      const isNumB = !isNaN(bn) && !isNaN(Number(cleanB));

      let cmp = 0;
      if (isNumA && isNumB) {
        cmp = an - bn;
      } else {
        cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" });
      }

      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filteredRows, sortCol, sortDir]);

  if (!selectedSheet) {
    return (
      <div className="flex flex-col items-center justify-center h-72 text-gray-400 dark:text-gray-500 text-sm gap-2">
        <span className="text-3xl">📑</span>
        <p>Pilih lembaran kerja (sheet) dari menu bar sisi</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-72 space-y-3">
        <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
          Memuatkan data jadual...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-72 p-6 text-center space-y-3">
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-500 text-sm max-w-md">
          <p className="font-semibold">⚠️ Gagal memuatkan data</p>
          <p className="text-xs mt-1 text-rose-400">{error}</p>
        </div>
        <button
          onClick={load}
          className="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition"
        >
          Cuba Lagi
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full p-3 md:p-4 space-y-3">
      {/* Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">
            {selectedSheet.label}
          </h2>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-[#26A69A]/10 text-[#26A69A] border border-[#26A69A]/20">
            {worksheet}
          </span>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-slate-700">
            {sortedRows.length} {sortedRows.length === 1 ? "rekod" : "rekod"}
          </span>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {/* Carian */}
          <div className="relative">
            <input
              className="w-48 sm:w-60 text-xs pl-7 pr-7 py-1.5 rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#121722] text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#26A69A] focus:ring-1 focus:ring-[#26A69A] transition"
              placeholder="Cari simbol, nama, harga…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
              🔍
            </span>
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs px-1"
              >
                ✕
              </button>
            )}
          </div>

          {/* Butang Refresh */}
          <button
            type="button"
            onClick={load}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#121722] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition"
            title="Muat semula data"
          >
            <span>↻</span>
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Kontena Jadual Moden (Full Dark & Light Adaptable) */}
      <div className="flex-1 overflow-auto rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#121722] shadow-sm custom-scrollbar">
        <table className="w-full text-xs text-left border-collapse">
          {/* Header Sticky */}
          <thead className="sticky top-0 z-10 bg-gray-50/95 dark:bg-[#182030]/95 backdrop-blur border-b border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-300">
            <tr>
              {headers.map((h, i) => {
                const isSorted = sortCol === i;
                return (
                  <th
                    key={i}
                    onClick={() => handleSort(i)}
                    className="px-3.5 py-2.5 font-semibold text-[11px] uppercase tracking-wider cursor-pointer select-none whitespace-nowrap hover:bg-gray-100/80 dark:hover:bg-slate-800/80 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{h}</span>
                      <span className="text-[10px]">
                        {isSorted ? (
                          sortDir === "asc" ? (
                            <span className="text-[#26A69A] font-bold">▲</span>
                          ) : (
                            <span className="text-[#26A69A] font-bold">▼</span>
                          )
                        ) : (
                          <span className="text-gray-300 dark:text-slate-600 group-hover:text-gray-400">
                            ↕
                          </span>
                        )}
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Badan Jadual */}
          <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
            {sortedRows.map((row, ri) => (
              <tr
                key={ri}
                className="transition-colors odd:bg-transparent even:bg-gray-50/40 dark:even:bg-slate-900/30 hover:bg-[#26A69A]/5 dark:hover:bg-[#26A69A]/10"
              >
                {headers.map((header, ci) => (
                  <td
                    key={ci}
                    className="px-3.5 py-2 whitespace-nowrap text-gray-700 dark:text-slate-300"
                  >
                    {renderCellContent(header, row[ci] ?? "")}
                  </td>
                ))}
              </tr>
            ))}

            {/* Jika Tiada Data Padanan */}
            {sortedRows.length === 0 && (
              <tr>
                <td
                  colSpan={Math.max(headers.length, 1)}
                  className="px-4 py-12 text-center text-gray-400 dark:text-gray-500"
                >
                  <p className="text-sm">Tiada data padanan dijumpai</p>
                  {search && (
                    <p className="text-xs text-gray-400 mt-1">
                      Cuba ubah kata kunci carian &quot;{search}&quot;
                    </p>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}