"use client";

import { useEffect, useRef, useState, useCallback, useMemo, memo } from "react";
import type { ChartData, SidebarParams } from "@/lib/types";

function formatDisplayDate(time: any): string {
  if (!time) return "";
  let d: Date;
  if (typeof time === "number") {
    d = new Date(time > 1e11 ? time : time * 1000);
  } else if (typeof time === "string") {
    if (/^\d{10,13}$/.test(time)) {
      const num = Number(time);
      d = new Date(num > 1e11 ? num : num * 1000);
    } else {
      d = new Date(time);
    }
  } else {
    d = new Date(time);
  }
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatLwcTime(time: any): string {
  if (!time) return "";
  if (typeof time === "number") {
    const d = new Date(time > 1e11 ? time : time * 1000);
    return d.toISOString().split("T")[0];
  }
  if (typeof time === "string") {
    if (/^\d{10,13}$/.test(time)) {
      const num = Number(time);
      const d = new Date(num > 1e11 ? num : num * 1000);
      return d.toISOString().split("T")[0];
    }
    return time.split("T")[0];
  }
  return String(time);
}

function formatVolume(val: number | null | undefined): string {
  if (val === null || val === undefined) return "-";
  if (val >= 1e6) return `${(val / 1e6).toFixed(2)}M`;
  if (val >= 1e3) return `${(val / 1e3).toFixed(1)}K`;
  return val.toLocaleString();
}

const COLOR_PALETTES = {
  light: {
    up: "#26A69A",
    down: "#EF5350",
    bg: "#FFFFFF",
    grid: "#F0F0F0",
    text: "#424242",
    rsi: "#9C27B0",
    macd: "#2196F3",
    macdSignal: "#FF9800",
    cvd: "#00BCD4",
    cmf: "#4CAF50",
    level: "#BDBDBD",
    zeroLine: "#000000",
  },
  dark: {
    up: "#26A69A",
    down: "#EF5350",
    bg: "#121722",
    grid: "#1F2937",
    text: "#94A3B8",
    rsi: "#AB47BC",
    macd: "#42A5F5",
    macdSignal: "#FFA726",
    cvd: "#26C6DA",
    cmf: "#66BB6A",
    level: "#4B5563",
    zeroLine: "#FFFFFF",
  },
};

const EMA_COLORS = ["#2196F3", "#FF9800", "#9C27B0", "#E91E63", "#00BCD4", "#8BC34A"];

type DrawingTool = "none" | "long" | "range";

interface LongPositionDrawing {
  id: string;
  type: "long";
  entryTime: string;
  entryPrice: number;
  tpPrice: number;
  slPrice: number;
  endTime: string;
}

interface RangeDrawing {
  id: string;
  type: "range";
  startTime: string;
  startPrice: number;
  endTime: string;
  endPrice: number;
  barsCount: number;
}

type DrawingItem = LongPositionDrawing | RangeDrawing;

type DragHandleTarget =
  | { type: "long"; id: string; handle: "tp" | "sl" }
  | { type: "range"; id: string; handle: "p1" | "p2" };

interface HoverBarData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  change: number;
  diff: number;
  volume: number | null;
}

interface Props {
  data: ChartData;
  config?: SidebarParams["chartConfig"];
  ticker: string;
  mini?: boolean;
  theme?: "light" | "dark";
}

export const StockChart = memo(function StockChart({
  data,
  config = {
    emaPeriods: [10, 20, 50],
    showVolume: true,
    showRsi: false,
    showMacd: false,
    showCvd: false,
    showCmf: false,
  },
  ticker,
  mini = false,
  theme = "dark",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);
  const mainSeriesRef = useRef<any>(null);
  const volSeriesRef = useRef<any>(null);
  const lastTickerRef = useRef<string>("");

  const [activeTool, setActiveTool] = useState<DrawingTool>("none");
  const [drawings, setDrawings] = useState<DrawingItem[]>([]);

  // State Ukuran Semasa Melukis Baharu
  const [rangeStart, setRangeStart] = useState<{ x: number; y: number; price: number; timeStr: string; barIdx: number } | null>(null);
  const [rangeCurrent, setRangeCurrent] = useState<{ x: number; y: number; price: number; timeStr: string; barIdx: number } | null>(null);

  // State Mengubah Suai Titik Pemegang (Handles)
  const [draggingHandle, setDraggingHandle] = useState<DragHandleTarget | null>(null);
  const [hoveredHandle, setHoveredHandle] = useState<DragHandleTarget | null>(null);

  // State Hover Data OHLCV
  const [hoverData, setHoverData] = useState<HoverBarData | null>(null);

  const C = COLOR_PALETTES[theme] || COLOR_PALETTES.dark;
  const drawingsRef = useRef<DrawingItem[]>(drawings);
  drawingsRef.current = drawings;

  const hasRange = drawings.some((d) => d.type === "range");
  const hasLong = drawings.some((d) => d.type === "long");

  // Dapatkan lilin terakhir sebagai default apabila kursor tidak berada di atas carta
  const latestCandle = useMemo(() => {
    if (!data?.ohlcv || data.ohlcv.length === 0) return null;
    const last = data.ohlcv[data.ohlcv.length - 1];
    const open = Number(last.open);
    const close = Number(last.close);
    const change = open !== 0 ? ((close - open) / open) * 100 : 0;
    return {
      time: formatDisplayDate(last.time),
      open,
      high: Number(last.high),
      low: Number(last.low),
      close,
      change,
      diff: close - open,
      volume: Number(last.volume || 0),
    };
  }, [data?.ohlcv]);

  const activeBarDisplay = hoverData || latestCandle;

  // 1. Lukis Semula Canvas Overlay (Retina HD)
  const redrawCanvas = useCallback(() => {
    if (mini) return;
    const canvas = canvasRef.current;
    const chart = chartRef.current;
    const series = mainSeriesRef.current;
    if (!canvas || !chart || !series) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (width === 0 || height === 0) return;

    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const timeScale = chart.timeScale();

    const drawItem = (d: DrawingItem) => {
      // --- LUKISAN LONG POSITION ---
      if (d.type === "long") {
        const rawX1 = timeScale.timeToCoordinate(d.entryTime as any);
        const rawX2 = timeScale.timeToCoordinate(d.endTime as any) ?? (rawX1 !== null ? rawX1 + 110 : null);
        const rawYEntry = series.priceToCoordinate(d.entryPrice);
        const rawYTp = series.priceToCoordinate(d.tpPrice);
        const rawYSl = series.priceToCoordinate(d.slPrice);

        if (rawX1 === null || rawYEntry === null || rawYTp === null || rawYSl === null) return;

        const x1 = Math.round(rawX1);
        const x2 = Math.round(rawX2 ?? rawX1 + 110);
        const yEntry = Math.round(rawYEntry);
        const yTp = Math.round(rawYTp);
        const ySl = Math.round(rawYSl);

        const boxWidth = Math.max(80, x2 - x1);
        const midX = Math.round(x1 + boxWidth / 2);

        // Zon TP
        ctx.fillStyle = "rgba(38, 166, 154, 0.22)";
        ctx.fillRect(x1, yTp, boxWidth, yEntry - yTp);
        ctx.strokeStyle = "#26A69A";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x1 + 0.5, yTp + 0.5, boxWidth, yEntry - yTp);

        // Zon SL
        ctx.fillStyle = "rgba(239, 83, 80, 0.22)";
        ctx.fillRect(x1, yEntry, boxWidth, ySl - yEntry);
        ctx.strokeStyle = "#EF5350";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x1 + 0.5, yEntry + 0.5, boxWidth, ySl - yEntry);

        // Garisan Entry
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(x1, yEntry + 0.5);
        ctx.lineTo(x1 + boxWidth, yEntry + 0.5);
        ctx.stroke();
        ctx.setLineDash([]);

        // Titik Pemegang TP
        ctx.fillStyle = "#26A69A";
        ctx.beginPath();
        ctx.arc(midX, yTp, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Titik Pemegang SL
        ctx.fillStyle = "#EF5350";
        ctx.beginPath();
        ctx.arc(midX, ySl, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const tpPct = (((d.tpPrice - d.entryPrice) / d.entryPrice) * 100).toFixed(2);
        const slPct = (((d.entryPrice - d.slPrice) / d.entryPrice) * 100).toFixed(2);
        const risk = Math.abs(d.entryPrice - d.slPrice);
        const reward = Math.abs(d.tpPrice - d.entryPrice);
        const rr = risk > 0 ? (reward / risk).toFixed(2) : "0.00";

        ctx.fillStyle = theme === "dark" ? "#FFFFFF" : "#111827";
        ctx.font = "bold 9px monospace";
        ctx.fillText(`Target: +${tpPct}% (${d.tpPrice.toFixed(2)})`, x1 + 6, yTp + 12);
        ctx.fillText(`R:R = ${rr} | Entry: ${d.entryPrice.toFixed(2)}`, x1 + 6, yEntry - 3);
        ctx.fillText(`Stop: -${slPct}% (${d.slPrice.toFixed(2)})`, x1 + 6, ySl - 3);
      }

      // --- LUKISAN PRICE & DATE RANGE ---
      if (d.type === "range") {
        const rawX1 = timeScale.timeToCoordinate(d.startTime as any);
        const rawX2 = timeScale.timeToCoordinate(d.endTime as any);
        const rawY1 = series.priceToCoordinate(d.startPrice);
        const rawY2 = series.priceToCoordinate(d.endPrice);

        if (rawX1 === null || rawX2 === null || rawY1 === null || rawY2 === null) return;

        const x1 = Math.round(rawX1);
        const x2 = Math.round(rawX2);
        const y1 = Math.round(rawY1);
        const y2 = Math.round(rawY2);

        const left = Math.min(x1, x2);
        const top = Math.min(y1, y2);
        const boxW = Math.abs(x2 - x1);
        const boxH = Math.abs(y2 - y1);
        const priceDiff = d.endPrice - d.startPrice;
        const isUp = priceDiff >= 0;

        ctx.fillStyle = isUp ? "rgba(38, 166, 154, 0.18)" : "rgba(239, 83, 80, 0.18)";
        ctx.fillRect(left, top, boxW, boxH);

        ctx.strokeStyle = isUp ? "#26A69A" : "#EF5350";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(left + 0.5, top + 0.5, boxW, boxH);
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.strokeStyle = isUp ? "rgba(38, 166, 154, 0.7)" : "rgba(239, 83, 80, 0.7)";
        ctx.moveTo(x1 + 0.5, y1 + 0.5);
        ctx.lineTo(x2 + 0.5, y2 + 0.5);
        ctx.stroke();

        // Pin P1
        ctx.fillStyle = "#38BDF8";
        ctx.beginPath();
        ctx.arc(x1, y1, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Pin P2
        ctx.fillStyle = isUp ? "#26A69A" : "#EF5350";
        ctx.beginPath();
        ctx.arc(x2, y2, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Lencana Maklumat Peratus & Hari
        const pct = ((priceDiff / d.startPrice) * 100).toFixed(2);
        const label = `${isUp ? "+" : ""}${priceDiff.toFixed(2)} (${pct}%) | ${d.barsCount}D`;

        ctx.font = "bold 9.5px monospace";
        const textWidth = ctx.measureText(label).width;
        const badgeX = Math.round(left + boxW / 2 - textWidth / 2 - 6);
        const badgeY = top - 24 < 0 ? top + boxH + 6 : top - 24;

        ctx.fillStyle = isUp ? "#26A69A" : "#EF5350";
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, textWidth + 12, 18, 4);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.fillText(label, badgeX + 6, badgeY + 12);
      }
    };

    drawingsRef.current.forEach(drawItem);

    if (rangeStart && rangeCurrent) {
      drawItem({
        id: "preview_range",
        type: "range",
        startTime: rangeStart.barIdx <= rangeCurrent.barIdx ? rangeStart.timeStr : rangeCurrent.timeStr,
        startPrice: rangeStart.price,
        endTime: rangeStart.barIdx <= rangeCurrent.barIdx ? rangeCurrent.timeStr : rangeStart.timeStr,
        endPrice: rangeCurrent.price,
        barsCount: Math.abs(rangeCurrent.barIdx - rangeStart.barIdx) + 1,
      });
    }
  }, [rangeStart, rangeCurrent, theme, mini]);

  const redrawCanvasRef = useRef(redrawCanvas);
  redrawCanvasRef.current = redrawCanvas;

  useEffect(() => {
    redrawCanvas();
  }, [drawings, rangeStart, rangeCurrent, redrawCanvas]);

  // 2. Inisialisasi & Pengurusan Carta Lightweight Charts
  useEffect(() => {
    if (!containerRef.current || !data?.ohlcv?.length) return;

    let destroyed = false;

    import("lightweight-charts").then(
      ({
        createChart,
        ColorType,
        CrosshairMode,
        CandlestickSeries,
        LineSeries,
        HistogramSeries,
      }) => {
        if (destroyed || !containerRef.current) return;

        chartRef.current?.remove();

        const container = containerRef.current;
        const initialWidth = container.clientWidth || 300;
        const initialHeight = container.clientHeight || (mini ? 200 : 340);

        const chart = createChart(container, {
          width: initialWidth,
          height: initialHeight,
          layout: {
            background: { type: ColorType.Solid, color: C.bg },
            textColor: C.text,
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: mini ? 9 : 10,
          },
          grid: {
            vertLines: { color: C.grid },
            horzLines: { color: C.grid },
          },
          crosshair: { mode: CrosshairMode.Normal },
          rightPriceScale: {
            borderColor: C.grid,
            autoScale: true,
            scaleMargins: {
              top: 0.08,
              bottom: config?.showVolume ? 0.20 : 0.08,
            },
          },
          timeScale: {
            visible: true,
            timeVisible: true,
            secondsVisible: false,
            borderColor: C.grid,
            fixLeftEdge: true,
            fixRightEdge: true,
          },
        });

        chartRef.current = chart;

        const candle = chart.addSeries(CandlestickSeries, {
          upColor: C.up,
          downColor: C.down,
          borderUpColor: C.up,
          borderDownColor: C.down,
          wickUpColor: C.up,
          wickDownColor: C.down,
        });
        mainSeriesRef.current = candle;

        const times = data.ohlcv.map((b) => formatLwcTime(b.time));

        candle.setData(
          data.ohlcv.map((b) => ({
            time: formatLwcTime(b.time) as any,
            open: Number(b.open),
            high: Number(b.high),
            low: Number(b.low),
            close: Number(b.close),
          }))
        );

        if (config?.showVolume) {
          const volSeries = chart.addSeries(HistogramSeries, {
            priceFormat: { type: "volume" },
            priceScaleId: "vol",
            lastValueVisible: false,
            priceLineVisible: false,
          });
          chart.priceScale("vol").applyOptions({
            scaleMargins: { top: 0.80, bottom: 0 },
            borderVisible: false,
          });
          volSeries.setData(
            data.ohlcv.map((b) => ({
              time: formatLwcTime(b.time) as any,
              value: Number(b.volume || 0),
              color: Number(b.close) >= Number(b.open) ? `${C.up}66` : `${C.down}66`,
            }))
          );
          volSeriesRef.current = volSeries;
        } else {
          volSeriesRef.current = null;
        }

        if (data.indicators?.ema && config?.emaPeriods) {
          config.emaPeriods.forEach((period, idx) => {
            const values = (data.indicators?.ema as any)?.[String(period)];
            if (!values || !Array.isArray(values)) return;

            const points = values
              .map((v, i) =>
                v !== null && v !== undefined && !isNaN(v)
                  ? { time: times[i] as any, value: Number(v) }
                  : null
              )
              .filter(Boolean) as any[];

            if (!points.length) return;
            const s = chart.addSeries(LineSeries, {
              color: EMA_COLORS[idx % EMA_COLORS.length],
              lineWidth: 1,
              priceLineVisible: false,
              lastValueVisible: false,
            });
            s.setData(points);
          });
        }

        if (!mini && config?.showRsi && data.indicators?.rsi) {
          const rsiPoints = data.indicators.rsi
            .map((v, i) => (v !== null ? { time: times[i] as any, value: Number(v) } : null))
            .filter(Boolean) as any[];

          if (rsiPoints.length) {
            const rsiPane = chart.addPane();
            const rsiSeries = rsiPane.addSeries(LineSeries, {
              color: C.rsi,
              lineWidth: 1,
              priceLineVisible: false,
              lastValueVisible: true,
            });
            rsiSeries.setData(rsiPoints);

            [70, 30].forEach((lvl) => {
              const line = rsiPane.addSeries(LineSeries, {
                color: C.level,
                lineWidth: 1,
                lineStyle: 2,
                priceLineVisible: false,
                lastValueVisible: false,
              });
              line.setData(rsiPoints.map((p) => ({ time: p.time, value: lvl })));
            });
          }
        }

        if (!mini && config?.showMacd && data.indicators?.macd) {
          const macdPoints = data.indicators.macd
            .map((v, i) => (v !== null ? { time: times[i] as any, value: Number(v) } : null))
            .filter(Boolean) as any[];
          const sigPoints = (data.indicators.macd_signal || [])
            .map((v, i) => (v !== null ? { time: times[i] as any, value: Number(v) } : null))
            .filter(Boolean) as any[];
          const histPoints = (data.indicators.macd_histogram || [])
            .map((v, i) =>
              v !== null
                ? { time: times[i] as any, value: Number(v), color: Number(v) >= 0 ? C.up : C.down }
                : null
            )
            .filter(Boolean) as any[];

          if (macdPoints.length) {
            const macdPane = chart.addPane();
            if (histPoints.length) {
              const h = macdPane.addSeries(HistogramSeries, {
                priceLineVisible: false,
                lastValueVisible: false,
              });
              h.setData(histPoints);
            }
            const m = macdPane.addSeries(LineSeries, {
              color: C.macd,
              lineWidth: 1,
              priceLineVisible: false,
              lastValueVisible: true,
            });
            m.setData(macdPoints);

            if (sigPoints.length) {
              const s = macdPane.addSeries(LineSeries, {
                color: C.macdSignal,
                lineWidth: 1,
                priceLineVisible: false,
                lastValueVisible: true,
              });
              s.setData(sigPoints);
            }
          }
        }

        chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
          redrawCanvasRef.current();
        });

        // Pantau Pergerakan Crosshair
        chart.subscribeCrosshairMove((param: any) => {
          redrawCanvasRef.current();
          if (!param || !param.time || !param.seriesData) {
            setHoverData(null);
            return;
          }

          const priceData = param.seriesData.get(mainSeriesRef.current);
          if (priceData && priceData.open !== undefined) {
            const volData = volSeriesRef.current ? param.seriesData.get(volSeriesRef.current) : null;
            const open = Number(priceData.open);
            const high = Number(priceData.high);
            const low = Number(priceData.low);
            const close = Number(priceData.close);
            const change = open !== 0 ? ((close - open) / open) * 100 : 0;
            const diff = close - open;
            const volume = volData?.value !== undefined ? Number(volData.value) : null;

            setHoverData({
              time: formatDisplayDate(param.time),
              open,
              high,
              low,
              close,
              change,
              diff,
              volume,
            });
          } else {
            setHoverData(null);
          }
        });

        if (ticker !== lastTickerRef.current && data.ohlcv.length > 0) {
          lastTickerRef.current = ticker;
          const totalBars = data.ohlcv.length;
          chart.timeScale().setVisibleLogicalRange({
            from: Math.max(0, totalBars - 100),
            to: totalBars - 1,
          });
        } else {
          chart.timeScale().fitContent();
        }

        redrawCanvasRef.current();

        // ResizeObserver: Kunci utama agar X-Axis sentiasa kelihatan tanpa terpotong
        const resizeObserver = new ResizeObserver((entries) => {
          if (!entries || entries.length === 0 || !chartRef.current) return;
          const { width, height } = entries[0].contentRect;
          if (width > 0 && height > 0) {
            chartRef.current.applyOptions({ width, height });
            redrawCanvasRef.current();
          }
        });

        resizeObserver.observe(container);

        return () => {
          resizeObserver.disconnect();
        };
      }
    );

    return () => {
      destroyed = true;
      chartRef.current?.remove();
      chartRef.current = null;
    };
  }, [data, config, mini, theme, ticker]);

  // 3. Helper Penukaran Koordinat
  const getCoordinatesRaw = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const chart = chartRef.current;
    const series = mainSeriesRef.current;
    if (!canvas || !chart || !series) return null;

    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const price = series.coordinateToPrice(y);
    const logical = chart.timeScale().coordinateToLogical(x);

    if (price === null || logical === null) return null;

    const bars = data.ohlcv;
    const barIdx = Math.min(Math.max(0, Math.floor(logical)), bars.length - 1);
    const timeStr = formatLwcTime(bars[barIdx]?.time);

    return { x, y, price: Number(price.toFixed(3)), timeStr, barIdx };
  };

  // 4. Hit-Testing: Mengesan Kedudukan Handles
  const findHandleAt = useCallback((clientX: number, clientY: number): DragHandleTarget | null => {
    const canvas = canvasRef.current;
    const chart = chartRef.current;
    const series = mainSeriesRef.current;
    if (!canvas || !chart || !series) return null;

    const rect = canvas.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;
    const timeScale = chart.timeScale();
    const hitRadius = 14;

    for (const d of drawingsRef.current) {
      if (d.type === "long") {
        const x1 = timeScale.timeToCoordinate(d.entryTime as any);
        const x2 = timeScale.timeToCoordinate(d.endTime as any) ?? (x1 !== null ? x1 + 110 : null);
        const yTp = series.priceToCoordinate(d.tpPrice);
        const ySl = series.priceToCoordinate(d.slPrice);

        if (x1 !== null && x2 !== null && yTp !== null && ySl !== null) {
          const midX = x1 + Math.max(80, x2 - x1) / 2;
          if (Math.hypot(mouseX - midX, mouseY - yTp) <= hitRadius) {
            return { type: "long", id: d.id, handle: "tp" };
          }
          if (Math.hypot(mouseX - midX, mouseY - ySl) <= hitRadius) {
            return { type: "long", id: d.id, handle: "sl" };
          }
        }
      }

      if (d.type === "range") {
        const x1 = timeScale.timeToCoordinate(d.startTime as any);
        const x2 = timeScale.timeToCoordinate(d.endTime as any);
        const y1 = series.priceToCoordinate(d.startPrice);
        const y2 = series.priceToCoordinate(d.endPrice);

        if (x1 !== null && x2 !== null && y1 !== null && y2 !== null) {
          if (Math.hypot(mouseX - x1, mouseY - y1) <= hitRadius) {
            return { type: "range", id: d.id, handle: "p1" };
          }
          if (Math.hypot(mouseX - x2, mouseY - y2) <= hitRadius) {
            return { type: "range", id: d.id, handle: "p2" };
          }
        }
      }
    }
    return null;
  }, []);

  // 5. Pengendali Input Mouse/Touch
  const handlePointerDown = (clientX: number, clientY: number) => {
    if (mini) return;

    const target = findHandleAt(clientX, clientY);
    if (target) {
      setDraggingHandle(target);
      return;
    }

    const coord = getCoordinatesRaw(clientX, clientY);
    if (!coord) return;

    if (activeTool === "range" && !hasRange) {
      if (!rangeStart) {
        setRangeStart(coord);
        setRangeCurrent(coord);
      } else {
        const barsCount = Math.abs(coord.barIdx - rangeStart.barIdx) + 1;
        const isStartFirst = rangeStart.barIdx <= coord.barIdx;

        setDrawings((prev) => [
          ...prev,
          {
            id: `range_${Date.now()}`,
            type: "range",
            startTime: isStartFirst ? rangeStart.timeStr : coord.timeStr,
            startPrice: rangeStart.price,
            endTime: isStartFirst ? coord.timeStr : rangeStart.timeStr,
            endPrice: coord.price,
            barsCount,
          },
        ]);
        setRangeStart(null);
        setRangeCurrent(null);
        setActiveTool("none");
      }
      return;
    }

    if (activeTool === "long" && !hasLong) {
      const bars = data.ohlcv;
      const futureBar = bars[Math.min(bars.length - 1, coord.barIdx + 20)];
      const entryP = coord.price;

      setDrawings((prev) => [
        ...prev,
        {
          id: `long_${Date.now()}`,
          type: "long",
          entryTime: coord.timeStr,
          entryPrice: entryP,
          tpPrice: Number((entryP * 1.06).toFixed(3)),
          slPrice: Number((entryP * 0.98).toFixed(3)),
          endTime: formatLwcTime(futureBar?.time ?? coord.timeStr),
        },
      ]);
      setActiveTool("none");
    }
  };

  const handlePointerMove = useCallback((clientX: number, clientY: number) => {
    if (mini) return;

    if (!draggingHandle && activeTool === "none") {
      const hit = findHandleAt(clientX, clientY);
      setHoveredHandle(hit);
    }

    const coord = getCoordinatesRaw(clientX, clientY);
    if (!coord) return;

    if (draggingHandle) {
      setDrawings((prev) =>
        prev.map((d) => {
          if (d.id === draggingHandle.id) {
            if (d.type === "long" && draggingHandle.type === "long") {
              if (draggingHandle.handle === "tp") {
                return { ...d, tpPrice: Math.max(d.entryPrice + 0.001, coord.price) };
              }
              if (draggingHandle.handle === "sl") {
                return { ...d, slPrice: Math.min(d.entryPrice - 0.001, coord.price) };
              }
            }
            if (d.type === "range" && draggingHandle.type === "range") {
              if (draggingHandle.handle === "p1") {
                const endIdx = data.ohlcv.findIndex((b) => formatLwcTime(b.time) === d.endTime);
                return {
                  ...d,
                  startTime: coord.timeStr,
                  startPrice: coord.price,
                  barsCount: Math.abs(coord.barIdx - (endIdx >= 0 ? endIdx : coord.barIdx)) + 1,
                };
              }
              if (draggingHandle.handle === "p2") {
                const startIdx = data.ohlcv.findIndex((b) => formatLwcTime(b.time) === d.startTime);
                return {
                  ...d,
                  endTime: coord.timeStr,
                  endPrice: coord.price,
                  barsCount: Math.abs(coord.barIdx - (startIdx >= 0 ? startIdx : coord.barIdx)) + 1,
                };
              }
            }
          }
          return d;
        })
      );
      redrawCanvasRef.current();
      return;
    }

    if (rangeStart && activeTool === "range") {
      setRangeCurrent(coord);
    }
  }, [draggingHandle, activeTool, rangeStart, mini, data.ohlcv, findHandleAt]);

  useEffect(() => {
    if (!draggingHandle) return;

    const onGlobalMove = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      handlePointerMove(clientX, clientY);
    };

    const onGlobalUp = () => {
      setDraggingHandle(null);
    };

    window.addEventListener("mousemove", onGlobalMove);
    window.addEventListener("mouseup", onGlobalUp);
    window.addEventListener("touchmove", onGlobalMove);
    window.addEventListener("touchend", onGlobalUp);

    return () => {
      window.removeEventListener("mousemove", onGlobalMove);
      window.removeEventListener("mouseup", onGlobalUp);
      window.removeEventListener("touchmove", onGlobalMove);
      window.removeEventListener("touchend", onGlobalUp);
    };
  }, [draggingHandle, handlePointerMove]);

  return (
    <div className="flex flex-col h-full w-full select-none overflow-hidden relative">
      {!mini && (
        /* ------------------------------------------------------------- */
        /* TOOLBAR 1-BARIS PADAT & RESPONSIF                             */
        /* ------------------------------------------------------------- */
        <div className="shrink-0 flex items-center justify-between px-2 py-1 bg-gray-50/90 dark:bg-[#131924] border-b border-gray-200 dark:border-gray-800/80 text-[10px] gap-1.5 select-none min-h-[28px] overflow-hidden">
          {/* BAHAGIAN KIRI: BUTANG ALATAN */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Pointer */}
            <button
              type="button"
              onClick={() => {
                setActiveTool("none");
                setRangeStart(null);
                setRangeCurrent(null);
              }}
              className={`px-1.5 py-0.5 rounded transition flex items-center gap-1 text-[9.5px] ${
                activeTool === "none"
                  ? "bg-gray-200 dark:bg-gray-700/80 font-bold text-gray-900 dark:text-gray-100 shadow-xs"
                  : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
              title="Pointer Mode"
            >
              <svg className="w-3 h-3 text-teal-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="m3 3 7 18 3-7 7-3L3 3z" />
              </svg>
              <span className="hidden xl:inline">Pointer</span>
            </button>

            {/* Range Tool */}
            <button
              type="button"
              disabled={hasRange}
              onClick={() => {
                if (hasRange) return;
                setActiveTool("range");
                setRangeStart(null);
                setRangeCurrent(null);
              }}
              className={`px-1.5 py-0.5 rounded transition flex items-center gap-1 text-[9.5px] ${
                hasRange
                  ? "opacity-40 cursor-not-allowed bg-gray-100 dark:bg-gray-800 text-gray-400"
                  : activeTool === "range"
                  ? "bg-sky-500/20 text-sky-400 border border-sky-500/40 font-bold"
                  : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
              title={hasRange ? "Range tool aktif" : "Ukur harga dan masa"}
            >
              <svg className="w-3 h-3 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.3 8.7 8.7 21.3c-1 1-2.5 1-3.4 0l-2.6-2.6c-1-1-1-2.5 0-3.4L15.3 2.7c1-1 2.5-1 3.4 0l2.6 2.6c1 1 1 2.4 0 3.4Z" />
                <path d="m7.5 10.5 2 2" />
                <path d="m10.5 7.5 2 2" />
                <path d="m13.5 4.5 2 2" />
              </svg>
              <span className="hidden xl:inline">Range{hasRange ? " (✓)" : rangeStart ? " (P2)" : ""}</span>
            </button>

            {/* Long Tool */}
            <button
              type="button"
              disabled={hasLong}
              onClick={() => {
                if (hasLong) return;
                setActiveTool("long");
              }}
              className={`px-1.5 py-0.5 rounded transition flex items-center gap-1 text-[9.5px] ${
                hasLong
                  ? "opacity-40 cursor-not-allowed bg-gray-100 dark:bg-gray-800 text-gray-400"
                  : activeTool === "long"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold"
                  : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
              title={hasLong ? "Posisi Long aktif" : "Letak posisi TP/SL"}
            >
              <svg className="w-3 h-3 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
              <span className="hidden xl:inline">Long{hasLong ? " (✓)" : ""}</span>
            </button>

            {/* Butang Padam */}
            {hasRange && (
              <button
                type="button"
                onClick={() => {
                  setDrawings((prev) => prev.filter((d) => d.type !== "range"));
                  redrawCanvas();
                }}
                className="text-sky-400 hover:text-sky-300 px-1 py-0.5 rounded bg-sky-500/10 hover:bg-sky-500/20 transition text-[9px]"
                title="Padam Range"
              >
                ✕ Range
              </button>
            )}

            {hasLong && (
              <button
                type="button"
                onClick={() => {
                  setDrawings((prev) => prev.filter((d) => d.type !== "long"));
                  redrawCanvas();
                }}
                className="text-emerald-400 hover:text-emerald-300 px-1 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 transition text-[9px]"
                title="Padam Long"
              >
                ✕ Long
              </button>
            )}

            {drawings.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setDrawings([]);
                  redrawCanvas();
                }}
                className="text-rose-400 hover:text-rose-300 px-1 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500/20 transition text-[9px]"
                title="Padam Semua Lukisan"
              >
                ✕ Clear
              </button>
            )}
          </div>

          {/* BAHAGIAN KANAN: LIVE DATA OHLCV */}
          {activeBarDisplay && (
            <div className="flex items-center gap-1.5 text-[9px] sm:text-[9.5px] font-mono shrink-0 ml-auto pl-1.5 border-l border-gray-200 dark:border-gray-800">
              <span className="text-gray-500 hidden 2xl:inline">{activeBarDisplay.time}</span>

              <div className="flex items-center gap-1.5 text-gray-400">
                <span className="hidden sm:inline">
                  O:<span className="text-gray-700 dark:text-gray-200 ml-0.5">{activeBarDisplay.open.toFixed(2)}</span>
                </span>
                <span className="hidden sm:inline">
                  H:<span className="text-gray-700 dark:text-gray-200 ml-0.5">{activeBarDisplay.high.toFixed(2)}</span>
                </span>
                <span className="hidden sm:inline">
                  L:<span className="text-gray-700 dark:text-gray-200 ml-0.5">{activeBarDisplay.low.toFixed(2)}</span>
                </span>
                <span>
                  C:<span className="text-gray-900 dark:text-gray-100 font-semibold ml-0.5">{activeBarDisplay.close.toFixed(2)}</span>
                </span>
              </div>

              <span
                className={`font-bold px-1 rounded ${
                  activeBarDisplay.change >= 0
                    ? "text-emerald-500 bg-emerald-500/10"
                    : "text-rose-500 bg-rose-500/10"
                }`}
              >
                {activeBarDisplay.change >= 0
                  ? `+${activeBarDisplay.change.toFixed(2)}%`
                  : `${activeBarDisplay.change.toFixed(2)}%`}
              </span>

              {activeBarDisplay.volume !== null && (
                <span className="text-gray-500 hidden xl:inline">
                  V:<span className="text-sky-500 ml-0.5">{formatVolume(activeBarDisplay.volume)}</span>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* BEKAS CARTA & KANVAS PINTAR (Flex-1 & Min-h-0 Mengisi Ruang Secara Tepat) */}
      <div
        ref={containerRef}
        onWheel={() => redrawCanvasRef.current()}
        onMouseMove={(e) => {
          if (!draggingHandle && activeTool === "none") {
            const hit = findHandleAt(e.clientX, e.clientY);
            setHoveredHandle(hit);
          }
        }}
        onMouseLeave={() => setHoverData(null)}
        onTouchStart={(e) => {
          if (e.touches.length === 1) {
            const t = e.touches[0];
            const hit = findHandleAt(t.clientX, t.clientY);
            if (hit) {
              setDraggingHandle(hit);
            } else if (activeTool !== "none") {
              handlePointerDown(t.clientX, t.clientY);
            }
          }
        }}
        className="relative flex-1 min-h-0 w-full overflow-hidden"
      >
        {!mini && (
          <canvas
            ref={canvasRef}
            onMouseDown={(e) => {
              if (e.button === 0) handlePointerDown(e.clientX, e.clientY);
            }}
            onMouseMove={(e) => handlePointerMove(e.clientX, e.clientY)}
            className={`absolute inset-0 w-full h-full z-10 touch-none ${
              activeTool !== "none"
                ? "cursor-crosshair pointer-events-auto"
                : draggingHandle !== null || hoveredHandle !== null
                ? "cursor-grab active:cursor-grabbing pointer-events-auto"
                : "pointer-events-none"
            }`}
          />
        )}
      </div>
    </div>
  );
});