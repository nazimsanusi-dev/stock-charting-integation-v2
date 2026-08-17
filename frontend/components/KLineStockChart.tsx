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
    if (!containerRef.current) return;
    setChartError(null);

    // 1. Bersihkan sebarang kanvas lama
    dispose(containerRef.current);

    // 2. PEMETAAN (MAPPING) DARI API JSON KE FORMAT KLINECHARTS
    const rawOhlcv = data?.ohlcv || [];
    if (rawOhlcv.length === 0) {
      return;
    }

    const klineData = rawOhlcv
      .map((item) => {
        // Tukar Unix Timestamp saat (10 digit) -> milisaat (13 digit)
        const ts =
          typeof item.time === "number"
            ? item.time > 1e11
              ? item.time
              : item.time * 1000
            : new Date(item.time).getTime();

        return {
          timestamp: ts,
          open: Number(item.open),
          high: Number(item.high),
          low: Number(item.low),
          close: Number(item.close),
          volume: Number(item.volume || 0),
        };
      })
      .sort((a, b) => a.timestamp - b.timestamp); // Susun secara kronologi menaik

    try {
      // 3. Inisialisasi Enjin Carta KLineCharts (v10)
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

      if (!chart) throw new Error("Gagal mencipta kanvas carta.");
      chartRef.current = chart;

      // 4. Daftarkan DataLoader (v10)
      chart.setDataLoader({
        getBars: ({ callback }) => {
          callback(klineData);
        },
      });

      // 5. Cipta Indikator
      try {
        (chart as any).createIndicator("EMA", true, { id: "candle_pane" });
      } catch {
        (chart as any).createIndicator?.({
          name: "EMA",
          paneOptions: { id: "candle_pane" },
        });
      }

      try {
        chart.createIndicator("VOL", false);
        chart.createIndicator("MACD", false);
      } catch (e) {
        console.warn("Indicator setup warning:", e);
      }

      // 6. Cetuskan Panggilan DataLoader Melalui setSymbol (Wajib untuk v10)
      if (typeof (chart as any).setSymbol === "function") {
        (chart as any).setSymbol({
          ticker: ticker || data.ticker || "STOCK",
          shortName: ticker || data.ticker || "STOCK",
          pricePrecision: 3,
          volumePrecision: 0,
        });
      }

      // 7. Auto Resize Kanvas
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
      console.error("[KLineStockChart Error]:", err);
      setChartError(err?.message || "Ralat memaparkan carta.");
    }
  }, [data, ticker, isDark]);

  // Fungsi Alat Ukuran & Lukisan
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
      {/* Toolbar Ukuran & Lukisan */}
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

      {/* Kontena Render Canvas (Ketinggian tetap 550px) */}
      <div
        ref={containerRef}
        style={{ width: "100%", height: "550px" }}
      />
    </div>
  );
});