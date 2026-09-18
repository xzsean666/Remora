import React, { useState, useMemo } from "react";
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  Check,
  Download,
  Filter,
  Layers,
  Database,
  Loader2,
  RefreshCw,
} from "lucide-react";

export interface ColumnDef {
  key: string;
  label: string;
  type?: string;
  description?: string;
}

export interface DataTableViewerProps {
  columns: ColumnDef[];
  data: Array<Record<string, any>>;
  fileSize?: number;
  totalRows?: number; // In case data is a preview sample
  isLoading?: boolean;
  emptyMessage?: string;
  onExportCsv?: () => void;
  extraToolbarAction?: React.ReactNode;
  footerNotes?: string;
  onDeepSearch?: (term: string) => void;
  isDeepSearching?: boolean;
  deepSearchProgress?: { scanned: number; total: number; matches: number } | null;
  onResetSample?: () => void;
  isFilteredFromDeepSearch?: boolean;
}

export const DataTableViewer: React.FC<DataTableViewerProps> = ({
  columns,
  data,
  fileSize,
  totalRows,
  isLoading = false,
  emptyMessage = "No data rows found in file",
  onExportCsv,
  extraToolbarAction,
  footerNotes,
  onDeepSearch,
  isDeepSearching = false,
  deepSearchProgress,
  onResetSample,
  isFilteredFromDeepSearch = false,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedCell, setSelectedCell] = useState<{ rowIdx: number; colKey: string } | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Sorting handler
  const handleSort = (colKey: string) => {
    if (sortColumn === colKey) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else {
        setSortColumn(null);
        setSortDirection("asc");
      }
    } else {
      setSortColumn(colKey);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  // Filter data by search term
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;
    const lower = searchTerm.toLowerCase().trim();
    return data.filter((row) => {
      return Object.values(row).some((val) => {
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(lower);
      });
    });
  }, [data, searchTerm]);

  // Sort filtered data
  const sortedData = useMemo(() => {
    if (!sortColumn) return filteredData;

    return [...filteredData].sort((a, b) => {
      const valA = a[sortColumn];
      const valB = b[sortColumn];

      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      // Numeric comparison if both are numbers
      const numA = Number(valA);
      const numB = Number(valB);
      if (!isNaN(numA) && !isNaN(numB) && typeof valA !== "boolean" && typeof valB !== "boolean") {
        return sortDirection === "asc" ? numA - numB : numB - numA;
      }

      // Default string comparison
      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      const cmp = strA.localeCompare(strB);
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [filteredData, sortColumn, sortDirection]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedData = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, safePage, pageSize]);

  // Copy cell content
  const handleCopyCell = (text: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 1500);
  };

  // Copy entire row as JSON
  const handleCopyRowJson = (row: Record<string, any>, e: React.MouseEvent) => {
    e.stopPropagation();
    const json = JSON.stringify(row, null, 2);
    navigator.clipboard.writeText(json);
    setCopiedText("row_json");
    setTimeout(() => setCopiedText(null), 1500);
  };

  // Format file size
  const formatSize = (bytes?: number) => {
    if (!bytes) return null;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const startIdx = (safePage - 1) * pageSize + 1;
  const endIdx = Math.min(safePage * pageSize, sortedData.length);

  return (
    <div className="w-full h-full flex flex-col bg-vscode-bg select-text overflow-hidden font-sans">
      {/* Top Toolbar */}
      <div className="h-10 px-3 bg-vscode-sidebar/90 border-b border-vscode-border/80 flex items-center justify-between text-xs text-vscode-textMuted flex-shrink-0 gap-2">
        {/* Left: Quick Search */}
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-vscode-textMuted/70 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={`Search ${sortedData.length.toLocaleString()} rows...`}
              className="w-full h-7 pl-8 pr-7 bg-vscode-bg border border-vscode-border/80 rounded text-xs text-vscode-textBright placeholder-vscode-textMuted/50 focus:outline-hidden focus:border-vscode-activityBarActive transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setCurrentPage(1);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-vscode-textMuted hover:text-vscode-textBright text-[10px] px-1"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
          {searchTerm && (
            <span className="text-[11px] text-vscode-textMuted flex-shrink-0 flex items-center gap-1">
              <Filter className="w-3 h-3 text-sky-400" />
              <span>
                {sortedData.length} of {data.length}
              </span>
            </span>
          )}

          {/* Deep Search trigger button for Parquet and large sampled datasets */}
          {onDeepSearch && searchTerm.trim() && !isFilteredFromDeepSearch && (
            <button
              onClick={() => onDeepSearch(searchTerm.trim())}
              disabled={isDeepSearching}
              className="h-7 px-2 rounded bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 text-[11px] font-medium flex items-center gap-1.5 flex-shrink-0 transition-all shadow-xs"
              title={`Search for "${searchTerm}" across entire file (${totalRows?.toLocaleString() || "all"} rows)`}
            >
              {isDeepSearching ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-sky-400" />
                  <span>
                    {deepSearchProgress
                      ? `Scanning (${deepSearchProgress.scanned.toLocaleString()}/${deepSearchProgress.total.toLocaleString()})...`
                      : "Scanning full file..."}
                  </span>
                </>
              ) : (
                <>
                  <Search className="w-3 h-3 text-sky-400" />
                  <span>全文件深度检索</span>
                </>
              )}
            </button>
          )}

          {/* Reset button if currently viewing deep search matches */}
          {isFilteredFromDeepSearch && onResetSample && (
            <button
              onClick={onResetSample}
              className="h-7 px-2 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[11px] font-medium flex items-center gap-1.5 flex-shrink-0 transition-all"
              title="Reset search and return to initial sample preview"
            >
              <RefreshCw className="w-3 h-3 text-amber-400" />
              <span>返回采样预览</span>
            </button>
          )}
        </div>

        {/* Right: Actions & Extra Controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {extraToolbarAction}

          {onExportCsv && (
            <button
              onClick={onExportCsv}
              className="h-7 px-2.5 rounded bg-vscode-bg hover:bg-white/5 border border-vscode-border text-vscode-text text-xs flex items-center gap-1.5 transition-colors shadow-xs"
              title="Export displayed data as CSV"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          )}

          {/* Page size dropdown */}
          <div className="flex items-center gap-1 text-[11px] text-vscode-textMuted">
            <span className="hidden md:inline">Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              aria-label="Rows per page"
              className="h-7 bg-vscode-bg border border-vscode-border/80 rounded px-1.5 text-xs text-vscode-textBright focus:outline-hidden focus:border-vscode-activityBarActive"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid Area */}
      <div className="flex-1 min-h-0 min-w-0 overflow-auto relative">
        {isLoading ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-vscode-textMuted">
            <div className="w-6 h-6 border-2 border-vscode-activityBarActive border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Parsing tabular records...</span>
          </div>
        ) : columns.length === 0 || sortedData.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-vscode-textMuted select-none p-6">
            <Database className="w-10 h-10 stroke-1 opacity-40 text-vscode-textMuted" />
            <p className="text-sm font-medium">{emptyMessage}</p>
            {searchTerm && (
              <p className="text-xs text-vscode-textMuted/70">
                No matching rows for query "{searchTerm}". Try clearing your search filter.
              </p>
            )}
          </div>
        ) : (
          <table className="w-full border-collapse text-left text-xs font-mono">
            {/* Sticky Table Header */}
            <thead className="sticky top-0 z-10 bg-vscode-sidebar shadow-xs select-none">
              <tr className="border-b border-vscode-border/90">
                {/* Row Index Column */}
                <th className="w-12 px-2 py-2 text-center text-[11px] font-medium text-vscode-textMuted/60 bg-vscode-sidebar/95 border-r border-vscode-border/50 select-none">
                  #
                </th>

                {/* Data Column Headers */}
                {columns.map((col) => {
                  const isSorted = sortColumn === col.key;
                  return (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className="px-3 py-2 text-[11px] font-semibold text-vscode-textBright bg-vscode-sidebar/95 border-r border-vscode-border/40 hover:bg-white/5 cursor-pointer transition-colors group relative whitespace-nowrap"
                      title={col.description ? `${col.label} (${col.type || "string"}): ${col.description}` : `Sort by ${col.label}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="truncate">{col.label}</span>
                          {col.type && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-vscode-border/50 text-vscode-textMuted font-normal">
                              {col.type}
                            </span>
                          )}
                        </div>
                        <span className="flex-shrink-0 text-vscode-textMuted group-hover:text-vscode-textBright transition-colors">
                          {isSorted ? (
                            sortDirection === "asc" ? (
                              <ArrowUp className="w-3.5 h-3.5 text-vscode-activityBarActive" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5 text-vscode-activityBarActive" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-60" />
                          )}
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody>
              {paginatedData.map((row, rowIdx) => {
                const globalRowNumber = startIdx + rowIdx;
                const isEven = rowIdx % 2 === 0;

                return (
                  <tr
                    key={`row-${globalRowNumber}`}
                    className={`border-b border-vscode-border/25 transition-colors group ${
                      isEven ? "bg-vscode-bg" : "bg-vscode-sidebar/30"
                    } hover:bg-vscode-activityBarActive/10`}
                  >
                    {/* Row index + Copy JSON button */}
                    <td className="w-12 px-2 py-1.5 text-center text-[10px] text-vscode-textMuted/60 font-mono border-r border-vscode-border/40 select-none relative group/rowidx">
                      <span className="group-hover/rowidx:hidden">{globalRowNumber}</span>
                      <button
                        onClick={(e) => handleCopyRowJson(row, e)}
                        className="hidden group-hover/rowidx:inline-flex items-center justify-center w-full text-vscode-textMuted hover:text-vscode-textBright transition-colors"
                        title="Copy row as JSON"
                      >
                        {copiedText === "row_json" ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </td>

                    {/* Data Cells */}
                    {columns.map((col) => {
                      const cellValue = row[col.key];
                      const isNullOrUndefined = cellValue === null || cellValue === undefined;
                      const displayString = isNullOrUndefined ? "NULL" : typeof cellValue === "object" ? JSON.stringify(cellValue) : String(cellValue);
                      const isSelected = selectedCell?.rowIdx === globalRowNumber && selectedCell?.colKey === col.key;

                      return (
                        <td
                          key={col.key}
                          onClick={() => setSelectedCell({ rowIdx: globalRowNumber, colKey: col.key })}
                          onDoubleClick={(e) => handleCopyCell(displayString, e)}
                          className={`px-3 py-1.5 text-xs border-r border-vscode-border/30 max-w-xs truncate cursor-cell transition-colors relative ${
                            isSelected
                              ? "bg-vscode-activityBarActive/20 outline outline-1 outline-vscode-activityBarActive z-2"
                              : ""
                          } ${
                            isNullOrUndefined
                              ? "text-vscode-textMuted/40 italic font-sans text-[11px]"
                              : typeof cellValue === "number"
                              ? "text-sky-300 font-mono text-right"
                              : typeof cellValue === "boolean"
                              ? "text-amber-300 font-mono"
                              : "text-vscode-text"
                          }`}
                          title={`Value: ${displayString}\n(Double click to copy)`}
                        >
                          {displayString}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Bottom Footer & Pagination Bar */}
      <div className="h-8 px-3 bg-vscode-sidebar/95 border-t border-vscode-border/80 flex items-center justify-between text-xs text-vscode-textMuted flex-shrink-0 select-none">
        {/* Status / Count info */}
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1.5 text-vscode-textBright/90 font-medium">
            <Layers className="w-3.5 h-3.5 text-vscode-activityBarActive" />
            <span>
              {sortedData.length.toLocaleString()} {sortedData.length === 1 ? "row" : "rows"}
            </span>
            <span className="text-vscode-textMuted/70 font-normal">
              ({columns.length} {columns.length === 1 ? "column" : "columns"})
            </span>
          </span>

          {totalRows && totalRows > data.length && (
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
              Sample of {totalRows.toLocaleString()} total
            </span>
          )}

          {fileSize && (
            <span className="hidden sm:inline text-vscode-textMuted/70">
              Size: {formatSize(fileSize)}
            </span>
          )}

          {footerNotes && (
            <span className="hidden lg:inline text-vscode-textMuted/60 text-[10px]">
              {footerNotes}
            </span>
          )}
        </div>

        {/* Pagination Controls */}
        {sortedData.length > 0 && (
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-vscode-textMuted hidden sm:inline">
              {startIdx}-{endIdx} of {sortedData.length}
            </span>

            <div className="flex items-center gap-0.5 bg-vscode-bg/80 p-0.5 rounded border border-vscode-border/70">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={safePage <= 1}
                className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-vscode-text"
                title="First Page"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-vscode-text"
                title="Previous Page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <span className="px-2 font-mono text-[11px] text-vscode-textBright">
                {safePage} / {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-vscode-text"
                title="Next Page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={safePage >= totalPages}
                className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-vscode-text"
                title="Last Page"
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Copy Toast feedback */}
      {copiedText && (
        <div className="absolute bottom-10 right-4 z-30 flex items-center gap-1.5 px-3 py-1 rounded bg-vscode-activityBarActive text-white text-xs shadow-lg animate-in fade-in duration-150">
          <Check className="w-3.5 h-3.5" />
          <span>{copiedText === "row_json" ? "Row JSON copied!" : "Cell copied to clipboard"}</span>
        </div>
      )}
    </div>
  );
};
