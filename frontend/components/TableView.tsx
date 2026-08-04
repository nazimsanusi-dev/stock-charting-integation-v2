"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "@/lib/api";
import type { SheetEntry } from "@/lib/types";

interface Props {
  selectedSheet: SheetEntry | null;
  worksheet: string;
}

type SortDir = "asc" | "desc";

export function TableView({ selectedSheet, worksheet }: Props) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (!selectedSheet) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.tableData(selectedSheet.url, worksheet);
      setHeaders(data.headers);
      setRows(data.rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [selectedSheet?.url, worksheet]); // eslint-disable-line

  useEffect(() => {
    load();
  }, [load]);

  const handleSort = (colIdx: number) => {
    if (sortCol === colIdx) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(colIdx);
      setSortDir("asc");
    }
  };

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? rows.filter((r) => r.some((cell) => cell.toLowerCase().includes(q))) : rows;
  }, [rows, search]);

  const sortedRows = useMemo(() => {
    if (sortCol === null) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      const av = a[sortCol] ?? "";
      const bv = b[sortCol] ?? "";
      const an = parseFloat(av);
      const bn = parseFloat(bv);
      const cmp = !isNaN(an) && !isNaN(bn) ? an - bn : av.localeCompare(bv);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filteredRows, sortCol, sortDir]);

  if (!selectedSheet) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Select a sheet from the sidebar
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm animate-pulse">
        Loading table data…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400 text-sm px-8 text-center">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4 h-full">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-gray-700">
          {selectedSheet.label} — {worksheet}
        </span>
        <span className="text-xs text-gray-400">{sortedRows.length} rows</span>
        <input
          className="input ml-auto w-48"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          onClick={load}
          className="px-2 py-1 text-xs border border-gray-200 rounded hover:border-gray-400 text-gray-600 transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      <div className="overflow-auto flex-1 rounded-lg border border-gray-100">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr>
              {headers.map((h, i) => (
                <th
                  key={i}
                  onClick={() => handleSort(i)}
                  className="px-3 py-2 text-left font-medium text-gray-600 border-b border-gray-100 cursor-pointer hover:bg-gray-100 whitespace-nowrap select-none"
                >
                  <span className="flex items-center gap-1">
                    {h}
                    {sortCol === i ? (
                      <span className="text-[#26A69A]">{sortDir === "asc" ? "↑" : "↓"}</span>
                    ) : (
                      <span className="text-gray-300">↕</span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, ri) => (
              <tr
                key={ri}
                className={ri % 2 === 0 ? "bg-white hover:bg-gray-50" : "bg-gray-50/50 hover:bg-gray-100/50"}
              >
                {headers.map((_, ci) => (
                  <td key={ci} className="px-3 py-1.5 border-b border-gray-50 text-gray-700 whitespace-nowrap">
                    {row[ci] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
            {sortedRows.length === 0 && (
              <tr>
                <td colSpan={headers.length} className="px-3 py-8 text-center text-gray-400">
                  No data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
