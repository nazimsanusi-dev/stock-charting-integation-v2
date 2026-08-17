"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  IChartApi,
  ISeriesApi,
  ColorType,
  LineStyle,
} from "lightweight-charts";
import type { ChartData, SidebarParams } from "@/lib/types";

interface Props {
  data: ChartData;
  config: SidebarParams["chartConfig"];
  ticker: string;
  theme?: "dark" | "light";
}

type DrawingTool = "none" | "long" | "range";

interface LongPositionDrawing {
  type: "long";
  entryTime: string;
  entryPrice: number;
  tpPrice: number;
  slPrice: number;
  endTime: string;
}

interface RangeDrawing {
  type: "range";
  startTime: string;
  startPrice: number;
  endTime: string;
  endPrice: number;
}

type DrawingItem = LongPositionDrawing | RangeDrawing;

export function StockChart({ data, config, ticker, theme = "dark" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  const [activeTool, setActiveTool] = useState<DrawingTool>("none");
  const [drawings, setDrawings] = useState<DrawingItem[]>([]);
  const isDark = theme === "dark";

  // 1. Inisialisasi Chart LWC
  useEffect(() => {
    if (!containerRef.current || !data.ohlcv || data.ohlcv.length === 0) return;

    if (chartRef.current) {
      chartRef.current.remove();
    }

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 380,
      layout: {
        background: { type: ColorType.Solid, color: isDark ? "#121722" : "#ffffff" },
        textColor: isDark ? "#94a3b8" : "#475569",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: isDark ? "rgba(30, 41, 59, 0.4)" : "rgba(226, 232, 240, 0.8)" },
        horzLines: { color: isDark ? "rgba(30, 41, 59, 0.4)" : "rgba(226, 232, 240, 0.8)" },
      },
      rightPriceScale: { borderColor: isDark ? "#1e293b" : "#cbd5e1" },
      timeScale: {
        borderColor: isDark ? "#1e293b" : "#cbd5e1",
        timeVisible: true,
        rightOffset: 6,
        barSpacing: 8,
      },
    });

    chartRef.current = chart;

    const candleData = data.ohlcv
      .map((d) => ({
        time: String(d.time).split("T")[0],
        open: Number(d.open),
        high: Number(d.high),
        low: Number(d.low),
        close: Number(d.close),
      }))
      .sort((a, b) => (a.time > b.time ? 1 : -1));

    const mainSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#f43f5e",
      wickUpColor: "#10b981",
      wickDownColor: "#f43f5e",
    });
    mainSeries.setData(candleData);
    mainSeriesRef.current = mainSeries;

    // Redraw Canvas Overlay bila carta dizoom / diskrol
    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      redrawCanvas();
    });

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
        redrawCanvas();
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (chartRef.current) chartRef.current.remove();
    };
  }, [data, isDark]);

  // 2. Fungsi Melukis Elemen pada Canvas Overlay
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const chart = chartRef.current;
    const series = mainSeriesRef.current;
    if (!canvas || !chart || !series) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Pastikan saiz canvas sepadan dengan saiz container
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const timeScale = chart.timeScale();

    drawings.forEach((d) => {
      if (d.type === "long") {
        const x1 = timeScale.timeToCoordinate(d.entryTime as any);
        const x2 = timeScale.timeToCoordinate(d.endTime as any) ?? canvas.width - 40;
        const yEntry = series.priceToCoordinate(d.entryPrice);
        const yTp = series.priceToCoordinate(d.tpPrice);
        const ySl = series.priceToCoordinate(d.slPrice);

        if (x1 === null || yEntry === null || yTp === null || ySl === null) return;

        const boxWidth = Math.max(80, (x2 ?? x1 + 100) - x1);

        // Zon Sasaran Untung (TP - Hijau)
        ctx.fillStyle = "rgba(16, 185, 129, 0.25)";
        ctx.fillRect(x1, yTp, boxWidth, yEntry - yTp);

        // Zon Had Rugi (SL - Merah)
        ctx.fillStyle = "rgba(244, 63, 94, 0.25)";
        ctx.fillRect(x1, yEntry, boxWidth, ySl - yEntry);

        // Garisan Entry, TP, SL
        ctx.strokeStyle = "#10b981";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x1, yTp, boxWidth, yEntry - yTp);

        ctx.strokeStyle = "#f43f5e";
        ctx.strokeRect(x1, yEntry, boxWidth, ySl - yEntry);

        // Info Tag (Risk/Reward Ratio)
        const targetPct = (((d.tpPrice - d.entryPrice) / d.entryPrice) * 100).toFixed(2);
        const stopPct = (((d.entryPrice - d.slPrice) / d.entryPrice) * 100).toFixed(2);
        const rrRatio = (Math.abs(d.tpPrice - d.entryPrice) / Math.abs(d.entryPrice - d.slPrice)).toFixed(2);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px monospace";
        ctx.fillText(`Target: +${targetPct}%`, x1 + 5, yTp + 12);
        ctx.fillText(`R:R = ${rrRatio}`, x1 + 5, yEntry - 4);
        ctx.fillText(`Stop: -${stopPct}%`, x1 + 5, ySl - 4);
      }

      if (d.type === "range") {
        const x1 = timeScale.timeToCoordinate(d.startTime as any);
        const x2 = timeScale.timeToCoordinate(d.endTime as any);
        const y1 = series.priceToCoordinate(d.startPrice);
        const y2 = series.priceToCoordinate(d.endPrice);

        if (x1 === null || x2 === null || y1 === null || y2 === null) return;

        const left = Math.min(x1, x2);
        const top = Math.min(y1, y2);
        const width = Math.abs(x2 - x1);
        const height = Math.abs(y2 - y1);

        // Kotak Biru Translucent
        ctx.fillStyle = "rgba(56, 189, 248, 0.15)";
        ctx.fillRect(left, top, width, height);

        ctx.strokeStyle = "#38bdf8";
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(left, top, width, height);
        ctx.setLineDash([]);

        // Label Maklumat
        const priceDiff = d.endPrice - d.startPrice;
        const pctDiff = ((priceDiff / d.startPrice) * 100).toFixed(2);
        ctx.fillStyle = "#38bdf8";
        ctx.font = "bold 10px sans-serif";
        ctx.fillText(
          `${priceDiff >= 0 ? "+" : ""}${priceDiff.toFixed(3)} (${pctDiff}%)`,
          left + 6,
          top + 14
        );
      }
    });
  }, [drawings]);

  useEffect(() => {
    redrawCanvas();
  }, [drawings, redrawCanvas]);

  // 3. Handle Klik Mouse pada Chart untuk Mencipta Lukisan
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool === "none") return;

    const canvas = canvasRef.current;
    const chart = chartRef.current;
    const series = mainSeriesRef.current;
    if (!canvas || !chart || !series) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const price = series.coordinateToPrice(y);
    const logical = chart.timeScale().coordinateToLogical(x);

    if (price === null || logical === null) return;

    const bars = data.ohlcv;
    const currentBar = bars[Math.min(Math.max(0, Math.floor(logical)), bars.length - 1)];
    if (!currentBar) return;

    const timeStr = String(currentBar.time).split("T")[0];

    if (activeTool === "long") {
      // Cipta Long Position lalai (TP: +6%, SL: -3%, Nisbah 2:1)
      const tp = Number((price * 1.06).toFixed(3));
      const sl = Number((price * 0.97).toFixed(3));
      const futureBar = bars[Math.min(bars.length - 1, Math.floor(logical) + 15)];

      const newDrawing: LongPositionDrawing = {
        type: "long",
        entryTime: timeStr,
        entryPrice: Number(price.toFixed(3)),
        tpPrice: tp,
        slPrice: sl,
        endTime: String(futureBar?.time ?? timeStr).split("T")[0],
      };

      setDrawings((prev) => [...prev, newDrawing]);
      setActiveTool("none"); // Reset selepas lukis
    }

    if (activeTool === "range") {
      const pastBar = bars[Math.max(0, Math.floor(logical) - 10)];
      const newRange: RangeDrawing = {
        type: "range",
        startTime: String(pastBar?.time ?? timeStr).split("T")[0],
        startPrice: Number((price * 0.95).toFixed(3)),
        endTime: timeStr,
        endPrice: Number(price.toFixed(3)),
      };

      setDrawings((prev) => [...prev, newRange]);
      setActiveTool("none");
    }
  };

  return (
    <div className="flex flex-col h-full w-full select-none">
      {/* Mini Drawing Toolbar */}
      <div className="flex items-center justify-between px-2 py-1 bg-gray-100 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-gray-400 mr-1 text-[10px]">TOOLS:</span>
          
          <button
            type="button"
            onClick={() => setActiveTool("none")}
            className={`px-2 py-0.5 rounded border transition ${
              activeTool === "none"
                ? "bg-gray-300 dark:bg-slate-700 font-bold border-gray-400"
                : "border-transparent text-gray-500 hover:bg-gray-200 dark:hover:bg-slate-800"
            }`}
            title="Kursor Biasa"
          >
            👆 Pointer
          </button>

          <button
            type="button"
            onClick={() => setActiveTool("long")}
            className={`px-2 py-0.5 rounded border transition flex items-center gap-1 ${
              activeTool === "long"
                ? "bg-emerald-500/20 text-emerald-500 border-emerald-500 font-bold"
                : "border-transparent text-gray-500 hover:bg-gray-200 dark:hover:bg-slate-800"
            }`}
            title="Klik pada carta untuk letak kedudukan Long (TP/SL)"
          >
            📈 Long Position
          </button>

          <button
            type="button"
            onClick={() => setActiveTool("range")}
            className={`px-2 py-0.5 rounded border transition flex items-center gap-1 ${
              activeTool === "range"
                ? "bg-sky-500/20 text-sky-400 border-sky-500 font-bold"
                : "border-transparent text-gray-500 hover:bg-gray-200 dark:hover:bg-slate-800"
            }`}
            title="Klik pada carta untuk ukur Julat Harga & Tarikh"
          >
            📐 Price & Date Range
          </button>
        </div>

        {drawings.length > 0 && (
          <button
            type="button"
            onClick={() => setDrawings([])}
            className="text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 font-medium px-2 py-0.5 rounded hover:bg-rose-500/10 transition text-[10px]"
          >
            🗑️ Padam Lukisan ({drawings.length})
          </button>
        )}
      </div>

      {/* Carta & Canvas Overlay */}
      <div className="relative flex-1 w-full min-h-[380px]">
        {/* Layer 1: TradingView Canvas */}
        <div ref={containerRef} className="absolute inset-0 w-full h-full" />

        {/* Layer 2: Interactive Drawing Overlay */}
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          className={`absolute inset-0 w-full h-full z-10 ${
            activeTool !== "none" ? "cursor-crosshair" : "pointer-events-none"
          }`}
        />
      </div>
    </div>
  );
}