"use client";

import React, { useMemo } from "react";
import type { SubsectorHeatmapItem } from "@/lib/types";

interface Props {
  data: SubsectorHeatmapItem[];
  onSelectSubsector?: (subsectorId: number) => void;
}

export function SubsectorHeatmap({ data, onSelectSubsector }: Props) {
  // Kumpulkan subsektor mengikut Sektor Induk (sector_name)
  const groupedSectors = useMemo(() => {
    if (!data) return {};
    return data.reduce((acc, item) => {
      const sector = item.sector_name || "Lain-lain";
      if (!acc[sector]) acc[sector] = [];
      acc[sector].push(item);
      return acc;
    }, {} as Record<string, SubsectorHeatmapItem[]>);
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-gray-400 text-sm">
        Tiada data heatmap subsektor ditemui.
      </div>
    );
  }

  // Helper function untuk tentukan warna background berdasarkan Return 5D
  const getBgColor = (return5d: number) => {
    if (return5d >= 3) return "bg-emerald-600 text-white hover:bg-emerald-500";
    if (return5d > 0) return "bg-emerald-500/80 text-white hover:bg-emerald-500";
    if (return5d === 0) return "bg-gray-500/40 text-gray-200 hover:bg-gray-500/60";
    if (return5d > -3) return "bg-rose-500/80 text-white hover:bg-rose-500";
    return "bg-rose-600 text-white hover:bg-rose-500";
  };

  return (
    <div className="space-y-4">
      {/* Legend Warna */}
      <div className="flex items-center justify-end gap-3 text-[11px] text-gray-500 dark:text-gray-400 font-medium">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-emerald-600 inline-block" /> &gt; +3%
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-emerald-500/80 inline-block" /> +0% - +3%
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-gray-500/40 inline-block" /> 0%
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-rose-500/80 inline-block" /> -0% - -3%
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-rose-600 inline-block" /> &lt; -3%
        </span>
      </div>

      {/* Grid Sektor & Subsektor */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(groupedSectors).map(([sectorName, items]) => (
          <div
            key={sectorName}
            className="p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 flex flex-col gap-2"
          >
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800 pb-1.5">
              {sectorName}
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 flex-1">
              {items.map((sub) => {
                const isPositive = sub.return_5d > 0;
                return (
                  <button
                    key={sub.subsector_id}
                    onClick={() => onSelectSubsector?.(sub.subsector_id)}
                    className={`p-2 rounded flex flex-col justify-between text-left transition-transform active:scale-95 ${getBgColor(
                      sub.return_5d
                    )}`}
                    title={`Score: ${sub.score} | 20D: ${sub.return_20d}% | Stocks: ${sub.num_stocks}`}
                  >
                    <span className="text-[11px] font-semibold leading-tight line-clamp-2">
                      {sub.subsector_name}
                    </span>
                    <div className="flex items-center justify-between mt-2 font-mono text-[10px] font-bold">
                      <span>
                        {isPositive ? `+${sub.return_5d}%` : `${sub.return_5d}%`}
                      </span>
                      <span className="opacity-75 font-normal text-[9px]">
                        {sub.num_stocks}s
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}