"use client";

import { useEffect, useRef, useState, useCallback, memo } from "react";
import type { ChartData, SidebarParams } from "@/lib/types";

// Helper Penukar Format Tarikh Paparan (DD/MM/YYYY)
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

// Helper Format Standard Masa Lightweight Charts (YYYY-MM-DD)
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
    bg: "#111827",
    grid: "#1F2937",
    text: "#D1D5DB",
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

interface Props {
  data: ChartData;
  config: SidebarParams["chartConfig"];
  ticker: string;
  mini?: boolean;
  theme?: "light" | "dark";
}

export const StockChart = memo(function StockChart({
  data,
  config,
  ticker,
  mini = false,
  theme = "dark",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);
  const mainSeriesRef = useRef<any>(null);
  const lastTickerRef = useRef<string>("");

  const [activeTool, setActiveTool] = useState<DrawingTool>("none");
  const [drawings, setDrawings] = useState<DrawingItem[]>([]);

  // State Ukuran
  const [rangeStart, setRangeStart] = useState<{ x: number; y: number; price: number; timeStr: string; barIdx: number } | null>(null);
  const [rangeCurrent, setRangeCurrent] = useState<{ x: number; y: number; price: number; timeStr: string; barIdx: number } | null>(null);

  // State Interaktif Drag Handle (Long TP/SL & Range P1/P2)
  const [draggingTarget, setDraggingTarget] = useState<DragHandleTarget | null>(null);
  const [hoveredTarget, setHoveredTarget] = useState<DragHandleTarget | null>(null);

  const C = COLOR_PALETTES[theme];
  const drawingsRef = useRef<DrawingItem[]>(drawings);
  drawingsRef.current = drawings;

  // 1. Fungsi Melukis Semula Canvas Overlay (HD Retina + Penyelarasan Penuh X & Y)
  const redrawCanvas = useCallback(() => {
    if (mini) return;
    const canvas = canvasRef.current;
    const chart = chartRef.current;
    const series = mainSeriesRef.current;
    if (!canvas || !chart || !series) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Sokongan High-DPI / Retina (Tajam & Bebas Pecah)
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;

    if (displayWidth === 0 || displayHeight === 0) return;

    canvas.width = Math.round(displayWidth * dpr);
    canvas.height = Math.round(displayHeight * dpr);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const timeScale = chart.timeScale();

    const drawItem = (d: DrawingItem) => {
      // --- LUKISAN LONG POSITION ---
      if (d.type === "long") {
        const x1 = timeScale.timeToCoordinate(d.entryTime as any);
        const x2 = timeScale.timeToCoordinate(d.endTime as any) ?? (x1 !== null ? x1 + 110 : null);
        const yEntry = series.priceToCoordinate(d.entryPrice);
        const yTp = series.priceToCoordinate(d.tpPrice);
        const ySl = series.priceToCoordinate(d.slPrice);

        if (x1 === null || yEntry === null || yTp === null || ySl === null) return;

        const boxWidth = Math.max(80, (x2 ?? x1 + 110) - x1);
        const midX = x1 + boxWidth / 2;

        // Zon Sasaran Ambil Untung (TP)
        ctx.fillStyle = "rgba(38, 166, 154, 0.22)";
        ctx.fillRect(x1, yTp, boxWidth, yEntry - yTp);
        ctx.strokeStyle = "#26A69A";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x1, yTp, boxWidth, yEntry - yTp);

        // Zon Henti Rugi (SL)
        ctx.fillStyle = "rgba(239, 83, 80, 0.22)";
        ctx.fillRect(x1, yEntry, boxWidth, ySl - yEntry);
        ctx.strokeStyle = "#EF5350";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x1, yEntry, boxWidth, ySl - yEntry);

        // Garisan Harga Masuk (Entry)
        ctx.strokeStyle = "#94a3b8";
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(x1, yEntry);
        ctx.lineTo(x1 + boxWidth, yEntry);
        ctx.stroke();
        ctx.setLineDash([]);

        // Pemegang TP (Boleh Ditarik)
        ctx.fillStyle = "#26A69A";
        ctx.beginPath();
        ctx.arc(midX, yTp, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Pemegang SL (Boleh Ditarik)
        ctx.fillStyle = "#EF5350";
        ctx.beginPath();
        ctx.arc(midX, ySl, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();

        const tpPct = (((d.tpPrice - d.entryPrice) / d.entryPrice) * 100).toFixed(2);
        const slPct = (((d.entryPrice - d.slPrice) / d.entryPrice) * 100).toFixed(2);
        const risk = Math.abs(d.entryPrice - d.slPrice);
        const reward = Math.abs(d.tpPrice - d.entryPrice);
        const rr = risk > 0 ? (reward / risk).toFixed(2) : "0.00";

        ctx.fillStyle = theme === "dark" ? "#FFFFFF" : "#111827";
        ctx.font = "bold 10px monospace";
        ctx.fillText(`Target: +${tpPct}% (RM${d.tpPrice.toFixed(3)})`, x1 + 6, yTp + 14);
        ctx.fillText(`R:R = ${rr} | Entry: RM${d.entryPrice.toFixed(3)}`, x1 + 6, yEntry - 4);
        ctx.fillText(`Stop: -${slPct}% (${d.slPrice.toFixed(3)})`, x1 + 6, ySl - 4);
      }

      // --- LUKISAN PRICE & DATE RANGE TOOL ---
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
        const priceDiff = d.endPrice - d.startPrice;
        const isUp = priceDiff >= 0;

        ctx.fillStyle = isUp ? "rgba(38, 166, 154, 0.18)" : "rgba(239, 83, 80, 0.18)";
        ctx.fillRect(left, top, width, height);

        ctx.strokeStyle = isUp ? "#26A69A" : "#EF5350";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(left, top, width, height);
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.strokeStyle = isUp ? "rgba(38, 166, 154, 0.6)" : "rgba(239, 83, 80, 0.6)";
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // Pin P1 (Boleh Ditarik untuk Ubah Titik Mula)
        ctx.fillStyle = "#38BDF8";
        ctx.beginPath();
        ctx.arc(x1, y1, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const p1Text = `P1: ${formatDisplayDate(d.startTime)}, RM${d.startPrice.toFixed(3)}`;
        ctx.font = "bold 9px monospace";
        const p1Width = ctx.measureText(p1Text).width;
        ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
        ctx.fillRect(x1 - p1Width / 2 - 4, y1 - 20, p1Width + 8, 15);
        ctx.fillStyle = "#38BDF8";
        ctx.fillText(p1Text, x1 - p1Width / 2, y1 - 9);

        // Pin P2 (Boleh Ditarik untuk Ubah Titik Akhir)
        ctx.fillStyle = isUp ? "#26A69A" : "#EF5350";
        ctx.beginPath();
        ctx.arc(x2, y2, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const p2Text = `P2: ${formatDisplayDate(d.endTime)}, RM${d.endPrice.toFixed(3)}`;
        const p2Width = ctx.measureText(p2Text).width;
        ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
        ctx.fillRect(x2 - p2Width / 2 - 4, y2 + 8, p2Width + 8, 15);
        ctx.fillStyle = isUp ? "#34D399" : "#F87171";
        ctx.fillText(p2Text, x2 - p2Width / 2, y2 + 19);

        // Lencana Maklumat Peratusan & Tempoh
        const pct = ((priceDiff / d.startPrice) * 100).toFixed(2);
        const label = `${isUp ? "+" : ""}${priceDiff.toFixed(3)} (${pct}%) | ${d.barsCount} Hari`;

        ctx.font = "bold 10px monospace";
        const textWidth = ctx.measureText(label).width;
        const badgeX = left + width / 2 - textWidth / 2 - 6;
        const badgeY = top - 24 < 0 ? top + height + 6 : top - 24;

        ctx.fillStyle = isUp ? "#26A69A" : "#EF5350";
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, textWidth + 12, 18, 4);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.fillText(label, badgeX + 6, badgeY + 13);
      }
    };

    drawingsRef.current.forEach(drawItem);

    // Pratonton Langsung semasa drag ukuran
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

  // 2. Inisialisasi Carta TradingView
  useEffect(() => {
    if (!containerRef.current || !data.ohlcv?.length) return;

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

        const chart = createChart(containerRef.current!, {
          layout: {
            background: { type: ColorType.Solid, color: C.bg },
            textColor: C.text,
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: mini ? 9 : 11,
          },
          grid: {
            vertLines: { color: C.grid },
            horzLines: { color: C.grid },
          },
          crosshair: { mode: CrosshairMode.Normal },
          rightPriceScale: { borderColor: C.grid, autoScale: true },
          timeScale: { borderColor: C.grid, timeVisible: !mini },
          autoSize: true,
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

        // Volum
        if (config.showVolume) {
          const volSeries = chart.addSeries(HistogramSeries, {
            priceFormat: { type: "volume" },
            priceScaleId: "vol",
            lastValueVisible: false,
            priceLineVisible: false,
          });
          chart.priceScale("vol").applyOptions({
            scaleMargins: { top: 0.8, bottom: 0 },
            borderVisible: false,
          });
          volSeries.setData(
            data.ohlcv.map((b) => ({
              time: formatLwcTime(b.time) as any,
              value: Number(b.volume || 0),
              color: Number(b.close) >= Number(b.open) ? `${C.up}99` : `${C.down}99`,
            }))
          );
        }

        // EMA Indikator
        if (data.indicators?.ema) {
          Object.entries(data.indicators.ema).forEach(([period, values], idx) => {
            const points = values
              .map((v, i) =>
                v !== null ? { time: times[i] as any, value: Number(v) } : null
              )
              .filter(Boolean) as any[];

            if (!points.length) return;
            const s = chart.addSeries(LineSeries, {
              color: EMA_COLORS[idx % EMA_COLORS.length],
              lineWidth: 1,
              title: "",
              priceLineVisible: false,
              lastValueVisible: false,
            });
            s.setData(points);
          });
        }

        // RSI
        if (!mini && config.showRsi && data.indicators?.rsi) {
          const rsiPoints = data.indicators.rsi
            .map((v, i) => (v !== null ? { time: times[i] as any, value: Number(v) } : null))
            .filter(Boolean) as any[];

          if (rsiPoints.length) {
            const rsiPane = chart.addPane();
            const rsiSeries = rsiPane.addSeries(LineSeries, {
              color: C.rsi,
              lineWidth: 1,
              title: "",
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

        // MACD
        if (!mini && config.showMacd && data.indicators?.macd) {
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
              title: "",
              priceLineVisible: false,
              lastValueVisible: true,
            });
            m.setData(macdPoints);

            if (sigPoints.length) {
              const s = macdPane.addSeries(LineSeries, {
                color: C.macdSignal,
                lineWidth: 1,
                title: "",
                priceLineVisible: false,
                lastValueVisible: true,
              });
              s.setData(sigPoints);
            }
          }
        }

        // Penyelarasan Dinamik X & Y (Menyegerakkan pergerakan skala masa & harga)
        chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
          redrawCanvasRef.current();
        });

        chart.subscribeCrosshairMove(() => {
          redrawCanvasRef.current();
        });

        if (ticker !== lastTickerRef.current && data.ohlcv.length > 0) {
          lastTickerRef.current = ticker;
          const totalBars = data.ohlcv.length;
          chart.timeScale().setVisibleLogicalRange({
            from: Math.max(0, totalBars - 105),
            to: totalBars - 1,
          });
        }

        redrawCanvasRef.current();
      }
    );

    return () => {
      destroyed = true;
      chartRef.current?.remove();
      chartRef.current = null;
    };
  }, [data, config, mini, theme, ticker]);

  // 3. Pengira Koordinat Selamat
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

  // 4. Pengesan Sentuhan / Titik Pemegang (Hit-Testing untuk TP, SL, P1, P2)
  const findHandleAt = (clientX: number, clientY: number): DragHandleTarget | null => {
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
  };

  // 5. Pengendali Acara Utama
  const handlePointerDown = (clientX: number, clientY: number) => {
    if (mini) return;
    const coord = getCoordinatesRaw(clientX, clientY);
    if (!coord) return;

    // Semak pemegang boleh tarik sedia ada
    const target = findHandleAt(clientX, clientY);
    if (target) {
      setDraggingTarget(target);
      return;
    }

    // Mod Ukuran
    if (activeTool === "range") {
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

    // Mod Long Position
    if (activeTool === "long") {
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

  const handlePointerMove = (clientX: number, clientY: number) => {
    if (mini) return;
    const coord = getCoordinatesRaw(clientX, clientY);

    // Pantau kedudukan tetikus pada pemegang
    if (!draggingTarget && activeTool === "none") {
      const hit = findHandleAt(clientX, clientY);
      setHoveredTarget(hit);
    }

    if (!coord) return;

    // Pelarasan dinamik pemegang yang sedang ditarik
    if (draggingTarget) {
      setDrawings((prev) =>
        prev.map((d) => {
          if (d.id === draggingTarget.id) {
            if (d.type === "long" && draggingTarget.type === "long") {
              if (draggingTarget.handle === "tp") {
                return { ...d, tpPrice: Math.max(d.entryPrice + 0.001, coord.price) };
              }
              if (draggingTarget.handle === "sl") {
                return { ...d, slPrice: Math.min(d.entryPrice - 0.001, coord.price) };
              }
            }
            if (d.type === "range" && draggingTarget.type === "range") {
              if (draggingTarget.handle === "p1") {
                return {
                  ...d,
                  startTime: coord.timeStr,
                  startPrice: coord.price,
                  barsCount: Math.abs(coord.barIdx - (data.ohlcv.findIndex(b => formatLwcTime(b.time) === d.endTime) || coord.barIdx)) + 1,
                };
              }
              if (draggingTarget.handle === "p2") {
                return {
                  ...d,
                  endTime: coord.timeStr,
                  endPrice: coord.price,
                  barsCount: Math.abs(coord.barIdx - (data.ohlcv.findIndex(b => formatLwcTime(b.time) === d.startTime) || coord.barIdx)) + 1,
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
  };

  const handlePointerUp = () => {
    if (draggingTarget) {
      setDraggingTarget(null);
    }
  };

  return (
    <div className="flex flex-col h-full w-full select-none">
      {!mini && (
        <div className="flex flex-wrap items-center justify-between px-2.5 py-1.5 bg-gray-100/90 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 text-[11px] gap-2">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-gray-400 mr-1 text-[10px]">TOOLS:</span>

            <button
              type="button"
              onClick={() => {
                setActiveTool("none");
                setRangeStart(null);
                setRangeCurrent(null);
              }}
              className={`px-2 py-1 rounded border transition ${
                activeTool === "none"
                  ? "bg-gray-300 dark:bg-gray-700 font-bold border-gray-400 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                  : "border-transparent text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"
              }`}
            >
              👆 Pointer
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTool("range");
                setRangeStart(null);
                setRangeCurrent(null);
              }}
              className={`px-2 py-1 rounded border transition flex items-center gap-1 ${
                activeTool === "range"
                  ? "bg-sky-500/20 text-sky-400 border-sky-500 font-bold"
                  : "border-transparent text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"
              }`}
              title="Klik/Tap P1 dan P2 untuk mengukur jarak harga & lilin"
            >
              📐 Price & Date Range {rangeStart ? " (Pilih P2)" : ""}
            </button>

            <button
              type="button"
              onClick={() => setActiveTool("long")}
              className={`px-2 py-1 rounded border transition flex items-center gap-1 ${
                activeTool === "long"
                  ? "bg-[#26A69A]/20 text-[#26A69A] border-[#26A69A] font-bold"
                  : "border-transparent text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"
              }`}
              title="Klik pada lilin untuk letak Long Position (Default TP +6%, SL -2%)"
            >
              📈 Long Position
            </button>
          </div>

          {drawings.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setDrawings([]);
                redrawCanvas();
              }}
              className="text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 font-medium px-2 py-0.5 rounded hover:bg-rose-500/10 transition text-[10px]"
            >
              🗑️ Padam Lukisan ({drawings.length})
            </button>
          )}
        </div>
      )}

      {/* Bekas Carta & Kanvas Lukisan Interaktif */}
      <div
        ref={containerRef}
        onWheel={() => redrawCanvasRef.current()}
        className="relative flex-1 w-full"
        style={{ minHeight: mini ? 200 : 550 }}
      >
        {!mini && (
          <canvas
            ref={canvasRef}
            onMouseDown={(e) => {
              if (e.button === 0) handlePointerDown(e.clientX, e.clientY);
            }}
            onMouseMove={(e) => handlePointerMove(e.clientX, e.clientY)}
            onMouseUp={handlePointerUp}
            onTouchStart={(e) => {
              if (e.touches.length === 1) {
                handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
              }
            }}
            onTouchMove={(e) => {
              if (e.touches.length === 1) {
                handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
              }
            }}
            onTouchEnd={handlePointerUp}
            className={`absolute inset-0 w-full h-full z-10 touch-none ${
              activeTool !== "none" || draggingTarget !== null || hoveredTarget !== null
                ? "cursor-crosshair pointer-events-auto"
                : "pointer-events-none"
            }`}
          />
        )}
      </div>
    </div>
  );
});