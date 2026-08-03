"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { SheetEntry, Stock, SidebarParams } from "@/lib/types";

const PERIODS = ["3mo", "6mo", "1y", "2y", "5y", "max"] as const;
const PERIOD_LABELS: Record<string, string> = {
  "3mo": "3 Months", "6mo": "6 Months", "1y": "1 Year",
  "2y": "2 Years", "5y": "5 Years", "max": "Max",
};
const TIMEFRAMES = [
  { value: "1d", label: "Daily" },
  { value: "1wk", label: "Weekly" },
  { value: "1mo", label: "Monthly" },
] as const;

interface Props {
  params: SidebarParams;
  onChange: (p: SidebarParams) => void;
}

export function Sidebar({ params, onChange }: Props) {
  const [sheets, setSheets] = useState<SheetEntry[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [search, setSearch] = useState("");
  const [emaInput, setEmaInput] = useState(params.chartConfig.emaPeriods.join(", "));
  const [loadingStocks, setLoadingStocks] = useState(false);
  const [sheetsError, setSheetsError] = useState<string | null>(null);
  const [stocksError, setStocksError] = useState<string | null>(null);

  // Load sheets on mount
  useEffect(() => {
    console.log("[Sidebar] fetching sheets…");
    api.sheets()
      .then((r) => {
        console.log("[Sidebar] sheets loaded:", r.sheets);
        setSheets(r.sheets);
        setSheetsError(null);
        if (r.sheets.length > 0 && !params.selectedSheet) {
          onChange({ ...params, selectedSheet: r.sheets[0] });
        }
      })
      .catch((err) => {
        console.error("[Sidebar] sheets error:", err);
        setSheetsError(String(err));
      });
  }, []); // eslint-disable-line

  // Load stocks when sheet changes
  useEffect(() => {
    if (!params.selectedSheet) return;
    console.log("[Sidebar] fetching stocks for", params.selectedSheet.url, "worksheet:", params.worksheet);
    setLoadingStocks(true);
    setStocksError(null);
    api.stocks(params.selectedSheet.url, params.worksheet)
      .then((r) => {
        console.log("[Sidebar] stocks loaded:", r.stocks.length);
        setStocks(r.stocks);
      })
      .catch((err) => {
        console.error("[Sidebar] stocks error:", err);
        setStocksError(String(err));
      })
      .finally(() => setLoadingStocks(false));
  }, [params.selectedSheet?.url, params.worksheet]);

  const filteredStocks = stocks.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.ticker.toLowerCase().includes(search.toLowerCase()),
  );

  const isSelected = (s: Stock) =>
    params.selectedStocks.some((sel) => sel.ticker === s.ticker);

  const toggleStock = (s: Stock) => {
    const next = isSelected(s)
      ? params.selectedStocks.filter((sel) => sel.ticker !== s.ticker)
      : [...params.selectedStocks, s];
    onChange({ ...params, selectedStocks: next });
  };

  const set = (patch: Partial<SidebarParams>) => onChange({ ...params, ...patch });
  const setCfg = (patch: Partial<SidebarParams["chartConfig"]>) =>
    set({ chartConfig: { ...params.chartConfig, ...patch } });

  const applyEma = () => {
    const periods = emaInput
      .split(/[,\s]+/)
      .map(Number)
      .filter((n) => n > 0 && n < 500);
    if (periods.length) setCfg({ emaPeriods: periods });
  };

  return (
    <aside className="w-60 shrink-0 flex flex-col gap-4 overflow-y-auto py-4 px-3 bg-[#FAFAFA] border-r border-gray-100 h-screen sticky top-0">
      {/* Header */}
      <div className="font-semibold text-gray-700 text-sm tracking-wide">📈 Stock Monitor</div>

      {/* Sheet selector */}
      {sheetsError && (
        <p className="text-xs text-red-400 break-all">⚠ Sheets: {sheetsError}</p>
      )}
      {sheets.length > 0 && (
        <div>
          <label className="label">Sheet</label>
          <select
            className="select"
            value={params.selectedSheet?.url ?? ""}
            onChange={(e) => {
              const sheet = sheets.find((s) => s.url === e.target.value) ?? null;
              onChange({ ...params, selectedSheet: sheet, selectedStocks: [] });
            }}
          >
            {sheets.map((s) => (
              <option key={s.url} value={s.url}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Stock list */}
      <div className="flex flex-col gap-1">
        <label className="label">Stocks</label>
        <input
          className="input"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex flex-col gap-0.5 max-h-52 overflow-y-auto mt-1">
          {loadingStocks && <p className="text-xs text-gray-400 py-1">Loading…</p>}
          {stocksError && <p className="text-xs text-red-400 break-all py-1">⚠ {stocksError}</p>}
          {filteredStocks.map((s) => (
            <label key={s.ticker} className="flex items-center gap-2 cursor-pointer py-0.5 px-1 rounded hover:bg-gray-100 text-xs">
              <input
                type="checkbox"
                className="accent-[#26A69A]"
                checked={isSelected(s)}
                onChange={() => toggleStock(s)}
              />
              <span className="truncate text-gray-700">{s.name}</span>
              <span className="ml-auto text-gray-400 shrink-0">{s.ticker}</span>
            </label>
          ))}
          {!loadingStocks && filteredStocks.length === 0 && (
            <p className="text-xs text-gray-400 py-1">
              {stocks.length ? "No matches" : "No stocks loaded"}
            </p>
          )}
        </div>
      </div>

      <hr className="border-gray-100" />

      {/* View mode */}
      <div>
        <label className="label">View</label>
        <div className="flex gap-2">
          {(["single", "grid"] as const).map((m) => (
            <button
              key={m}
              onClick={() => set({ viewMode: m })}
              className={`flex-1 py-1 text-xs rounded border transition-colors ${
                params.viewMode === m
                  ? "bg-[#26A69A] text-white border-[#26A69A]"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              }`}
            >
              {m === "single" ? "Single" : "Grid"}
            </button>
          ))}
        </div>
      </div>

      {/* Timeframe */}
      <div>
        <label className="label">Timeframe</label>
        <div className="flex gap-1">
          {TIMEFRAMES.map((t) => (
            <button
              key={t.value}
              onClick={() => set({ timeframe: t.value })}
              className={`flex-1 py-1 text-xs rounded border transition-colors ${
                params.timeframe === t.value
                  ? "bg-[#26A69A] text-white border-[#26A69A]"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              }`}
            >
              {t.label.slice(0, 1)}
            </button>
          ))}
        </div>
      </div>

      {/* Period */}
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

      <hr className="border-gray-100" />

      {/* Indicators */}
      <div className="flex flex-col gap-2">
        <label className="label">Indicators</label>

        <div>
          <span className="text-xs text-gray-500">EMA periods</span>
          <div className="flex gap-1 mt-0.5">
            <input
              className="input flex-1 text-xs"
              value={emaInput}
              onChange={(e) => setEmaInput(e.target.value)}
              onBlur={applyEma}
              onKeyDown={(e) => e.key === "Enter" && applyEma()}
              placeholder="10, 20, 50"
            />
          </div>
        </div>

        {(
          [
            ["showRsi", "RSI (14)"],
            ["showMacd", "MACD"],
            ["showCvd", "CVD"],
            ["showCmf", "CMF (20)"],
          ] as [keyof SidebarParams["chartConfig"], string][]
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 cursor-pointer text-xs text-gray-700">
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

      <div className="mt-auto text-xs text-gray-400 space-y-0.5">
        <p>Data: Yahoo Finance</p>
        <p>List: Google Sheets</p>
      </div>
    </aside>
  );
}
