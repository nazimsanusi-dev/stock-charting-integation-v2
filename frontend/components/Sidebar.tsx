"use client";

import { useState, useEffect } from "react";
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

interface Props {
  params: SidebarParams;
  onChange: (p: SidebarParams) => void;
}

export function Sidebar({ params, onChange }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [sheets, setSheets] = useState<SheetEntry[]>([]);
  const [worksheets, setWorksheets] = useState<string[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [search, setSearch] = useState("");
  const [emaInput, setEmaInput] = useState(params.chartConfig.emaPeriods.join(", "));
  const [loadingStocks, setLoadingStocks] = useState(false);
  const [sheetsError, setSheetsError] = useState<string | null>(null);
  const [stocksError, setStocksError] = useState<string | null>(null);

  useEffect(() => {
    api
      .sheets()
      .then((r) => {
        setSheets(r.sheets);
        setSheetsError(null);
        if (r.sheets.length > 0 && !params.selectedSheet) {
          onChange({ ...params, selectedSheet: r.sheets[0] });
        }
      })
      .catch((err) => setSheetsError(String(err)));
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!params.selectedSheet) return;
    api
      .worksheets(params.selectedSheet.url)
      .then((r) => {
        setWorksheets(r.worksheets);
        if (r.worksheets.length > 0) {
          onChange({ ...params, worksheet: r.worksheets[0] });
        }
      })
      .catch(() => setWorksheets([]));
  }, [params.selectedSheet?.url]); // eslint-disable-line

  useEffect(() => {
    if (!params.selectedSheet) return;
    setLoadingStocks(true);
    setStocksError(null);
    api
      .stocks(params.selectedSheet.url, params.worksheet)
      .then((r) => {
        setStocks(r.stocks);
        onChange({ ...params, allStocks: r.stocks });
      })
      .catch((err) => setStocksError(String(err)))
      .finally(() => setLoadingStocks(false));
  }, [params.selectedSheet?.url, params.worksheet]); // eslint-disable-line

  const filteredStocks = stocks.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.ticker.toLowerCase().includes(search.toLowerCase())
  );

  const selectedTicker = params.selectedStocks[0]?.ticker ?? null;

  // Radio: only 1 stock at a time
  const selectStock = (s: Stock) => {
    const isAlreadySelected = selectedTicker === s.ticker;
    onChange({
      ...params,
      selectedStocks: isAlreadySelected ? [] : [s],
    });
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

  if (collapsed) {
    return (
      <aside className="w-10 shrink-0 flex flex-col items-center py-3 gap-3 bg-[#FAFAFA] border-r border-gray-100 h-screen sticky top-0">
        <button
          onClick={() => setCollapsed(false)}
          className="p-1.5 rounded hover:bg-gray-200 text-gray-500 transition-colors"
          title="Expand sidebar"
        >
          ▶
        </button>
        <span className="text-gray-300 text-xs rotate-90 mt-4 tracking-widest select-none">STOCKS</span>
      </aside>
    );
  }

  return (
    <aside className="w-60 shrink-0 flex flex-col gap-4 overflow-y-auto py-4 px-3 bg-[#FAFAFA] border-r border-gray-100 h-screen sticky top-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="font-semibold text-gray-700 text-sm tracking-wide">📈 Stock Monitor</span>
        <button
          onClick={() => setCollapsed(true)}
          className="p-1 rounded hover:bg-gray-200 text-gray-400 transition-colors text-xs"
          title="Collapse sidebar"
        >
          ◀
        </button>
      </div>

      {/* Sheet selector */}
      {sheetsError && <p className="text-xs text-red-400 break-all">⚠ Sheets: {sheetsError}</p>}
      {sheets.length > 0 && (
        <div>
          <label className="label">Sheet</label>
          <select
            className="select"
            value={params.selectedSheet?.url ?? ""}
            onChange={(e) => {
              const sheet = sheets.find((s) => s.url === e.target.value) ?? null;
              onChange({ ...params, selectedSheet: sheet, selectedStocks: [], allStocks: [] });
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

      {/* Worksheet selector */}
      {worksheets.length > 1 && (
        <div>
          <label className="label">Worksheet</label>
          <select
            className="select"
            value={params.worksheet}
            onChange={(e) => onChange({ ...params, worksheet: e.target.value, selectedStocks: [], allStocks: [] })}
          >
            {worksheets.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Selected stock badge */}
      {params.selectedStocks[0] && (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-[#26A69A]/10 border border-[#26A69A]/30">
          <span className="w-2 h-2 rounded-full bg-[#26A69A] shrink-0" />
          <span className="text-xs font-medium text-[#1a7a72] truncate">{params.selectedStocks[0].name}</span>
          <span className="ml-auto text-xs text-[#26A69A] shrink-0">{params.selectedStocks[0].ticker}</span>
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
          {filteredStocks.map((s) => {
            const selected = selectedTicker === s.ticker;
            return (
              <label
                key={s.ticker}
                className={`flex items-center gap-2 cursor-pointer py-0.5 px-1 rounded text-xs transition-colors ${
                  selected ? "bg-[#26A69A]/10" : "hover:bg-gray-100"
                }`}
              >
                <input
                  type="radio"
                  name="stock-select"
                  className="accent-[#26A69A] shrink-0"
                  checked={selected}
                  onChange={() => selectStock(s)}
                  onClick={() => selected && selectStock(s)}
                />
                <span className={`truncate ${selected ? "text-[#1a7a72] font-medium" : "text-gray-700"}`}>
                  {s.name}
                </span>
                <span className="ml-auto text-gray-400 shrink-0">{s.ticker}</span>
              </label>
            );
          })}
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
        <div className="flex gap-1">
          {(["single", "grid", "table"] as const).map((m) => (
            <button
              key={m}
              onClick={() => set({ viewMode: m })}
              className={`flex-1 py-1 text-xs rounded border transition-colors ${
                params.viewMode === m
                  ? "bg-[#26A69A] text-white border-[#26A69A]"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              }`}
            >
              {m === "single" ? "Single" : m === "grid" ? "Grid" : "Table"}
            </button>
          ))}
        </div>
      </div>

      {/* Grid columns selector */}
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
                      ? "bg-gray-100 text-gray-300 border-gray-200 cursor-not-allowed"
                      : params.gridColumns === n
                      ? "bg-[#26A69A] text-white border-[#26A69A]"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Timeframe & Combine Timeframe — hidden in table mode */}
      {params.viewMode !== "table" && (
        <>
          {/* Combine Timeframe Toggle & Selectors */}
          <div className="flex flex-col gap-1.5 p-2 rounded bg-gray-50 border border-gray-100">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-xs font-medium text-gray-700">Combine Timeframes</span>
              <input
                type="checkbox"
                className="accent-[#26A69A] h-3.5 w-3.5 cursor-pointer"
                checked={params.isCombineTimeframe}
                onChange={(e) => {
                  const isChecked = e.target.checked;
                  set({
                    isCombineTimeframe: isChecked,
                    gridColumns: isChecked ? Math.min(params.gridColumns, 2) : params.gridColumns,
                  });
                }}
              />
            </label>

            {params.isCombineTimeframe && (
              <div className="grid grid-cols-2 gap-2 mt-1 pt-2 border-t border-gray-200">
                <div>
                  <span className="text-[10px] font-medium text-gray-500">TF 1 (Left)</span>
                  <select
                    className="select text-xs mt-0.5 py-1 px-1.5"
                    value={params.timeframe}
                    onChange={(e) => set({ timeframe: e.target.value })}
                  >
                    {TIMEFRAMES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="text-[10px] font-medium text-gray-500">TF 2 (Right)</span>
                  <select
                    className="select text-xs mt-0.5 py-1 px-1.5"
                    value={params.secondaryTimeframe}
                    onChange={(e) => set({ secondaryTimeframe: e.target.value })}
                  >
                    {TIMEFRAMES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Single Timeframe Selector (hanya bila Combine OFF) */}
          {!params.isCombineTimeframe && (
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
          )}

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
                  placeholder="5, 10, 20, 50, 100, 200"
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
        </>
      )}

      <div className="mt-auto text-xs text-gray-400 space-y-0.5">
        <p>Data: Yahoo Finance</p>
        <p>List: Google Sheets</p>
      </div>
    </aside>
  );
}