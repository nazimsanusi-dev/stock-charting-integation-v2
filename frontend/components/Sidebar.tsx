"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { SheetEntry, Stock, SidebarParams } from "@/lib/types";

const PERIODS = ["3mo", "6mo", "1y", "2y", "5y", "max"] as const;
const PERIOD_LABELS: Record<string, string> = {
  "3mo": "3 Months",
  "6mo": "6 Months",
  "1y": "1 Year",
  "2y": "2 Years",
  "5y": "5 Years",
  max: "Max",
};
const TIMEFRAMES = [
  { value: "1d", label: "Daily" },
  { value: "1wk", label: "Weekly" },
  { value: "1mo", label: "Monthly" },
] as const;

interface ExtendedSidebarParams extends SidebarParams {
  activeTab?: "subsector" | "sheets" | "monitoring" | "us_subsector";
}

interface Props {
  params: ExtendedSidebarParams;
  onChange: (p: ExtendedSidebarParams) => void;
}

export function Sidebar({ params, onChange }: Props) {
  const [collapsed, setCollapsed] = useState(true);
  const [sheets, setSheets] = useState<SheetEntry[]>([]);
  const [worksheets, setWorksheets] = useState<string[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [search, setSearch] = useState("");
  const [emaInput, setEmaInput] = useState(params.chartConfig.emaPeriods.join(", "));

  // Loading & Error States
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [sheetsError, setSheetsError] = useState<string | null>(null);

  const [loadingWorksheets, setLoadingWorksheets] = useState(false);
  const [worksheetsError, setWorksheetsError] = useState<string | null>(null);

  const [loadingStocks, setLoadingStocks] = useState(false);
  const [stocksError, setStocksError] = useState<string | null>(null);

  const activeTab = params.activeTab ?? "subsector";

  // 1. Fetch Senarai Sheets (Boleh dipanggil semula)
  const fetchSheets = useCallback(async () => {
    setLoadingSheets(true);
    setSheetsError(null);
    try {
      const r = await api.sheets();
      setSheets(r.sheets);
      if (r.sheets.length > 0 && !params.selectedSheet) {
        onChange({ ...params, selectedSheet: r.sheets[0] });
      }
    } catch (err: any) {
      setSheetsError(err?.message || "Gagal memuatkan senarai sheet.");
    } finally {
      setLoadingSheets(false);
    }
  }, [params, onChange]);

  // 2. Fetch Worksheets (Boleh dipanggil semula)
  const fetchWorksheets = useCallback(async (targetUrl?: string) => {
    const url = targetUrl || params.selectedSheet?.url;
    if (!url) return;

    setLoadingWorksheets(true);
    setWorksheetsError(null);
    try {
      const r = await api.worksheets(url);
      setWorksheets(r.worksheets);
      if (r.worksheets.length > 0) {
        onChange({
          ...params,
          worksheet: r.worksheets[0],
          selectedStocks: [],
          allStocks: [],
        });
      }
    } catch (err: any) {
      setWorksheetsError(err?.message || "Gagal memuatkan worksheet.");
      setWorksheets([]);
    } finally {
      setLoadingWorksheets(false);
    }
  }, [params, onChange]);

  // 3. Fetch Stocks (Boleh dipanggil semula)
  const fetchStocks = useCallback(async (targetUrl?: string, targetWs?: string) => {
    const url = targetUrl || params.selectedSheet?.url;
    const ws = targetWs || params.worksheet;
    if (!url || !ws) return;

    setStocks([]);
    setLoadingStocks(true);
    setStocksError(null);

    try {
      const r = await api.stocks(url, ws);
      setStocks(r.stocks);
      onChange({ ...params, allStocks: r.stocks });
    } catch (err: any) {
      setStocksError(err?.message || "Gagal memuatkan senarai stok.");
      setStocks([]);
      onChange({ ...params, allStocks: [] });
    } finally {
      setLoadingStocks(false);
    }
  }, [params, onChange]);

  // Effects permulaan
  useEffect(() => {
    fetchSheets();
  }, []); // eslint-disable-line

  useEffect(() => {
    if (params.selectedSheet?.url) {
      fetchWorksheets(params.selectedSheet.url);
    }
  }, [params.selectedSheet?.url]); // eslint-disable-line

  useEffect(() => {
    if (params.selectedSheet?.url && params.worksheet) {
      fetchStocks(params.selectedSheet.url, params.worksheet);
    }
  }, [params.selectedSheet?.url, params.worksheet]); // eslint-disable-line

  const filteredStocks = stocks.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.ticker.toLowerCase().includes(search.toLowerCase())
  );

  const [showStocks, setShowStocks] = useState(false);

  const selectedTicker = params.selectedStocks[0]?.ticker ?? null;

  const selectStock = (s: Stock) => {
    const isAlreadySelected = selectedTicker === s.ticker;
    onChange({
      ...params,
      selectedStocks: isAlreadySelected ? [] : [s],
    });
  };

  const set = (patch: Partial<ExtendedSidebarParams>) => onChange({ ...params, ...patch });
  const setCfg = (patch: Partial<SidebarParams["chartConfig"]>) =>
    set({ chartConfig: { ...params.chartConfig, ...patch } });

  const applyEma = () => {
    const periods = emaInput
      .split(/[,\s]+/)
      .map(Number)
      .filter((n) => n > 0 && n < 500);
    if (periods.length) setCfg({ emaPeriods: periods });
  };

  if (collapsed) {
    return (
      <aside className="w-10 shrink-0 flex flex-col items-center py-3 gap-3 bg-[#FAFAFA] dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 h-screen sticky top-0">
        <button
          onClick={() => setCollapsed(false)}
          className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
          title="Expand sidebar"
        >
          ▶
        </button>
        <span className="text-gray-300 dark:text-gray-600 text-xs rotate-90 mt-4 tracking-widest select-none">
          NAV
        </span>
      </aside>
    );
  }

  return (
    <aside className="w-60 shrink-0 flex flex-col gap-4 overflow-y-auto py-4 px-3 bg-[#FAFAFA] dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 h-screen sticky top-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="font-semibold text-gray-700 dark:text-gray-200 text-sm tracking-wide">
          📈 Stock Monitor
        </span>
        <button
          onClick={() => setCollapsed(true)}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500 transition-colors text-xs"
          title="Collapse sidebar"
        >
          ◀
        </button>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex flex-col gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <button
          onClick={() => set({ activeTab: "subsector" })}
          className={`py-1.5 px-2 text-xs font-semibold rounded-md transition-colors text-left flex items-center gap-2 ${
            activeTab === "subsector"
              ? "bg-white dark:bg-gray-700 text-[#26A69A] shadow-sm"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          }`}
        >
          <span>🇲🇾</span>Bursa Subsector Analysis
        </button>

        <button
          onClick={() => set({ activeTab: "us_subsector" })}
          className={`py-1.5 px-2 text-xs font-semibold rounded-md transition-colors text-left flex items-center gap-2 ${
            activeTab === "us_subsector"
              ? "bg-white dark:bg-gray-700 text-[#26A69A] shadow-sm"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          }`}
        >
          <span>🇺🇸</span> US Subsector Analysis
        </button>

        <button
          onClick={() => set({ activeTab: "sheets" })}
          className={`py-1.5 px-2 text-xs font-semibold rounded-md transition-colors text-left flex items-center gap-2 ${
            activeTab === "sheets"
              ? "bg-white dark:bg-gray-700 text-[#26A69A] shadow-sm"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          }`}
        >
          <span>📋</span> Google Sheets Tracker
        </button>

        {/* Butang Baru: Stock Monitoring */}
        <button
          onClick={() => set({ activeTab: "monitoring" })}
          className={`py-1.5 px-2 text-xs font-semibold rounded-md transition-colors text-left flex items-center gap-2 ${
            activeTab === "monitoring"
              ? "bg-white dark:bg-gray-700 text-[#26A69A] shadow-sm"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          }`}
        >
          <span>🎯</span> Stock Monitoring
        </button>
      </div>

      {/* Theme Toggle Button */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-800">
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
          Theme
        </span>
        <button
          type="button"
          onClick={() => set({ theme: params.theme === "dark" ? "light" : "dark" })}
          className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-lg border bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title={`Tukar ke mod ${params.theme === "dark" ? "Light" : "Dark"}`}
        >
          <span>{params.theme === "dark" ? "🌙" : "☀️"}</span>
          <span className="hidden sm:inline">
            {params.theme === "dark" ? "Dark" : "Light"}
          </span>
        </button>
      </div>

      {/* KAWALAN GOOGLE SHEETS TRACKER */}
      {activeTab === "sheets" && (
        <>
          {/* 1. Sheet Selector */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="label mb-0">Sheet</label>
              <button
                type="button"
                onClick={() => fetchStocks()}
                disabled={loadingStocks}
                className="p-1.5 text-gray-400 hover:text-gray-200 dark:hover:text-gray-100 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors disabled:opacity-40"
                title="Muat semula senarai saham"
              >
                <svg
                  className={`w-4 h-4 ${loadingStocks ? "animate-spin text-teal-400" : ""}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                  <path d="M16 16h5v5" />
                </svg>
              </button>
            </div>

            {sheetsError ? (
              <div className="p-2 rounded bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-500 flex flex-col gap-1">
                <span>{sheetsError}</span>
                <button
                  onClick={fetchSheets}
                  className="text-left underline font-medium hover:text-rose-600"
                >
                  Cuba lagi
                </button>
              </div>
            ) : (
              <select
                className="select"
                disabled={loadingSheets || sheets.length === 0}
                value={params.selectedSheet?.url ?? ""}
                onChange={(e) => {
                  const newSheet = sheets.find((s) => s.url === e.target.value) ?? null;
                  if (newSheet) {
                    setStocks([]);
                    onChange({
                      ...params,
                      selectedSheet: newSheet,
                      worksheet: "",
                      allStocks: [],
                      selectedStocks: [],
                    });
                  }
                }}
              >
                {sheets.map((s) => (
                  <option key={s.url} value={s.url}>
                    {s.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 2. Worksheet Selector */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="label mb-0">Worksheet</label>
              {params.selectedSheet?.url && (
                <button
                  type="button"
                  onClick={() => fetchStocks()}
                  disabled={loadingStocks} // Gantikan dengan nama state sedia ada
                  className="p-1.5 text-gray-400 hover:text-gray-200 dark:hover:text-gray-100 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors disabled:opacity-40"
                  title="Muat semula senarai saham"
                >
                  <svg
                    className={`w-4 h-4 ${loadingStocks ? "animate-spin text-teal-400" : ""}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                    <path d="M16 16h5v5" />
                  </svg>
                </button>
              )}
            </div>

            {worksheetsError ? (
              <div className="p-2 rounded bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-500 flex flex-col gap-1">
                <span>{worksheetsError}</span>
                <button
                  onClick={() => fetchWorksheets()}
                  className="text-left underline font-medium hover:text-rose-600"
                >
                  Cuba lagi
                </button>
              </div>
            ) : (
              <select
                className="select"
                disabled={loadingWorksheets || worksheets.length === 0}
                value={params.worksheet}
                onChange={(e) => {
                  setStocks([]);
                  onChange({
                    ...params,
                    worksheet: e.target.value,
                    selectedStocks: [],
                    allStocks: [],
                  });
                }}
              >
                {worksheets.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Selected Stock Badge */}
          {params.selectedStocks[0] && (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-[#26A69A]/10 border border-[#26A69A]/30">
              <span className="w-2 h-2 rounded-full bg-[#26A69A] shrink-0" />
              <span className="text-xs font-medium text-[#1a7a72] truncate">
                {params.selectedStocks[0].name}
              </span>
              <span className="ml-auto text-xs text-[#26A69A] shrink-0">
                {params.selectedStocks[0].ticker}
              </span>
            </div>
          )}

          {/* Header Seksyen Stocks (Boleh Klik untuk Buka / Tutup) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowStocks(!showStocks)}
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:text-[#26A69A] dark:hover:text-[#26A69A] transition-colors group"
              >
                <span className="text-[10px] text-gray-400 group-hover:text-[#26A69A] transition-transform duration-200">
                  {showStocks ? "▼" : "▶"}
                </span>
                <span>Stocks</span>
                {selectedTicker && !showStocks && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 bg-[#26A69A]/10 text-[#26A69A] rounded">
                    {selectedTicker}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => fetchStocks()}
                disabled={loadingStocks} // Gantikan dengan nama state sedia ada
                className="p-1.5 text-gray-400 hover:text-gray-200 dark:hover:text-gray-100 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors disabled:opacity-40"
                title="Muat semula senarai saham"
              >
                <svg
                  className={`w-4 h-4 ${loadingStocks ? "animate-spin text-teal-400" : ""}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                  <path d="M16 16h5v5" />
                </svg>
              </button>
            </div>

            {/* Kandungan Carian & Senarai (Muncul hanya jika showStocks === true) */}
            {showStocks && (
              <div className="space-y-1.5 pt-1">
                <input
                  className="input w-full text-xs px-2.5 py-1.5 rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-[#26A69A]"
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />

                <div className="flex flex-col gap-0.5 max-h-52 overflow-y-auto mt-1 pr-1 custom-scrollbar">
                  {loadingStocks && <p className="text-xs text-gray-400 py-1">Loading…</p>}
                  
                  {stocksError && (
                    <div className="p-2 rounded bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-500 flex flex-col gap-1 my-1">
                      <span>⚠ {stocksError}</span>
                      <button
                        onClick={() => fetchStocks()}
                        className="text-left underline font-medium hover:text-rose-600"
                      >
                        Cuba lagi
                      </button>
                    </div>
                  )}

                  {filteredStocks.map((s) => {
                    const selected = selectedTicker === s.ticker;
                    const cleanChange = String(s.change ?? "").replace(/%/g, "");
                    const numChange = Number(cleanChange);

                    return (
                      <label
                        key={s.ticker}
                        className={`flex items-center justify-between gap-1.5 cursor-pointer py-1 px-1.5 rounded text-xs transition-colors ${
                          selected ? "bg-[#26A69A]/10" : "hover:bg-gray-100 dark:hover:bg-gray-800"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <input
                            type="radio"
                            name="stock-select"
                            className="accent-[#26A69A] shrink-0"
                            checked={selected}
                            onChange={() => selectStock(s)}
                            onClick={() => selected && selectStock(s)}
                          />
                          <span
                            className={`truncate ${
                              selected ? "text-[#1a7a72] dark:text-[#26A69A] font-semibold" : "text-gray-700 dark:text-gray-300"
                            }`}
                          >
                            {s.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-gray-400 dark:text-gray-500 text-[11px] font-mono">
                            {s.ticker}
                          </span>
                          {s.change !== undefined && s.change !== null && cleanChange !== "" && (
                            <span
                              className={`text-[11px] font-mono font-medium ${
                                numChange > 0
                                  ? "text-emerald-500"
                                  : numChange < 0
                                  ? "text-red-500"
                                  : "text-gray-400 dark:text-gray-500"
                              }`}
                            >
                              {numChange > 0 ? `+${cleanChange}%` : `${cleanChange}%`}
                            </span>
                          )}
                        </div>
                      </label>
                    );
                  })}

                  {!loadingStocks && !stocksError && filteredStocks.length === 0 && (
                    <p className="text-xs text-gray-400 py-1">
                      {stocks.length ? "No matches" : "No stocks loaded"}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <hr className="border-gray-100 dark:border-gray-800" />

          {/* View Mode */}
          <div>
            <label className="label">View</label>
            <div className="flex gap-1">
              {(["single", "grid", "table"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => set({ viewMode: m })}
                  className={`flex-1 py-1 text-xs rounded border transition-colors ${
                    params.viewMode === m
                      ? "bg-[#26A69A] text-white border-[#26A69A]"
                      : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500"
                  }`}
                >
                  {m === "single" ? "Single" : m === "grid" ? "Grid" : "Table"}
                </button>
              ))}
            </div>
          </div>

          {/* Grid Columns */}
          {params.viewMode === "grid" && (
            <div>
              <label className="label">Columns</label>
              <div className="flex gap-1">
                {([1, 2, 3, 4] as const).map((n) => {
                  const disabled = params.isCombineTimeframe && n > 2;
                  return (
                    <button
                      key={n}
                      disabled={disabled}
                      onClick={() => set({ gridColumns: n })}
                      title={disabled ? "Combine mode supports up to 2 columns" : undefined}
                      className={`flex-1 py-1 text-xs rounded border transition-colors ${
                        disabled
                          ? "bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600 border-gray-200 dark:border-gray-700 cursor-not-allowed"
                          : params.gridColumns === n
                          ? "bg-[#26A69A] text-white border-[#26A69A]"
                          : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500"
                      }`}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Timeframe & Combine Timeframe */}
      {params.viewMode !== "table" && (
        <>
          {(() => {
            // Cari value sebenar untuk 'Weekly' dari TIMEFRAMES (contoh: '1wk', '1w', atau 'W')
            const weeklyVal =
              TIMEFRAMES.find((t) => t.label.toLowerCase().includes("week"))?.value || "1wk";
            const dailyVal =
              TIMEFRAMES.find((t) => t.label.toLowerCase().includes("day"))?.value || "1d";

            const isDark = params.theme === "dark";

            return (
              <div
                className={`flex flex-col gap-2 p-2.5 rounded-xl border transition-colors ${
                  isDark
                    ? "bg-[#111827] border-gray-800 text-gray-100"
                    : "bg-gray-50 border-gray-200 text-gray-800"
                }`}
              >
                {/* Toggle Switch Header */}
                <label className="flex items-center justify-between cursor-pointer select-none">
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-[#26A69A]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect width="18" height="18" x="3" y="3" rx="2" />
                      <path d="M12 3v18" />
                    </svg>
                    <span
                      className={`text-xs font-semibold ${
                        isDark ? "text-gray-200" : "text-gray-800"
                      }`}
                    >
                      Combine Timeframes
                    </span>
                  </div>

                  <div className="relative inline-flex items-center">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={Boolean(params.isCombineTimeframe)}
                      onChange={(e) => {
                        const isChecked = e.target.checked;
                        set({
                          isCombineTimeframe: isChecked,
                          timeframe: params.timeframe || dailyVal,
                          // Paksa TF2 = Weekly bila diaktifkan jika nilainya sama dengan TF1 atau kosong
                          secondaryTimeframe: isChecked
                            ? params.secondaryTimeframe &&
                              params.secondaryTimeframe !== (params.timeframe || dailyVal)
                              ? params.secondaryTimeframe
                              : weeklyVal
                            : params.secondaryTimeframe,
                          gridColumns: isChecked
                            ? Math.min(params.gridColumns || 2, 2)
                            : params.gridColumns,
                        });
                      }}
                    />
                    <div
                      className={`w-8 h-4.5 rounded-full peer peer-focus:outline-none after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:after:translate-x-full peer-checked:bg-[#26A69A] ${
                        isDark ? "bg-gray-700" : "bg-gray-300"
                      }`}
                    ></div>
                  </div>
                </label>

                {/* Dual View Dropdowns */}
                {params.isCombineTimeframe ? (
                  <div
                    className={`grid grid-cols-2 gap-2 pt-2 border-t ${
                      isDark ? "border-gray-800" : "border-gray-200"
                    }`}
                  >
                    {/* TF 1 (Left) */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-teal-500 flex items-center gap-1">
                        <svg
                          className="w-3 h-3"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        >
                          <polyline points="15 18 9 12 15 6" />
                        </svg>
                        TF 1 (Left)
                      </span>
                      <select
                        className={`w-full text-xs rounded-lg border py-1.5 px-2 font-medium outline-none cursor-pointer focus:ring-1 focus:ring-[#26A69A] ${
                          isDark
                            ? "bg-[#1f2937] border-gray-700 text-gray-100"
                            : "bg-white border-gray-300 text-gray-900 shadow-sm"
                        }`}
                        value={params.timeframe || dailyVal}
                        onChange={(e) => set({ timeframe: e.target.value })}
                      >
                        {TIMEFRAMES.map((t) => (
                          <option
                            key={t.value}
                            value={t.value}
                            className={isDark ? "bg-[#1f2937] text-white" : "bg-white text-black"}
                          >
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* TF 2 (Right) */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1">
                        <svg
                          className="w-3 h-3"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                        TF 2 (Right)
                      </span>
                      <select
                        className={`w-full text-xs rounded-lg border py-1.5 px-2 font-medium outline-none cursor-pointer focus:ring-1 focus:ring-[#26A69A] ${
                          isDark
                            ? "bg-[#1f2937] border-gray-700 text-gray-100"
                            : "bg-white border-gray-300 text-gray-900 shadow-sm"
                        }`}
                        value={params.secondaryTimeframe || weeklyVal}
                        onChange={(e) => set({ secondaryTimeframe: e.target.value })}
                      >
                        {TIMEFRAMES.map((t) => (
                          <option
                            key={t.value}
                            value={t.value}
                            className={isDark ? "bg-[#1f2937] text-white" : "bg-white text-black"}
                          >
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  /* Single Timeframe Pill Selectors */
                  <div className="flex gap-1 pt-1">
                    {TIMEFRAMES.map((t) => {
                      const isActive = (params.timeframe || dailyVal) === t.value;
                      return (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => set({ timeframe: t.value })}
                          className={`flex-1 py-1 text-xs font-semibold rounded-lg border transition-all ${
                            isActive
                              ? "bg-[#26A69A] text-white border-[#26A69A] shadow-sm shadow-teal-500/20"
                              : isDark
                              ? "bg-[#1f2937] text-gray-300 border-gray-700 hover:border-gray-600"
                              : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          {t.label.slice(0, 1)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          <div>
            <label className="label">Period</label>
            <select
              className="select"
              value={params.period}
              onChange={(e) => set({ period: e.target.value })}
            >
              {PERIODS.map((p) => (
                <option key={p} value={p}>
                  {PERIOD_LABELS[p]}
                </option>
              ))}
            </select>
          </div>

          <hr className="border-gray-100 dark:border-gray-800" />

          {/* Indicators */}
          <div className="flex flex-col gap-2">
            <label className="label">Indicators</label>
            <div>
              <span className="text-xs text-gray-500 dark:text-gray-400">EMA periods</span>
              <div className="flex gap-1 mt-0.5">
                <input
                  className="input flex-1 text-xs"
                  value={emaInput}
                  onChange={(e) => setEmaInput(e.target.value)}
                  onBlur={applyEma}
                  onKeyDown={(e) => e.key === "Enter" && applyEma()}
                  placeholder="5, 10, 20, 50, 100, 150, 200"
                />
              </div>
            </div>

            {(
              [
                ["showVolume", "Volume"],
                ["showRsi", "RSI (14)"],
                ["showMacd", "MACD"],
                ["showCvd", "CVD"],
                ["showCmf", "CMF (20)"],
              ] as [keyof SidebarParams["chartConfig"], string][]
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex items-center gap-2 cursor-pointer text-xs text-gray-700 dark:text-gray-300"
              >
                <input
                  type="checkbox"
                  className="accent-[#26A69A]"
                  checked={params.chartConfig[key] as boolean}
                  onChange={(e) => setCfg({ [key]: e.target.checked })}
                />
                {label}
              </label>
            ))}
          </div>
         </>
        )}
       </>
      )}

      <div className="mt-auto text-xs text-gray-400 dark:text-gray-600 space-y-0.5">
        <p>Data: Yahoo Finance</p>
        <p>List: BigQuery & Google Sheets</p>
      </div>
    </aside>
  );
}