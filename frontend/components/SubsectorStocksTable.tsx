"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { SubsectorRank, SubsectorStockItem } from "@/lib/types";

interface Props {
  subsectors: SubsectorRank[];
}

export function SubsectorStocksTable({ subsectors }: Props) {
  const [selectedSubsector, setSelectedSubsector] = useState<string>("");
  const [stocks, setStocks] = useState<SubsectorStockItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Set default ke subsektor ranking #1 bila data subsectors sampai
  useEffect(() => {
    if (subsectors.length > 0 && !selectedSubsector) {
      setSelectedSubsector(subsectors[0].subsector_name);
    }
  }, [subsectors, selectedSubsector]);

  // Load senarai saham bila subsektor dipilih
  const loadStocks = async (subName: string) => {
    if (!subName) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.subsectorStocks(subName);
      setStocks(data);
    } catch (err: any) {
      setError("Gagal memuatkan senarai saham.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedSubsector) {
      loadStocks(selectedSubsector);
    }
  }, [selectedSubsector]);

  return (
    <div className="space-y-3">
      {/* Dropdown Pemilihan Subsektor */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">
            Pilih Subsektor:
          </label>
          <select
            value={selectedSubsector}
            onChange={(e) => setSelectedSubsector(e.target.value)}
            disabled={loading}
            className="text-xs py-1.5 px-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 font-medium"
          >
            {subsectors.map((s) => (
              <option key={s.subsector_id} value={s.subsector_name}>
                #{s.rank} {s.subsector_name} ({s.num_stocks} stocks)
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => loadStocks(selectedSubsector)}
          disabled={loading || !selectedSubsector}
          className="text-xs text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 inline-flex items-center gap-1.5 px-2 py-1 rounded bg-gray-200/50 dark:bg-gray-800"
        >
          <span className={loading ? "animate-spin" : ""}>🔄</span> Refresh Saham
        </button>
      </div>

      {/* Jadual Senarai Saham */}
      {loading ? (
        <div className="py-12 text-center text-xs text-gray-400">
          <span className="animate-spin inline-block mr-2">⏳</span> Memuatkan senarai saham...
        </div>
      ) : error ? (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-lg text-center">
          {error} -{" "}
          <button onClick={() => loadStocks(selectedSubsector)} className="underline font-bold">
            Cuba Lagi
          </button>
        </div>
      ) : stocks.length === 0 ? (
        <div className="py-8 text-center text-xs text-gray-400">
          Tiada saham dijumpai untuk subsektor ini.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-100 dark:bg-gray-800/80 text-gray-600 dark:text-gray-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-2.5 px-3">Kod</th>
                <th className="py-2.5 px-3">Nama Saham</th>
                <th className="py-2.5 px-3 text-center">Shariah</th>
                <th className="py-2.5 px-3 text-right">Harga (RM)</th>
                <th className="py-2.5 px-3 text-right">Perubahan</th>
                <th className="py-2.5 px-3 text-right">Change %</th>
                <th className="py-2.5 px-3 text-right">Volume</th>
                <th className="py-2.5 px-3 text-right">MCap (M)</th>
                <th className="py-2.5 px-3 text-right">P/E</th>
                <th className="py-2.5 px-3 text-right">ROE %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-900/40">
              {stocks.map((item, idx) => {
                const changeVal = parseFloat(item.Change_Percent.replace("%", "").replace("+", ""));
                const isPos = changeVal > 0;
                const isNeg = changeVal < 0;

                return (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="py-2 px-3 font-mono font-bold text-gray-900 dark:text-gray-100">
                      {item.Code}
                    </td>
                    <td className="py-2 px-3 font-medium text-gray-800 dark:text-gray-200">
                      {item.Name}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {item.Shariah === "Yes" ? (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
                          [S]
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-gray-700 dark:text-gray-300">
                      {item.Price}
                    </td>
                    <td
                      className={`py-2 px-3 text-right font-mono font-medium ${
                        isPos ? "text-emerald-500" : isNeg ? "text-rose-500" : "text-gray-400"
                      }`}
                    >
                      {item.Change}
                    </td>
                    <td
                      className={`py-2 px-3 text-right font-mono font-bold ${
                        isPos ? "text-emerald-500" : isNeg ? "text-rose-500" : "text-gray-400"
                      }`}
                    >
                      {item.Change_Percent}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-gray-500 dark:text-gray-400">
                      {item.Volume}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-gray-600 dark:text-gray-300">
                      {item.MCap_M}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-gray-500 dark:text-gray-400">
                      {item.PE || "-"}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-gray-500 dark:text-gray-400">
                      {item.ROE || "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}