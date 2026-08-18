"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "@/lib/api";
import type { SheetEntry, ChartData } from "@/lib/types";
import { StockChart } from "./StockChart";

interface Props {
  selectedSheet: SheetEntry | null;
  worksheet: string;
}

type SortDir = "asc" | "desc";

interface NoteItem {
  id: string;
  ticker: string;
  stockName: string;
  content: string;
  updatedAt: string;
}

// -----------------------------------------------------------------------------
// HELPER: PEMFORMATAN SEL PINTAR (BADGE, PERATUS & SIMBOL)
// -----------------------------------------------------------------------------
function renderCellContent(header: string, rawVal: string) {
  if (rawVal === undefined || rawVal === null || rawVal === "") {
    return <span className="text-gray-300 dark:text-gray-600">-</span>;
  }

  const val = String(rawVal).trim();
  const hLower = header.toLowerCase();

  // 1. Format Nilai Boolean (TRUE / FALSE)
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

  // 2. Format Peratusan / Perubahan Harga (+ Hijau / - Merah)
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

  // 3. Format Simbol & Kod Saham
  if (hLower.includes("symbol") || hLower.includes("ticker") || hLower.includes("code") || val.includes(".KL")) {
    return (
      <span className="font-mono font-medium text-sky-600 dark:text-sky-400 bg-sky-500/10 dark:bg-sky-500/15 px-1.5 py-0.5 rounded border border-sky-500/20 text-[11px]">
        {val}
      </span>
    );
  }

  // 4. Format Tarikh / Timestamp
  if (/^\d{4}-\d{2}-\d{2}/.test(val)) {
    return (
      <span className="font-mono text-gray-500 dark:text-gray-400 text-[11px]">
        {val}
      </span>
    );
  }

  // 5. Format Angka Standard (Price, EMA, CMF, Spread)
  const numVal = parseFloat(val);
  if (!isNaN(numVal) && !isNaN(Number(val))) {
    return <span className="font-mono text-gray-800 dark:text-gray-200">{val}</span>;
  }

  // 6. Format Teks Biasa
  return <span className="font-medium text-gray-800 dark:text-gray-200">{val}</span>;
}

export function TableView({ selectedSheet, worksheet }: Props) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [search, setSearch] = useState("");

  // Layout Toggles (4 Mod Susun Atur)
  const [showChart, setShowChart] = useState(false);
  const [showNote, setShowNote] = useState(false);

  // Pagination (15 Rekod Setiap Halaman)
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 15;

  // Selected Row State
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(0);

  // TakeNote State (Front-End Ready untuk Integrasi API)
  const [noteText, setNoteText] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [notesList, setNotesList] = useState<NoteItem[]>([]);

  // Chart Data State
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [chartLoading, setChartLoading] = useState(false);

  // 1. Muat Turun Data Jadual Sheet
  const load = useCallback(async () => {
    if (!selectedSheet) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.tableData(selectedSheet.url, worksheet);
      setHeaders(data.headers || []);
      setRows(data.rows || []);
      setSelectedRowIndex(0);
      setCurrentPage(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [selectedSheet?.url, worksheet]);

  useEffect(() => {
    load();
  }, [load]);

  // 2. Pengendali Susunan (Sort)
  const handleSort = (colIdx: number) => {
    if (sortCol === colIdx) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(colIdx);
      setSortDir("asc");
    }
    setCurrentPage(1);
  };

  // 3. Carian Data
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? rows.filter((r) => r.some((cell) => String(cell).toLowerCase().includes(q)))
      : rows;
  }, [rows, search]);

  // 4. Susunan Data (Auto-Detect Numeric & String)
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

  // 5. Paging
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedRows.slice(start, start + PAGE_SIZE);
  }, [sortedRows, currentPage, PAGE_SIZE]);

  // 6. Saham Semasa
  const selectedRowData = paginatedRows[selectedRowIndex ?? 0] || sortedRows[0] || [];
  const symbolColIdx = headers.findIndex((h) =>
    ["symbol", "ticker", "code"].includes(h.toLowerCase())
  );
  const nameColIdx = headers.findIndex((h) => ["name", "stock"].includes(h.toLowerCase()));

  const currentTicker = symbolColIdx !== -1 ? selectedRowData[symbolColIdx] : "0296.KL";
  const currentStockName = nameColIdx !== -1 ? selectedRowData[nameColIdx] : "Selected Stock";

  // 7. Pengendali Klik Baris: Auto-Select, Buka Chart & Fetch Data
  const handleRowClick = async (ri: number, row: string[]) => {
    setSelectedRowIndex(ri);
    setShowChart(true);

    const symIdx = headers.findIndex((h) =>
      ["symbol", "ticker", "code"].includes(h.toLowerCase())
    );
    const rawTicker = symIdx !== -1 ? row[symIdx] : null;

    if (rawTicker) {
      setChartLoading(true);
      try {
        const data = await api.getChartData(rawTicker);
        setChartData(data);
      } catch (err) {
        console.error(`Gagal memuatkan carta untuk ${rawTicker}:`, err);
      } finally {
        setChartLoading(false);
      }
    }
  };

  // 8. Muat Turun Data Carta apabila Saham Pertama Dipilih
  useEffect(() => {
    if (showChart && currentTicker && !chartData) {
      setChartLoading(true);
      api.getChartData(currentTicker)
        .then(setChartData)
        .catch((err) => console.error("Error fetching initial chart:", err))
        .finally(() => setChartLoading(false));
    }
  }, [showChart, currentTicker, chartData]);

  // 9. Simpan Nota (Ready untuk Endpoint Backend)
  const handleSaveNote = async () => {
    if (!noteText.trim()) return;
    setIsSavingNote(true);
    try {
      // TODO: Sambung ke backend database anda (cth: await api.saveNote(...))
      const newNote: NoteItem = {
        id: `note_${Date.now()}`,
        ticker: currentTicker,
        stockName: currentStockName,
        content: noteText,
        updatedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setNotesList((prev) => [newNote, ...prev]);
      setNoteText("");
    } catch (err) {
      console.error("Gagal simpan nota:", err);
    } finally {
      setIsSavingNote(false);
    }
  };

  if (!selectedSheet) {
    return (
      <div className="flex flex-col items-center justify-center h-72 text-gray-400 text-sm gap-2">
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
    <div className="flex flex-col h-full w-full space-y-3">
      {/* ------------------------------------------------------------- */}
      {/* TOOLBAR ATAS: Title, Info, Carian & Butang Kawalan View       */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 bg-white dark:bg-[#121722] border border-gray-200 dark:border-slate-800 rounded-xl shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">
            {selectedSheet.label}
          </h2>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-[#26A69A]/10 text-[#26A69A] border border-[#26A69A]/20">
            {worksheet}
          </span>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-slate-700">
            {sortedRows.length} rekod
          </span>
        </div>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {/* Carian Pantas */}
          <div className="relative">
            <input
              className="w-40 sm:w-52 text-xs pl-7 pr-7 py-1.5 rounded-lg border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-[#182030] text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:border-[#26A69A]"
              placeholder="Cari dalam jadual…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
              🔍
            </span>
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setCurrentPage(1);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs px-1"
              >
                ✕
              </button>
            )}
          </div>

          {/* Butang Toggle TakeNote */}
          <button
            type="button"
            onClick={() => setShowNote(!showNote)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition ${
              showNote
                ? "bg-amber-500/15 border-amber-500 text-amber-600 dark:text-amber-400"
                : "border-gray-200 dark:border-slate-800 bg-white dark:bg-[#121722] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
            }`}
          >
            <span>📝</span>
            <span>Note</span>
          </button>

          {/* Butang Toggle StockChart */}
          <button
            type="button"
            onClick={() => setShowChart(!showChart)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition ${
              showChart
                ? "bg-[#26A69A]/15 border-[#26A69A] text-[#26A69A]"
                : "border-gray-200 dark:border-slate-800 bg-white dark:bg-[#121722] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
            }`}
          >
            <span>📈</span>
            <span>Chart</span>
          </button>

          {/* Muat Semula Data */}
          <button
            type="button"
            onClick={load}
            className="p-1.5 text-xs rounded-lg border border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-600 dark:text-gray-300 transition"
            title="Muat semula jadual"
          >
            ↻
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* STRUKTUR GRID FLEKSIBEL (4 MOD SUSUN ATUR)                    */}
      {/* ------------------------------------------------------------- */}
      <div
        className={`grid gap-4 items-start flex-1 ${
          showChart ? "grid-cols-1 xl:grid-cols-12" : "grid-cols-1"
        }`}
      >
        {/* LAJUR KIRI: JADUAL + MODUL TAKE NOTE */}
        <div
          className={`flex flex-col gap-4 ${
            showChart ? "xl:col-span-6 2xl:col-span-7" : "w-full"
          }`}
        >
          {/* Komponen Jadual */}
          <div className="flex flex-col bg-white dark:bg-[#121722] border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div
              className={`overflow-auto custom-scrollbar ${
                showChart || showNote ? "max-h-[420px]" : "min-h-[500px]"
              }`}
            >
              <table className="w-full text-xs text-left border-collapse">
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
                                sortDir === "asc" ? "▲" : "▼"
                              ) : (
                                <span className="text-gray-300 dark:text-slate-600">↕</span>
                              )}
                            </span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                  {paginatedRows.map((row, ri) => {
                    const isSelected = selectedRowIndex === ri;
                    return (
                      <tr
                        key={ri}
                        onClick={() => handleRowClick(ri, row)}
                        className={`transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-[#26A69A]/15 dark:bg-[#26A69A]/20"
                            : ri % 2 === 0
                            ? "bg-transparent hover:bg-gray-50/70 dark:hover:bg-slate-800/40"
                            : "bg-gray-50/40 dark:bg-slate-900/30 hover:bg-gray-50/70 dark:hover:bg-slate-800/40"
                        }`}
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
                    );
                  })}

                  {paginatedRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={Math.max(headers.length, 1)}
                        className="px-4 py-12 text-center text-gray-400 dark:text-gray-500"
                      >
                        Tiada data padanan dijumpai
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Paging Footer (15 Baris / Page) */}
            <div className="flex items-center justify-between px-3.5 py-2 border-t border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-[#141a26] text-xs text-gray-500 dark:text-gray-400">
              <span>
                Baris {(currentPage - 1) * PAGE_SIZE + 1} -{" "}
                {Math.min(currentPage * PAGE_SIZE, sortedRows.length)} daripada{" "}
                {sortedRows.length}
              </span>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => {
                    setCurrentPage((p) => Math.max(1, p - 1));
                    setSelectedRowIndex(0);
                  }}
                  className="px-2.5 py-1 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-slate-700 transition"
                >
                  ◀
                </button>
                <span className="px-2 font-mono font-medium">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => {
                    setCurrentPage((p) => Math.min(totalPages, p + 1));
                    setSelectedRowIndex(0);
                  }}
                  className="px-2.5 py-1 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-slate-700 transition"
                >
                  ▶
                </button>
              </div>
            </div>
          </div>

          {/* ----------------------------------------------------------- */}
          {/* KOMPONEN TAKE NOTE (Muncul di Bawah Table jika showNote === true) */}
          {/* ----------------------------------------------------------- */}
          {showNote && (
            <div className="flex flex-col p-4 bg-white dark:bg-[#121722] border border-amber-500/30 rounded-xl shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-amber-500 font-bold text-sm">📝 Take Note</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-sky-500/10 text-sky-500 border border-sky-500/20 font-mono">
                    {currentTicker}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    ({currentStockName})
                  </span>
                </div>
                <span className="text-[10px] text-gray-400">Tersambung automatik mengikut baris dipilih</span>
              </div>

              {/* Input Catatan */}
              <div className="space-y-2">
                <textarea
                  rows={3}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder={`Tulis nota analisis / pelan dagangan untuk ${currentTicker} di sini...`}
                  className="w-full text-xs p-2.5 rounded-lg border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-[#182030] text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 resize-none transition"
                />

                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-gray-400">
                    Status: <strong className="text-emerald-500 font-normal">Ready for API</strong>
                  </span>
                  <button
                    type="button"
                    disabled={isSavingNote || !noteText.trim()}
                    onClick={handleSaveNote}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white transition flex items-center gap-1.5"
                  >
                    {isSavingNote ? "Menyimpan..." : "💾 Simpan Nota"}
                  </button>
                </div>
              </div>

              {/* Senarai Nota Terdahulu */}
              {notesList.length > 0 && (
                <div className="pt-2 border-t border-gray-100 dark:border-slate-800 space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    Nota Disimpan:
                  </span>
                  {notesList.map((n) => (
                    <div
                      key={n.id}
                      className="p-2 rounded bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800 text-xs text-gray-700 dark:text-gray-300 flex justify-between items-start gap-2"
                    >
                      <p className="flex-1 whitespace-pre-wrap">{n.content}</p>
                      <span className="text-[10px] text-gray-400 shrink-0">{n.updatedAt}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ------------------------------------------------------------- */}
        {/* LAJUR KANAN: STOCK CHART (Muncul jika showChart === true)      */}
        {/* ------------------------------------------------------------- */}
        {showChart && (
          <div className="xl:col-span-6 2xl:col-span-5 flex flex-col bg-white dark:bg-[#121722] border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm min-h-[580px]">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-[#141a26]">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-gray-800 dark:text-gray-100">
                  {currentStockName}
                </span>
                <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-500 border border-sky-500/20">
                  {currentTicker}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowChart(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs px-1"
                title="Tutup carta"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 relative">
              {chartLoading ? (
                <div className="flex flex-col items-center justify-center h-full text-xs text-gray-400 animate-pulse gap-2">
                  <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                  <span>Memuatkan data carta {currentTicker}...</span>
                </div>
              ) : chartData ? (
                <StockChart
                  data={chartData}
                  config={{ emaPeriods: [10,20,50,100], showVolume: true, showRsi: true, showMacd: true, showCvd: false, showCmf: false }}
                  ticker={currentTicker}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center text-gray-400 space-y-2">
                  <span className="text-2xl">📊</span>
                  <p className="text-xs">
                    Pilih mana-mana baris saham untuk memaparkan lilin TradingView bagi <strong>{currentTicker}</strong>
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}