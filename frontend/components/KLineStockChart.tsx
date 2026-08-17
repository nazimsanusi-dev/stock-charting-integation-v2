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

  // 1. Inisialisasi Chart & Indikator
  useEffect(() => {
    if (!containerRef.current) return;
    setChartError(null);

    try {
      dispose(containerRef.current);

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
          indicator: {
            lastValueMark: { show: true },
          },
        },
      });

      if (!chart) {
        throw new Error("Gagal mencipta instance carta.");
      }

      chartRef.current = chart;

      // Cipta EMA di atas Candle Pane (isStack = true)
      try {
        (chart as any).createIndicator("EMA", true, { id: "candle_pane" });
      } catch {
        try {
          (chart as any).createIndicator?.({
            name: "EMA",
            paneOptions: { id: "candle_pane" },
          });
        } catch (e) {
          console.warn("EMA creation failed:", e);
        }
      }

      // Sub-panes untuk Volume & MACD
      try {
        chart.createIndicator("VOL");
        chart.createIndicator("MACD");
      } catch (e) {
        console.warn("VOL/MACD creation failed:", e);
      }

      const resizeObserver = new ResizeObserver(() => {
        chart.resize();
      });
      resizeObserver.observe(containerRef.current);

      return () => {
        resizeObserver.disconnect();
        if (containerRef.current) {
          dispose(containerRef.current);
        }
        chartRef.current = null;
      };
    } catch (err: any) {
      console.error("[KLineStockChart] Init Error:", err);
      setChartError(err?.message || "Gagal memulakan carta.");
    }
  }, [isDark, ticker]);

  // 2. Masukkan & Muat Data OHLCV
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !data?.ohlcv || data.ohlcv.length === 0) return;

    try {
      const klineData = data.ohlcv
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

      // Sokongan applyNewData (v9) & setDataLoader + loadMore (v10)
      if (typeof (chart as any).applyNewData === "function") {
        (chart as any).applyNewData(klineData);
      } else if (typeof (chart as any).applyData === "function") {
        (chart as any).applyData(klineData);
      } else if (typeof (chart as any).setDataLoader === "function") {
        (chart as any).setDataLoader({
          getBars: ({ callback }: any) => {
            callback({ bars: klineData, more: false });
          },
        });
        if (typeof (chart as any).loadMore === "function") {
          (chart as any).loadMore();
        }
      }

      setTimeout(() => {
        chart.resize();
      }, 50);
    } catch (err: any) {
      console.error("[KLineStockChart] Data Loading Error:", err);
      setChartError("Ralat semasa memuatkan lilin harga.");
    }
  }, [data, ticker]);

  // 3. Alat Lukisan
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
    <div className="flex flex-col w-full bg-white dark:bg-[#111827] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-sm relative">
      {/* Toolbar Lukisan & Ukuran */}
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