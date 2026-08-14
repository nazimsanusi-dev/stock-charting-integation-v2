"use client";

import React, { useEffect, useRef } from "react";
import type { SubsectorRank, SubsectorBulkOHLC, SubsectorOHLC } from "@/lib/types";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  IChartApi,
  ColorType,
  LineStyle,
} from "lightweight-charts";

// Helper Pengiraan EMA
function calculateEMA(data: { time: string; value: number }[], period: number) {
  if (data.length < period) return [];
  const k = 2 / (period + 1);
  const emaData = [];
  let prevEMA = data.slice(0, period).reduce((acc, curr) => acc + curr.value, 0) / period;
  emaData.push({ time: data[period - 1].time, value: prevEMA });

  for (let i = period; i < data.length; i++) {
    const currentVal = data[i].value;
    prevEMA = currentVal * k + prevEMA * (1 - k);
    emaData.push({ time: data[i].time, value: prevEMA });
  }
  return emaData;
}

// Helper Pengiraan MACD (12, 26, 9) - Mengembalikan Histogram, MACD Line & Signal Line
function calculateMACD(data: { time: string; value: number }[]) {
  const ema12 = calculateEMA(data, 12);
  const ema26 = calculateEMA(data, 26);
  const macdMap = new Map<string, number>();

  ema26.forEach((item) => {
    const match12 = ema12.find((x) => x.time === item.time);
    if (match12 !== undefined) {
      macdMap.set(item.time, match12.value - item.value);
    }
  });

  const macdLine = Array.from(macdMap.entries()).map(([time, value]) => ({ time, value }));
  const signalLine = calculateEMA(macdLine, 9);
  const signalMap = new Map<string, number>(signalLine.map((s) => [s.time, s.value]));

  const histogram = [];
  for (const m of macdLine) {
    const sig = signalMap.get(m.time);
    if (sig !== undefined) {
      const diff = m.value - sig;
      histogram.push({
        time: m.time,
        value: diff,
        color: diff >= 0 ? "#10b981" : "#f43f5e",
      });
    }
  }

  return { macdLine, signalLine, histogram };
}

function SubsectorCard({
  rank,
  ohlcList,
  theme = "dark",
}: {
  rank: SubsectorRank;
  ohlcList: SubsectorOHLC[];
  theme?: string;
}) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<IChartApi | null>(null);
  const isDark = theme === "dark";

  useEffect(() => {
    if (!chartContainerRef.current || !ohlcList || ohlcList.length === 0) return;

    if (chartInstance.current) {
      chartInstance.current.remove();
    }

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 300,
      layout: {
        background: { type: ColorType.Solid, color: isDark ? "#0d111a" : "#ffffff" },
        textColor: isDark ? "#94a3b8" : "#475569",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: isDark ? "rgba(30, 41, 59, 0.4)" : "rgba(226, 232, 240, 0.8)" },
        horzLines: { color: isDark ? "rgba(30, 41, 59, 0.4)" : "rgba(226, 232, 240, 0.8)" },
      },
      rightPriceScale: {
        borderColor: isDark ? "#1e293b" : "#cbd5e1",
        scaleMargins: { top: 0.08, bottom: 0.28 },
        autoScale: true,
      },
      timeScale: {
        visible: true,
        borderColor: isDark ? "#1e293b" : "#cbd5e1",
        timeVisible: true,
        fixLeftEdge: false,  // Benarkan tarik ke kiri tanpa sekatan
        fixRightEdge: false, // Benarkan ruang margin di kanan
        rightOffset: 6,      // Ruang ekstra pada tarikh terkini
        barSpacing: 7,       // Jarak lilin yang selesa
        minBarSpacing: 2,
      },
      crosshair: {
        vertLine: { color: isDark ? "#475569" : "#94a3b8", style: LineStyle.Dashed },
        horzLine: { color: isDark ? "#475569" : "#94a3b8", style: LineStyle.Dashed },
      },
    });

    chartInstance.current = chart;

    const candleData = ohlcList
      .map((d) => ({
        time: typeof d.date === "string" ? d.date.split("T")[0] : d.date,
        open: Number(d.open),
        high: Number(d.high),
        low: Number(d.low),
        close: Number(d.close),
      }))
      .sort((a, b) => (a.time > b.time ? 1 : -1));

    // 1. Candlestick Series
    const mainSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#f43f5e",
      borderVisible: false,
      wickUpColor: "#10b981",
      wickDownColor: "#f43f5e",
    });
    mainSeries.setData(candleData);

    const closePoints = candleData.map((d) => ({ time: d.time, value: d.close }));

    // 2. EMA Overlays (EMA 10, 20, 50, 100)
    const ema10Data = calculateEMA(closePoints, 10);
    const ema20Data = calculateEMA(closePoints, 20);
    const ema50Data = calculateEMA(closePoints, 50);
    const ema100Data = calculateEMA(closePoints, 100);

    const ema10 = chart.addSeries(LineSeries, { color: "#eab308", lineWidth: 1, priceLineVisible: false });
    const ema20 = chart.addSeries(LineSeries, { color: "#06b6d4", lineWidth: 1, priceLineVisible: false });
    const ema50 = chart.addSeries(LineSeries, { color: "#d946ef", lineWidth: 1, priceLineVisible: false });
    const ema100 = chart.addSeries(LineSeries, { color: "#f97316", lineWidth: 1.5, priceLineVisible: false });

    ema10.setData(ema10Data);
    ema20.setData(ema20Data);
    ema50.setData(ema50Data);
    ema100.setData(ema100Data);

    // 3. MACD Pane (Histogram + MACD Line + Signal Line)
    const { histogram, macdLine, signalLine } = calculateMACD(closePoints);

    chart.priceScale("macd").applyOptions({
      scaleMargins: { top: 0.78, bottom: 0.02 },
      borderColor: isDark ? "#1e293b" : "#cbd5e1",
    });

    const macdHistSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "macd",
      priceLineVisible: false,
    });
    macdHistSeries.setData(histogram);

    const macdLineSeries = chart.addSeries(LineSeries, {
      color: "#38bdf8", // Sky Blue
      lineWidth: 1,
      priceScaleId: "macd",
      priceLineVisible: false,
    });
    macdLineSeries.setData(macdLine);

    const signalLineSeries = chart.addSeries(LineSeries, {
      color: "#f59e0b", // Amber
      lineWidth: 1,
      priceScaleId: "macd",
      priceLineVisible: false,
    });
    signalLineSeries.setData(signalLine);

    // Set paparan lalai fokus kepada data terkini (~65 bars terakhir)
    const totalBars = candleData.length;
    if (totalBars > 0) {
      chart.timeScale().setVisibleLogicalRange({
        from: Math.max(0, totalBars - 65),
        to: totalBars + 6,
      });
    }

    // Resize Observer tanpa reset posisi lilin
    const handleResize = () => {
      if (chartContainerRef.current && chartInstance.current) {
        chartInstance.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (chartInstance.current) {
        chartInstance.current.remove();
      }
    };
  }, [ohlcList, isDark]);

  const return5d = Number(rank.return_5d || 0);

  return (
    <div className="bg-white dark:bg-[#121722] border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
      {/* Header Info */}
      <div className="p-3 bg-gray-50 dark:bg-slate-900/70 border-b border-gray-200 dark:border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50">
            #{rank.rank}
          </span>
          <h3 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-slate-100 truncate max-w-[140px] sm:max-w-none">
            {rank.subsector_name}
          </h3>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500 dark:text-slate-400">
            Score: <strong className="text-gray-800 dark:text-slate-200">{rank.score}</strong>
          </span>
          <span
            className={`font-semibold px-1.5 py-0.5 rounded ${
              return5d >= 0
                ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400"
                : "bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-400"
            }`}
          >
            {return5d >= 0 ? `+${return5d.toFixed(2)}%` : `${return5d.toFixed(2)}%`}
          </span>
        </div>
      </div>

      {/* Indicator Legend Bar */}
      <div className="px-3 py-1 bg-gray-100/50 dark:bg-[#0b0e14] border-b border-gray-200 dark:border-slate-800/60 flex flex-wrap items-center justify-between text-[10px] text-gray-500 dark:text-slate-400 gap-y-1">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1">
            <span className="w-2 h-0.5 bg-yellow-500"></span>EMA 10
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-0.5 bg-cyan-500"></span>EMA 20
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-0.5 bg-fuchsia-500"></span>EMA 50
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-0.5 bg-orange-500"></span>EMA 100
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[9px]">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>MACD
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>Signal
          </span>
        </div>
      </div>

      {/* Chart Canvas */}
      <div ref={chartContainerRef} className="w-full relative" />
    </div>
  );
}

interface SubsectorChartGridProps {
  ranks: SubsectorRank[];
  ohlcData: SubsectorBulkOHLC;
  theme?: string;
}

export function SubsectorChartGrid({ ranks = [], ohlcData = {}, theme = "dark" }: SubsectorChartGridProps) {
  if (!ranks || ranks.length === 0) {
    return <div className="text-center py-8 text-gray-400 text-sm">Tiada carta subsektor untuk dipaparkan.</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 w-full">
      {ranks.map((rank) => (
        <SubsectorCard
          key={rank.subsector_id}
          rank={rank}
          ohlcList={ohlcData[rank.subsector_id] || []}
          theme={theme}
        />
      ))}
    </div>
  );
}

export default SubsectorChartGrid;