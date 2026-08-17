"use client";

import { useEffect, useRef, useState, memo } from "react";
import { init, dispose, Chart } from "klinecharts";
import type { ChartData } from "@/lib/types";

interface Props {
  data: ChartData;
  ticker: string;
  theme?: "dark" | "light";
}

export const KLineStockChart = memo(function KLineStockChart({
  data,
  ticker,
  theme = "dark",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const [activeTool, setActiveTool] = useState<string>("none");
  const [chartError, setChartError] = useState<string | null>(null);

  const isDark = theme === "dark";

  useEffect(() => {
    console.group(`[KLineStockChart] Lifecycle for: ${ticker}`);
    setChartError(null);

    // 1. Semak Kontena DOM
    if (!containerRef.current) {
      console.error("[1. DOM Check] containerRef.current is NULL!");
      console.groupEnd();
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    console.log(`[1. DOM Check] Container mounted. Width: ${rect.width}px, Height: ${rect.height}px`);

    try {
      // 2. Bersihkan Instance Lama
      dispose(containerRef.current);
      console.log("[2. Cleanup] Previous chart instance disposed.");

      // 3. Semak & Format Data OHLCV
      const rawList = data?.ohlcv || [];
      console.log(`[3. Data Check] Raw OHLCV count: ${rawList.length}`);

      if (rawList.length === 0) {
        console.warn("[3. Data Check] Data OHLCV kosong, render dibatalkan.");
        console.groupEnd();
        return;
      }

      console.log("[3. Data Check] Sample raw first bar:", rawList[0]);

      const klineData = rawList
        .map((d, idx) => {
          let ts = 0;
          if (typeof d.time === "number") {
            ts = d.time > 1e11 ? d.time : d.time * 1000;
          } else {
            ts = new Date(d.time).getTime();
          }

          if (isNaN(ts)) {
            console.error(`[Data Error] Invalid timestamp at index ${idx}:`, d.time);
          }

          return {
            timestamp: ts,
            open: Number(d.open),
            high: Number(d.high),
            low: Number(d.low),
            close: Number(d.close),
            volume: Number(d.volume || 0),
          };
        })
        .sort((a, b) => a.timestamp - b.timestamp);

      console.log(`[3. Data Check] Formatted klineData count: ${klineData.length}`);
      console.log("[3. Data Check] Sample formatted bar [0]:", klineData[0]);
      console.log("[3. Data Check] Sample formatted bar [last]:", klineData[klineData.length - 1]);

      // 4. Inisialisasi KLineChart
      console.log("[4. Init] Creating new KLineChart instance...");
      const chart = init(containerRef.current, {
        styles: {
          grid: {
            horizontal: { color: isDark ? "#1e293b" : "#f1f5f9" },
            vertical: { color: isDark ? "#1e293b" : "#f1f5f9" },
          },
          candle: {
            bar: {
              upColor: "#26A69A",
              downColor: "#EF5350",
              upBorderColor: "#26A69A",
              downBorderColor: "#EF5350",
              upWickColor: "#26A69A",
              downWickColor: "#EF5350",
            },
            priceMark: {
              last: {
                upColor: "#26A69A",
                downColor: "#EF5350",
              },
            },
          },
          xAxis: {
            show: true,
            tickText: {
              color: isDark ? "#94a3b8" : "#475569",
              size: 10,
            },
          },
          yAxis: {
            tickText: {
              color: isDark ? "#94a3b8" : "#475569",
              size: 10,
            },
          },
        },
      });

      if (!chart) {
        throw new Error("init() mengembalikan null.");
      }

      chartRef.current = chart;
      console.log("[4. Init] Chart instance successfully created:", chart);

      // 5. Masukkan Data ke Chart (Semak fungsi yang wujud)
      const chartAny = chart as any;
      console.log("[5. Data Feeding] Available methods on chart:", {
        hasApplyData: typeof chartAny.applyData === "function",
        hasApplyNewData: typeof chartAny.applyNewData === "function",
        hasSetDataLoader: typeof chartAny.setDataLoader === "function",
        hasLoadMore: typeof chartAny.loadMore === "function",
      });

      if (typeof chartAny.applyData === "function") {
        console.log("[5. Data Feeding] Executing chart.applyData(...)");
        chartAny.applyData(klineData);
      } else if (typeof chartAny.applyNewData === "function") {
        console.log("[5. Data Feeding] Executing chart.applyNewData(...)");
        chartAny.applyNewData(klineData);
      } else if (typeof chartAny.setDataLoader === "function") {
        console.log("[5. Data Feeding] Setting up setDataLoader...");
        chartAny.setDataLoader({
          getBars: ({ callback }: any) => {
            console.log("[5. Data Feeding] getBars callback executed with", klineData.length, "bars");
            // Menyokong kedua-dua format payload callback
            try {
              callback({ bars: klineData, more: false });
            } catch {
              callback(klineData);
            }
          },
        });

        if (typeof chartAny.loadMore === "function") {
          console.log("[5. Data Feeding] Triggering chart.loadMore()...");
          chartAny.loadMore();
        }
      }

      // 6. Cipta Indikator
      console.log("[6. Indicators] Creating indicators...");
      try {
        chartAny.createIndicator("EMA", true, { id: "candle_pane" });
        console.log("[6. Indicators] EMA created on candle_pane (isStack = true)");
      } catch (e1) {
        try {
          chartAny.createIndicator?.({
            name: "EMA",
            paneOptions: { id: "candle_pane" },
          });
          console.log("[6. Indicators] EMA created via object options");
        } catch (e2) {
          console.warn("[6. Indicators] Failed to create EMA:", e2);
        }
      }

      try {
        chart.createIndicator("VOL", false);
        chart.createIndicator("MACD", false);
        console.log("[6. Indicators] VOL and MACD sub-panes created");
      } catch (e3) {
        console.warn("[6. Indicators] Failed to create VOL/MACD:", e3);
      }

      // 7. Resize Observer
      const resizeObserver = new ResizeObserver(() => {
        console.log("[7. Resize] Container resized, triggering chart.resize()");
        chart.resize();
      });
      resizeObserver.observe(containerRef.current);

      console.groupEnd();

      return () => {
        console.log(`[Cleanup] Unmounting chart for ${ticker}`);
        resizeObserver.disconnect();
        if (containerRef.current) {
          dispose(containerRef.current);
        }
        chartRef.current = null;
      };
    } catch (err: any) {
      console.error("[Fatal Render Error]:", err);
      setChartError(err?.message || "Ralat memaparkan carta.");
      console.groupEnd();
    }
  }, [data, ticker, isDark]);

  // Fungsi Drawing Tools
  const handleSelectTool = (overlayName: string) => {
    console.log(`[Tool Selected] -> ${overlayName}`);
    setActiveTool(overlayName);
    if (overlayName === "none") return;
    const res = chartRef.current?.createOverlay(overlayName);
    console.log(`[Overlay Created] ID:`, res);
  };

  const handleClearDrawings = () => {
    console.log("[Tool Action] Clearing all overlays");
    chartRef.current?.removeOverlay();
    setActiveTool("none");
  };

  return (
    <div className="flex flex-col w-full bg-white dark:bg-[#111827] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-sm relative">
      {/* Drawing Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 text-xs gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-bold text-[10px] text-gray-400 mr-1">TOOLS:</span>

          <button
            type="button"
            onClick={() => handleSelectTool("none")}
            className={`px-2.5 py-1 rounded border transition ${
              activeTool === "none"
                ? "bg-gray-300 dark:bg-gray-700 font-bold border-gray-400 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                : "border-transparent text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"
            }`}
          >
            👆 Pointer
          </button>

          <button
            type="button"
            onClick={() => handleSelectTool("priceAndVolumeRange")}
            className={`px-2.5 py-1 rounded border transition ${
              activeTool === "priceAndVolumeRange"
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500 font-bold"
                : "border-transparent text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"
            }`}
            title="Ukur Perubahan Harga %, Bilangan Lilin & Tempoh"
          >
            📏 Measure Tool
          </button>

          <button
            type="button"
            onClick={() => handleSelectTool("priceRange")}
            className={`px-2.5 py-1 rounded border transition ${
              activeTool === "priceRange"
                ? "bg-sky-500/20 text-sky-400 border-sky-500 font-bold"
                : "border-transparent text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"
            }`}
          >
            📐 Price Range
          </button>

          <button
            type="button"
            onClick={() => handleSelectTool("segment")}
            className={`px-2.5 py-1 rounded border transition ${
              activeTool === "segment"
                ? "bg-amber-500/20 text-amber-400 border-amber-500 font-bold"
                : "border-transparent text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"
            }`}
          >
            ✏️ Trendline
          </button>

          <button
            type="button"
            onClick={() => handleSelectTool("fibonacciRetracement")}
            className={`px-2.5 py-1 rounded border transition ${
              activeTool === "fibonacciRetracement"
                ? "bg-purple-500/20 text-purple-400 border-purple-500 font-bold"
                : "border-transparent text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"
            }`}
          >
            🌀 Fibonacci
          </button>

          <button
            type="button"
            onClick={() => handleSelectTool("horizontalStraightLine")}
            className={`px-2.5 py-1 rounded border transition ${
              activeTool === "horizontalStraightLine"
                ? "bg-indigo-500/20 text-indigo-400 border-indigo-500 font-bold"
                : "border-transparent text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"
            }`}
          >
            ➖ Support / Resistance
          </button>
        </div>

        <button
          type="button"
          onClick={handleClearDrawings}
          className="text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 font-medium px-2 py-1 rounded hover:bg-rose-500/10 transition text-[11px]"
        >
          🗑️ Padam Semua
        </button>
      </div>

      {chartError && (
        <div className="p-3 bg-rose-500/10 border-b border-rose-500/30 text-rose-500 text-xs">
          ⚠️ {chartError}
        </div>
      )}

      {/* Kontena Render Canvas */}
      <div
        ref={containerRef}
        style={{ width: "100%", height: "550px" }}
      />
    </div>
  );
});