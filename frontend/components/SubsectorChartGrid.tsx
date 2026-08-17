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

// Helper Pengiraan MACD (12, 26, 9)
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
  ohlcList = [],
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

    // 1. Dapatkan lebar kontena sebenar (fallback ke 300px jika 0/terlalu kecil)
    const initialWidth = chartContainerRef.current.clientWidth || 300;

    const chart = createChart(chartContainerRef.current, {
      width: initialWidth,
      height: 310,
      layout: {
        background: { type: ColorType.Solid, color: isDark ? "#0d111a" : "#ffffff" },
        textColor: isDark ? "#94a3b8" : "#475569",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: isDark ? "rgba(30, 41, 59, 0.35)" : "rgba(226, 232, 240, 0.8)" },
        horzLines: { color: isDark ? "rgba(30, 41, 59, 0.35)" : "rgba(226, 232, 240, 0.8)" },
      },
      rightPriceScale: {
        borderColor: isDark ? "#1e293b" : "#cbd5e1",
        autoScale: true,
      },
      timeScale: {
        visible: true,
        borderColor: isDark ? "#1e293b" : "#cbd5e1",
        timeVisible: true,
        fixLeftEdge: false,
        fixRightEdge: false,
        rightOffset: 4,
        barSpacing: 6,
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

    // TR 1: Candlestick & EMAs
    const mainSeries = chart.addSeries(
      CandlestickSeries,
      {
        upColor: "#10b981",
        downColor: "#f43f5e",
        borderVisible: false,
        wickUpColor: "#10b981",
        wickDownColor: "#f43f5e",
      },
      0
    );
    mainSeries.setData(candleData);

    const closePoints = candleData.map((d) => ({ time: d.time, value: d.close }));

    const ema10 = chart.addSeries(LineSeries, { color: "#eab308", lineWidth: 1, priceLineVisible: false }, 0);
    const ema20 = chart.addSeries(LineSeries, { color: "#06b6d4", lineWidth: 1, priceLineVisible: false }, 0);
    const ema50 = chart.addSeries(LineSeries, { color: "#d946ef", lineWidth: 1, priceLineVisible: false }, 0);
    const ema100 = chart.addSeries(LineSeries, { color: "#f97316", lineWidth: 1, priceLineVisible: false }, 0);

    ema10.setData(calculateEMA(closePoints, 10));
    ema20.setData(calculateEMA(closePoints, 20));
    ema50.setData(calculateEMA(closePoints, 50));
    ema100.setData(calculateEMA(closePoints, 100));

    // TR 2: MACD
    const { histogram, macdLine, signalLine } = calculateMACD(closePoints);

    const macdHistSeries = chart.addSeries(
      HistogramSeries,
      {
        priceFormat: { type: "price", precision: 2, minMove: 0.01 },
        priceLineVisible: false,
        lastValueVisible: true,
      },
      1
    );
    macdHistSeries.setData(histogram);

    const macdLineSeries = chart.addSeries(
      LineSeries,
      {
        color: "#38bdf8",
        lineWidth: 1,
        priceFormat: { type: "price", precision: 2, minMove: 0.01 },
        priceLineVisible: false,
        lastValueVisible: false,
      },
      1
    );
    macdLineSeries.setData(macdLine);

    const signalLineSeries = chart.addSeries(
      LineSeries,
      {
        color: "#fbbf24",
        lineWidth: 1,
        priceFormat: { type: "price", precision: 2, minMove: 0.01 },
        priceLineVisible: false,
        lastValueVisible: false,
      },
      1
    );
    signalLineSeries.setData(signalLine);

    const zeroLineSeries = chart.addSeries(
      LineSeries,
      {
        color: isDark ? "rgba(148, 163, 184, 0.3)" : "rgba(100, 116, 139, 0.3)",
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        priceLineVisible: false,
        lastValueVisible: false,
      },
      1
    );
    zeroLineSeries.setData(closePoints.map((p) => ({ time: p.time, value: 0 })));

    try {
      const panes = chart.panes();
      if (panes && panes.length >= 2) {
        panes[0].setHeight(195);
        panes[1].setHeight(85);
      }
    } catch {
      // Fallback untuk versi tanpa setHeight
    }

    // Set julat lilin mengikut saiz skrin
    const totalBars = candleData.length;
    if (totalBars > 0) {
      const visibleBarsCount = initialWidth < 400 ? 35 : 65;
      chart.timeScale().setVisibleLogicalRange({
        from: Math.max(0, totalBars - visibleBarsCount),
        to: totalBars + 4,
      });
    }

    // 2. Gunakan ResizeObserver untuk auto-laras lebar carta serta-merta pada mobile
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && chartInstance.current) {
          chartInstance.current.applyOptions({
            width: Math.floor(entry.contentRect.width),
          });
        }
      }
    });

    if (chartContainerRef.current) {
      resizeObserver.observe(chartContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      if (chartInstance.current) {
        chartInstance.current.remove();
      }
    };
  }, [ohlcList, isDark]);

  const return5d = Number(rank.return_5d || 0);

  return (
    <div className="bg-white dark:bg-[#121722] border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col w-full min-w-0">
      {/* Header Info */}
      <div className="p-3 bg-gray-50 dark:bg-slate-900/70 border-b border-gray-200 dark:border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50 shrink-0">
            #{rank.rank}
          </span>
          <h3 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-slate-100 truncate">
            {rank.subsector_name}
          </h3>
        </div>
        <div className="flex items-center gap-2 text-xs shrink-0">
          <span className="text-gray-500 dark:text-slate-400 hidden sm:inline">
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
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-yellow-500"></span>EMA10</span>
          <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-cyan-500"></span>EMA20</span>
          <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-fuchsia-500"></span>EMA50</span>
          <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-orange-500"></span>EMA100</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[9px]">
          <span className="flex items-center gap-1 text-sky-400">MACD</span>
          <span className="flex items-center gap-1 text-amber-400">Signal</span>
        </div>
      </div>

      {/* Container Carta */}
      <div ref={chartContainerRef} className="w-full min-w-0 relative" />
    </div>
  );
}

interface SubsectorChartGridProps {
  ranks?: SubsectorRank[];
  ohlcData?: SubsectorBulkOHLC | null;
  theme?: string;
}

export function SubsectorChartGrid({
  ranks = [],
  ohlcData = {},
  theme = "dark",
}: SubsectorChartGridProps) {
  if (!ranks || ranks.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        Tiada carta subsektor untuk dipaparkan.
      </div>
    );
  }

  // Lindungi jika ohlcData adalah null / undefined
  const safeData = ohlcData || {};

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 w-full">
      {ranks.map((rank) => {
        const subId = rank.subsector_id;
        const ohlcList = safeData[subId] || safeData[String(subId)] || [];

        return (
          <SubsectorCard
            key={subId}
            rank={rank}
            ohlcList={ohlcList}
            theme={theme}
          />
        );
      })}
    </div>
  );
}

export default SubsectorChartGrid;