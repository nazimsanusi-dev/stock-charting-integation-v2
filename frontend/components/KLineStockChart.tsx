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
    console.group(`🔍 [KLine Diagnostic] Memulakan Carta: ${ticker}`);
    setChartError(null);

    // 1. Semakan DOM Container
    if (!containerRef.current) {
      console.error("❌ [Langkah 1] Container DOM adalah NULL!");
      console.groupEnd();
      return;
    }

    const domRect = containerRef.current.getBoundingClientRect();
    console.log(`📐 [Langkah 1] Dimensi Kontena: Lebar = ${domRect.width}px, Tinggi = ${domRect.height}px`);

    if (domRect.height === 0 || domRect.width === 0) {
      console.warn("⚠️ [Amaran Dimensi] Saiz kontena 0px! Kanvas mungkin tersembunyi.");
    }

    try {
      // 2. Pembersihan Canvas Lama
      dispose(containerRef.current);
      console.log("🧹 [Langkah 2] Instance lama dibersihkan (dispose).");

      // 3. Semakan & Pemetaan Data API
      const rawOhlcv = data?.ohlcv || [];
      console.log(`📊 [Langkah 3] Bilangan Baris OHLCV Diterima: ${rawOhlcv.length}`);

      if (rawOhlcv.length === 0) {
        console.warn("⚠️ [Langkah 3] data.ohlcv kosong! Tiada data untuk dipetakan.");
        console.groupEnd();
        return;
      }

      console.log("📦 [Langkah 3] Sampel data mentah bar pertama:", rawOhlcv[0]);

      const klineData = rawOhlcv
        .map((item, index) => {
          const rawTime = item.time;
          const ts =
            typeof rawTime === "number"
              ? rawTime > 1e11
                ? rawTime
                : rawTime * 1000
              : new Date(rawTime).getTime();

          if (isNaN(ts) || ts <= 0) {
            console.error(`❌ Timestamp tidak sah pada baris ${index}:`, item);
          }

          return {
            timestamp: ts,
            open: Number(item.open),
            high: Number(item.high),
            low: Number(item.low),
            close: Number(item.close),
            volume: Number(item.volume || 0),
          };
        })
        .sort((a, b) => a.timestamp - b.timestamp);

      console.log(`✅ [Langkah 3] Selesai pemetaan. Jumlah bar: ${klineData.length}`);
      console.log("🕒 [Langkah 3] Bar terawal (index 0):", {
        timestamp: klineData[0].timestamp,
        tarikh: new Date(klineData[0].timestamp).toISOString(),
        harga: klineData[0].close,
      });
      console.log("🕒 [Langkah 3] Bar terkini (index akhir):", {
        timestamp: klineData[klineData.length - 1].timestamp,
        tarikh: new Date(klineData[klineData.length - 1].timestamp).toISOString(),
        harga: klineData[klineData.length - 1].close,
      });

      // 4. Inisialisasi Enjin KLineCharts
      console.log("⚙️ [Langkah 4] Menghidupkan enjin KLineCharts...");
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
        throw new Error("Panggilan init() gagal menghasilkan instance.");
      }

      chartRef.current = chart;
      console.log("✅ [Langkah 4] Instance KLineCharts berjaya dicipta:", chart);

      // 5. Pendaftaran DataLoader
      console.log("🔌 [Langkah 5] Mendaftarkan setDataLoader...");
      chart.setDataLoader({
        getBars: (params) => {
          console.log("🚀 [DataLoader Triggered] Fungsi getBars dipanggil oleh enjin!", params);
          params.callback(klineData);
          console.log(`📡 [DataLoader Callback] ${klineData.length} bar lilin dihantar ke kanvas.`);
        },
      });

      // 6. Pencetus Simbol & Kitaran Masa
      const targetTicker = ticker || data.ticker || "8605.KL";
      console.log(`🎯 [Langkah 6] Menetapkan Period & Symbol (${targetTicker})...`);

      if (typeof (chart as any).setPeriod === "function") {
        (chart as any).setPeriod({ multiplier: 1, timespan: "day" });
        console.log("⏱️ [Langkah 6] setPeriod({ multiplier: 1, timespan: 'day' }) selesai.");
      }

      if (typeof (chart as any).setSymbol === "function") {
        (chart as any).setSymbol({
          ticker: targetTicker,
          shortName: targetTicker,
          pricePrecision: 3,
          volumePrecision: 0,
        });
        console.log("🏷️ [Langkah 6] setSymbol(...) selesai.");
      }

      // 7. Cipta Indikator
      console.log("📈 [Langkah 7] Menambah indikator...");
      try {
        chart.createIndicator("EMA", true, { id: "candle_pane" });
        console.log("✅ [Langkah 7] EMA dicipta pada candle_pane.");
      } catch (e) {
        console.warn("⚠️ [Langkah 7] Ralat mencipta EMA:", e);
      }

      try {
        chart.createIndicator("VOL", false);
        chart.createIndicator("MACD", false);
        console.log("✅ [Langkah 7] Sub-panes VOL & MACD dicipta.");
      } catch (e) {
        console.warn("⚠️ [Langkah 7] Ralat mencipta VOL/MACD:", e);
      }

      // 8. Semakan Status Selepas 250ms
      setTimeout(() => {
        const dataList = typeof (chart as any).getDataList === "function" ? (chart as any).getDataList() : null;
        console.log("🔍 [Post-Check 250ms] Status data dalam carta:", {
          jumlahBarDalamCarta: dataList ? dataList.length : "getDataList tidak disokong",
        });
        chart.resize();
      }, 250);

      // 9. Resize Observer
      const resizeObserver = new ResizeObserver(() => {
        chart.resize();
      });
      resizeObserver.observe(containerRef.current);

      console.groupEnd();

      return () => {
        console.log(`🛑 [Cleanup] Menutup carta: ${targetTicker}`);
        resizeObserver.disconnect();
        if (containerRef.current) {
          dispose(containerRef.current);
        }
        chartRef.current = null;
      };
    } catch (err: any) {
      console.error("❌ [Ralat Utama KLineCharts]:", err);
      setChartError(err?.message || "Ralat memaparkan carta.");
      console.groupEnd();
    }
  }, [data, ticker, isDark]);

  // Fungsi Alat Ukuran & Lukisan
  const handleSelectTool = (overlayName: string) => {
    console.log(`🛠️ [Alat Dipilih] -> ${overlayName}`);
    setActiveTool(overlayName);
    if (overlayName === "none") return;
    const res = chartRef.current?.createOverlay(overlayName);
    console.log("✏️ [Overlay ID]:", res);
  };

  const handleClearDrawings = () => {
    console.log("🗑️ [Alat Tindakan] Memadam semua lukisan.");
    chartRef.current?.removeOverlay();
    setActiveTool("none");
  };

  return (
    <div className="flex flex-col w-full bg-white dark:bg-[#111827] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-sm relative">
      {/* Toolbar */}
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
            title="Ukur Perubahan Harga %, Lilin & Hari"
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