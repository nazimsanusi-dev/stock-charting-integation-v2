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

  // 1. Inisialisasi Chart & Indikator dengan Error Handling
  useEffect(() => {
    console.log(`[KLineStockChart] Initializing chart instance for ticker: ${ticker}, theme: ${theme}`);
    setChartError(null);

    if (!containerRef.current) {
      const err = "[KLineStockChart] Container ref is null!";
      console.warn(err);
      return;
    }

    try {
      // Bersihkan sebarang instance lama
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
        throw new Error("Instance klinecharts gagal dicipta oleh browser.");
      }

      chartRef.current = chart;
      console.log("[KLineStockChart] Chart instance created successfully.", chart);

      // Cipta Indikator Utama & Sub-panes (Fallback v9 & v10)
      try {
        (chart as any).createIndicator("EMA", false, { id: "candle_pane" });
        console.log("[KLineStockChart] EMA indicator created (v9 style).");
      } catch {
        try {
          (chart as any).createIndicator?.({ name: "EMA", paneId: "candle_pane" });
          console.log("[KLineStockChart] EMA indicator created (v10 style).");
        } catch (indErr) {
          console.error("[KLineStockChart] Indicator EMA error:", indErr);
        }
      }

      try {
        chart.createIndicator("VOL");
        chart.createIndicator("MACD");
        console.log("[KLineStockChart] VOL & MACD indicators created.");
      } catch (indErr) {
        console.warn("[KLineStockChart] Indicator VOL/MACD warning:", indErr);
      }

      // Auto-resize
      const resizeObserver = new ResizeObserver(() => {
        try {
          chart.resize();
        } catch (resErr) {
          console.warn("[KLineStockChart] Resize observer warning:", resErr);
        }
      });
      resizeObserver.observe(containerRef.current);

      return () => {
        console.log("[KLineStockChart] Cleaning up chart instance...");
        resizeObserver.disconnect();
        if (containerRef.current) {
          dispose(containerRef.current);
        }
        chartRef.current = null;
      };
    } catch (err: any) {
      console.error("[KLineStockChart] Initialization failed:", err);
      setChartError(err?.message || "Gagal memulakan enjin carta.");
    }
  }, [isDark, ticker]);

  // 2. Masukkan / Kemas Kini Data OHLCV dengan Error Handling
  useEffect(() => {
    const chart = chartRef.current;
    console.log(`[KLineStockChart] Data effect triggered. OHLCV bars count: ${data?.ohlcv?.length || 0}`);

    if (!chart) {
      console.warn("[KLineStockChart] Chart instance is not ready yet.");
      return;
    }

    if (!data?.ohlcv || data.ohlcv.length === 0) {
      console.warn("[KLineStockChart] data.ohlcv is empty!", data);
      return;
    }

    try {
      console.log("[KLineStockChart] Raw OHLCV sample (first bar):", data.ohlcv[0]);

      // Format Timestamp Unix ke Milisaat
      const klineData = data.ohlcv
        .map((d, index) => {
          let ts = 0;
          if (typeof d.time === "number") {
            ts = d.time > 1e11 ? d.time : d.time * 1000;
          } else {
            ts = new Date(d.time).getTime();
          }

          if (isNaN(ts)) {
            throw new Error(`Format masa tidak sah pada baris ${index}: ${d.time}`);
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

      console.log(`[KLineStockChart] Formatted klineData total: ${klineData.length} bars.`);

      // Masukkan data mengikut versi method yang disokong
      if (typeof (chart as any).applyData === "function") {
        console.log("[KLineStockChart] Calling chart.applyData(...)");
        (chart as any).applyData(klineData);
      } else if (typeof (chart as any).applyNewData === "function") {
        console.log("[KLineStockChart] Calling chart.applyNewData(...)");
        (chart as any).applyNewData(klineData);
      } else if (typeof (chart as any).setDataLoader === "function") {
        console.log("[KLineStockChart] Calling chart.setDataLoader(...)");
        (chart as any).setDataLoader({
          getBars: ({ callback }: any) => {
            callback({ bars: klineData, more: false });
          },
        });
      } else {
        throw new Error("Tiada fungsi kemas kini data yang sah pada instance KLineChart.");
      }

      setTimeout(() => {
        try {
          chart.resize();
        } catch {}
      }, 50);
    } catch (err: any) {
      console.error("[KLineStockChart] Data formatting/loading error:", err);
      setChartError(err?.message || "Gagal memproses data lilin pasaran.");
    }
  }, [data, ticker]);

  // 3. Fungsi Alat Lukisan dengan Error Guard
  const handleSelectTool = (overlayName: string) => {
    try {
      console.log(`[KLineStockChart] Selected tool: ${overlayName}`);
      setActiveTool(overlayName);
      if (overlayName === "none") return;
      chartRef.current?.createOverlay(overlayName);
    } catch (err) {
      console.error("[KLineStockChart] createOverlay error:", err);
    }
  };

  const handleClearDrawings = () => {
    try {
      console.log("[KLineStockChart] Removing all overlays");
      chartRef.current?.removeOverlay();
      setActiveTool("none");
    } catch (err) {
      console.error("[KLineStockChart] removeOverlay error:", err);
    }
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

      {/* Paparan Ralat jika berlaku masalah (Error Banner Overlay) */}
      {chartError && (
        <div className="absolute inset-x-4 top-14 z-20 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-500 text-xs flex items-center justify-between">
          <span>⚠️ {chartError}</span>
          <button
            type="button"
            onClick={() => setChartError(null)}
            className="text-rose-600 dark:text-rose-400 font-bold hover:underline ml-3"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Kontena Render Canvas (Ketinggian tetap 550px) */}
      <div
        ref={containerRef}
        style={{ width: "100%", height: "550px" }}
      />
    </div>
  );
});