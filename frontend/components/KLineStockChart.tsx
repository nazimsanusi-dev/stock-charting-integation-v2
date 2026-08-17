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

  const isDark = theme === "dark";

  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Inisialisasi Chart
    const chart = init(containerRef.current, {
      styles: {
        grid: {
          horizontal: { color: isDark ? "#1f2937" : "#f3f4f6" },
          vertical: { color: isDark ? "#1f2937" : "#f3f4f6" },
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
        },
      },
    });

    if (!chart) return;
    chartRef.current = chart;

    // 2. Format Data Saham Bursa ke KLineData
    const klineData = (data?.ohlcv || [])
      .map((d) => {
        let ts = 0;
        if (typeof d.time === "number") {
          ts = d.time > 1e11 ? d.time : d.time * 1000;
        } else {
          ts = new Date(d.time).getTime();
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

    // 3. Masukkan Data (v10 API)
    chart.setDataLoader({
      getBars: ({ callback }) => {
        callback(klineData);
      },
    });

    // 4. Tambah Indikator
    chart.createIndicator({ name: "EMA", paneId: "candle_pane" });
    chart.createIndicator("VOL");
    chart.createIndicator("MACD");

    // 5. Auto-resize
    const resizeObserver = new ResizeObserver(() => {
      chart.resize();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (containerRef.current) {
        dispose(containerRef.current);
      }
    };
  }, [data, isDark]);

  // Fungsi Alat Lukisan & Ukuran
  const handleSelectTool = (overlayName: string) => {
    setActiveTool(overlayName);
    if (overlayName === "none") return;
    chartRef.current?.createOverlay(overlayName);
  };

  const handleClearDrawings = () => {
    chartRef.current?.removeOverlay();
    setActiveTool("none");
  };

  return (
    <div className="flex flex-col w-full h-full min-h-[580px] bg-white dark:bg-[#111827] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-sm">
      {/* Toolbar Lukisan & Ukuran */}
      <div className="flex flex-wrap items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-900/90 border-b border-gray-200 dark:border-gray-800 text-xs gap-2">
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

          {/* MEASURE TOOL (Price, Date Range & % Change) */}
          <button
            type="button"
            onClick={() => handleSelectTool("priceAndVolumeRange")}
            className={`px-2.5 py-1 rounded border transition ${
              activeTool === "priceAndVolumeRange"
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500 font-bold"
                : "border-transparent text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"
            }`}
            title="Ukur Perubahan Harga %, Bilangan Lilin, & Tempoh Hari"
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

      {/* Kontena Render Canvas */}
      <div ref={containerRef} className="w-full flex-1 min-h-[520px]" />
    </div>
  );
});