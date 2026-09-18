import React, { useEffect, useState, useRef, useCallback } from "react";
import { parquetMetadata, parquetReadObjects, parquetSchema } from "hyparquet";
import { DataTableViewer, type ColumnDef } from "./DataTableViewer";
import type { EditorTab } from "../../stores/editorStore";
import {
  Database,
  Table,
  Layers,
  AlertCircle,
  Info,
  Box,
  Plus,
  Loader2,
  Sparkles,
} from "lucide-react";

interface ParquetViewerProps {
  tab: EditorTab;
}

interface ParquetColumnMeta {
  name: string;
  physicalType: string;
  logicalType?: string;
  repetitionType: string;
  compression?: string;
}

interface ParquetFileInfo {
  numRows: number;
  numRowGroups: number;
  createdBy?: string;
  columnsMeta: ParquetColumnMeta[];
}

const DEFAULT_SAMPLE_SIZE = 1000;
const MAX_DEEP_SEARCH_MATCHES = 5000;

/**
 * Normalizes raw Parquet row values for safe JS handling (converts BigInt and decodes byte arrays).
 */
function normalizeParquetRow(r: Record<string, any>): Record<string, any> {
  const safeRecord: Record<string, any> = {};
  for (const [k, v] of Object.entries(r)) {
    if (typeof v === "bigint") {
      safeRecord[k] =
        v <= BigInt(Number.MAX_SAFE_INTEGER) && v >= BigInt(Number.MIN_SAFE_INTEGER)
          ? Number(v)
          : v.toString();
    } else if (v instanceof Uint8Array) {
      try {
        safeRecord[k] = new TextDecoder().decode(v);
      } catch {
        safeRecord[k] = `[Binary ${v.length}B]`;
      }
    } else {
      safeRecord[k] = v;
    }
  }
  return safeRecord;
}

export const ParquetViewer: React.FC<ParquetViewerProps> = ({ tab }) => {
  const [activeSubTab, setActiveSubTab] = useState<"grid" | "schema">("grid");
  const [columns, setColumns] = useState<ColumnDef[]>([]);
  const [sampleRows, setSampleRows] = useState<Array<Record<string, any>>>([]);
  const [displayedRows, setDisplayedRows] = useState<Array<Record<string, any>>>([]);
  const [loadedRowsCount, setLoadedRowsCount] = useState<number>(0);
  const [fileInfo, setFileInfo] = useState<ParquetFileInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Deep Search States
  const [isDeepSearching, setIsDeepSearching] = useState(false);
  const [deepSearchProgress, setDeepSearchProgress] = useState<{
    scanned: number;
    total: number;
    matches: number;
  } | null>(null);
  const [isFilteredFromDeepSearch, setIsFilteredFromDeepSearch] = useState(false);
  const [deepSearchKeyword, setDeepSearchKeyword] = useState("");

  const bufferRef = useRef<ArrayBuffer | null>(null);
  const cancelSearchRef = useRef<boolean>(false);

  // Initial Load: Parse Metadata and read initial 1,000 rows sample
  useEffect(() => {
    let isMounted = true;

    async function initParquet() {
      try {
        setLoading(true);
        setError(null);

        let arrayBuffer: ArrayBuffer | null = null;

        if (tab.binaryBase64) {
          const binaryString = atob(tab.binaryBase64);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        } else if (tab.content) {
          const encoder = new TextEncoder();
          const bytes = encoder.encode(tab.content);
          arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        }

        if (!arrayBuffer || arrayBuffer.byteLength === 0) {
          throw new Error("Parquet file content is empty or could not be loaded.");
        }

        bufferRef.current = arrayBuffer;

        // 1. Read Metadata & Schema
        const metadata = parquetMetadata(arrayBuffer);
        const schema = parquetSchema(metadata);

        const numRows = typeof metadata.num_rows === "bigint" ? Number(metadata.num_rows) : metadata.num_rows || 0;
        const numRowGroups = metadata.row_groups ? metadata.row_groups.length : 0;
        const createdBy = metadata.created_by;

        const colsMeta: ParquetColumnMeta[] = [];
        const tableCols: ColumnDef[] = [];

        if (schema && schema.children) {
          schema.children.forEach((child) => {
            const el = child.element;
            const name = el.name || "unnamed";
            const physicalType = el.type || "UNKNOWN";
            const logicalType = el.logical_type?.type || el.converted_type || undefined;
            const repetitionType = el.repetition_type || "OPTIONAL";

            let compression: string | undefined = undefined;
            if (metadata.row_groups && metadata.row_groups[0]?.columns) {
              const chunk = metadata.row_groups[0].columns.find((c) => c.meta_data?.path_in_schema?.[0] === name);
              if (chunk?.meta_data?.codec) {
                compression = chunk.meta_data.codec;
              }
            }

            colsMeta.push({
              name,
              physicalType,
              logicalType,
              repetitionType,
              compression,
            });

            tableCols.push({
              key: name,
              label: name,
              type: logicalType ? `${logicalType} (${physicalType})` : physicalType,
              description: `Repetition: ${repetitionType}${compression ? `, Codec: ${compression}` : ""}`,
            });
          });
        }

        // 2. Read only the first batch (e.g. up to 1,000 rows) for instant responsiveness
        const initialLimit = Math.min(DEFAULT_SAMPLE_SIZE, numRows);
        const rawInitialRows = await parquetReadObjects({
          file: arrayBuffer,
          rowStart: 0,
          rowEnd: initialLimit,
        });

        const safeRows = (rawInitialRows || []).map(normalizeParquetRow);

        if (isMounted) {
          setFileInfo({
            numRows,
            numRowGroups,
            createdBy,
            columnsMeta: colsMeta,
          });
          setColumns(tableCols);
          setSampleRows(safeRows);
          setDisplayedRows(safeRows);
          setLoadedRowsCount(safeRows.length);
          setIsFilteredFromDeepSearch(false);
          setLoading(false);
        }
      } catch (err: any) {
        console.error("Failed to parse Parquet file:", err);
        if (isMounted) {
          setError(err?.message || "Invalid or corrupt Parquet file format.");
          setLoading(false);
        }
      }
    }

    initParquet();

    return () => {
      isMounted = false;
      cancelSearchRef.current = true;
    };
  }, [tab.binaryBase64, tab.content, tab.path]);

  // Load more rows (incremental pagination)
  const handleLoadMore = useCallback(
    async (batchSize: number = 1000) => {
      if (!bufferRef.current || !fileInfo || isLoadingMore) return;
      if (loadedRowsCount >= fileInfo.numRows) return;

      try {
        setIsLoadingMore(true);
        const start = loadedRowsCount;
        const end = Math.min(start + batchSize, fileInfo.numRows);

        const nextRaw = await parquetReadObjects({
          file: bufferRef.current,
          rowStart: start,
          rowEnd: end,
        });

        const nextSafe = (nextRaw || []).map(normalizeParquetRow);
        const updatedSample = [...sampleRows, ...nextSafe];

        setSampleRows(updatedSample);
        if (!isFilteredFromDeepSearch) {
          setDisplayedRows(updatedSample);
        }
        setLoadedRowsCount(updatedSample.length);
      } catch (e) {
        console.error("Failed to load more rows:", e);
      } finally {
        setIsLoadingMore(false);
      }
    },
    [fileInfo, loadedRowsCount, sampleRows, isFilteredFromDeepSearch, isLoadingMore]
  );

  // Load all remaining rows (up to safe threshold)
  const handleLoadAll = useCallback(async () => {
    if (!fileInfo) return;
    const remaining = fileInfo.numRows - loadedRowsCount;
    if (remaining > 0) {
      await handleLoadMore(remaining);
    }
  }, [fileInfo, loadedRowsCount, handleLoadMore]);

  // Deep Search across the ENTIRE Parquet file
  const handleDeepSearch = useCallback(
    async (keyword: string) => {
      if (!bufferRef.current || !fileInfo || isDeepSearching) return;
      const term = keyword.trim().toLowerCase();
      if (!term) return;

      cancelSearchRef.current = false;
      setIsDeepSearching(true);
      setDeepSearchKeyword(keyword.trim());
      setDeepSearchProgress({ scanned: 0, total: fileInfo.numRows, matches: 0 });

      const matches: Array<Record<string, any>> = [];
      const CHUNK_SIZE = 5000;
      const total = fileInfo.numRows;

      try {
        for (let start = 0; start < total; start += CHUNK_SIZE) {
          if (cancelSearchRef.current) break;
          const end = Math.min(start + CHUNK_SIZE, total);

          const chunk = await parquetReadObjects({
            file: bufferRef.current,
            rowStart: start,
            rowEnd: end,
          });

          for (const rawRow of chunk || []) {
            const hasMatch = Object.values(rawRow).some((val) => {
              if (val === null || val === undefined) return false;
              return String(val).toLowerCase().includes(term);
            });

            if (hasMatch) {
              matches.push(normalizeParquetRow(rawRow));
              if (matches.length >= MAX_DEEP_SEARCH_MATCHES) {
                break;
              }
            }
          }

          setDeepSearchProgress({
            scanned: end,
            total,
            matches: matches.length,
          });

          if (matches.length >= MAX_DEEP_SEARCH_MATCHES) {
            break;
          }

          // Yield to UI thread so search progress and spinner remain smooth
          await new Promise((resolve) => setTimeout(resolve, 0));
        }

        setDisplayedRows(matches);
        setIsFilteredFromDeepSearch(true);
      } catch (err) {
        console.error("Deep search error:", err);
      } finally {
        setIsDeepSearching(false);
      }
    },
    [fileInfo, isDeepSearching]
  );

  // Reset back to initial sample rows
  const handleResetSample = useCallback(() => {
    cancelSearchRef.current = true;
    setIsDeepSearching(false);
    setIsFilteredFromDeepSearch(false);
    setDeepSearchKeyword("");
    setDeepSearchProgress(null);
    setDisplayedRows(sampleRows);
  }, [sampleRows]);

  // Export Parquet data as CSV
  const handleExportCsv = () => {
    if (columns.length === 0 || displayedRows.length === 0) return;

    const headers = columns.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(",");
    const csvRows = displayedRows.map((r) =>
      columns
        .map((c) => {
          const val = r[c.key];
          if (val === null || val === undefined) return "";
          const str = typeof val === "object" ? JSON.stringify(val) : String(val);
          return `"${str.replace(/"/g, '""')}"`;
        })
        .join(",")
    );

    const csvContent = [headers, ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${tab.name.replace(/\.parquet$/i, "")}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-vscode-textMuted bg-vscode-bg">
        <div className="p-6 max-w-md bg-vscode-sidebar border border-rose-500/40 rounded-xl flex flex-col items-center">
          <AlertCircle className="w-10 h-10 text-rose-400 mb-3" />
          <h3 className="text-sm font-semibold text-vscode-textBright mb-1">Parquet Parsing Error</h3>
          <p className="text-xs text-vscode-textMuted mb-2 leading-relaxed">{error}</p>
          <span className="text-[11px] text-vscode-textMuted/70">
            Please make sure this is a valid Apache Parquet column-oriented file.
          </span>
        </div>
      </div>
    );
  }

  const hasMoreRowsToLoad = fileInfo ? loadedRowsCount < fileInfo.numRows : false;

  return (
    <div className="w-full h-full flex flex-col bg-vscode-bg select-text overflow-hidden">
      {/* Top Parquet Metadata & Sub-tab Switcher */}
      <div className="h-10 px-3 bg-vscode-sidebar/95 border-b border-vscode-border/80 flex items-center justify-between text-xs text-vscode-textMuted flex-shrink-0 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1 text-[11px] font-medium text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded">
            <Database className="w-3.5 h-3.5" />
            <span>Apache Parquet</span>
          </div>

          {fileInfo && (
            <div className="hidden sm:flex items-center gap-2 text-[11px] text-vscode-textMuted">
              <span>•</span>
              <span className="text-vscode-textBright font-medium">
                {isFilteredFromDeepSearch ? (
                  <span className="text-sky-300">
                    Search Results: {displayedRows.length} matches
                  </span>
                ) : (
                  <span>
                    Sample: {loadedRowsCount.toLocaleString()} / {fileInfo.numRows.toLocaleString()} rows
                  </span>
                )}
              </span>
              <span>•</span>
              <span>{fileInfo.columnsMeta.length} columns</span>
              {fileInfo.numRowGroups > 0 && (
                <>
                  <span>•</span>
                  <span>{fileInfo.numRowGroups} groups</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* View Mode Toggle: Grid vs Schema */}
        <div className="flex items-center gap-1">
          <div className="flex items-center bg-vscode-bg/80 p-0.5 rounded border border-vscode-border/70 text-[11px]">
            <button
              onClick={() => setActiveSubTab("grid")}
              className={`px-2 py-0.5 rounded flex items-center gap-1.5 transition-all ${
                activeSubTab === "grid"
                  ? "bg-vscode-activityBarActive text-white font-medium shadow-xs"
                  : "text-vscode-textMuted hover:text-vscode-text hover:bg-white/5"
              }`}
              title="View Rows Grid"
            >
              <Table className="w-3 h-3" />
              <span>Rows Grid</span>
            </button>

            <button
              onClick={() => setActiveSubTab("schema")}
              className={`px-2 py-0.5 rounded flex items-center gap-1.5 transition-all ${
                activeSubTab === "schema"
                  ? "bg-vscode-activityBarActive text-white font-medium shadow-xs"
                  : "text-vscode-textMuted hover:text-vscode-text hover:bg-white/5"
              }`}
              title="Inspect Schema & Metadata"
            >
              <Layers className="w-3 h-3" />
              <span>Schema & Meta</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 min-w-0 relative overflow-hidden">
        {activeSubTab === "grid" ? (
          <DataTableViewer
            columns={columns}
            data={displayedRows}
            fileSize={tab.fileSize}
            totalRows={fileInfo?.numRows}
            isLoading={loading}
            emptyMessage={
              isFilteredFromDeepSearch
                ? `No matching rows found for "${deepSearchKeyword}" across the entire file.`
                : "No data rows found in this Parquet file"
            }
            onExportCsv={handleExportCsv}
            footerNotes={fileInfo?.createdBy ? `Writer: ${fileInfo.createdBy}` : undefined}
            onDeepSearch={handleDeepSearch}
            isDeepSearching={isDeepSearching}
            deepSearchProgress={deepSearchProgress}
            onResetSample={handleResetSample}
            isFilteredFromDeepSearch={isFilteredFromDeepSearch}
            extraToolbarAction={
              <div className="flex items-center gap-1.5">
                {/* Deep Search Indicator */}
                {isFilteredFromDeepSearch ? (
                  <div className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-sky-500/15 border border-sky-500/30 text-sky-300">
                    <Sparkles className="w-3 h-3" />
                    <span>
                      Match: "{deepSearchKeyword}" ({displayedRows.length})
                    </span>
                  </div>
                ) : (
                  hasMoreRowsToLoad && (
                    <div className="flex items-center gap-1">
                      {/* Load More Button */}
                      <button
                        onClick={() => handleLoadMore(1000)}
                        disabled={isLoadingMore}
                        className="h-7 px-2 rounded bg-vscode-bg hover:bg-white/10 border border-vscode-border text-vscode-text text-xs flex items-center gap-1 transition-colors shadow-xs"
                        title="Load next 1,000 rows into preview"
                      >
                        {isLoadingMore ? (
                          <Loader2 className="w-3 h-3 animate-spin text-vscode-activityBarActive" />
                        ) : (
                          <Plus className="w-3 h-3 text-vscode-activityBarActive" />
                        )}
                        <span>+1,000</span>
                      </button>

                      {/* Load All Button (if under 50k rows) */}
                      {fileInfo && fileInfo.numRows <= 50000 && (
                        <button
                          onClick={handleLoadAll}
                          disabled={isLoadingMore}
                          className="h-7 px-2 rounded bg-vscode-bg hover:bg-white/10 border border-vscode-border text-vscode-text text-xs flex items-center gap-1 transition-colors shadow-xs"
                          title={`Load all remaining ${(fileInfo.numRows - loadedRowsCount).toLocaleString()} rows`}
                        >
                          <span>Load All</span>
                        </button>
                      )}
                    </div>
                  )
                )}
              </div>
            }
          />
        ) : (
          <div className="w-full h-full overflow-y-auto p-6 space-y-6 max-w-4xl mx-auto">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3.5 bg-vscode-sidebar border border-vscode-border/70 rounded-xl flex flex-col">
                <span className="text-[11px] text-vscode-textMuted flex items-center gap-1 mb-1">
                  <Database className="w-3.5 h-3.5 text-violet-400" />
                  Total Rows
                </span>
                <span className="text-lg font-bold text-vscode-textBright font-mono">
                  {fileInfo?.numRows.toLocaleString() || 0}
                </span>
              </div>

              <div className="p-3.5 bg-vscode-sidebar border border-vscode-border/70 rounded-xl flex flex-col">
                <span className="text-[11px] text-vscode-textMuted flex items-center gap-1 mb-1">
                  <Table className="w-3.5 h-3.5 text-sky-400" />
                  Total Columns
                </span>
                <span className="text-lg font-bold text-vscode-textBright font-mono">
                  {fileInfo?.columnsMeta.length || 0}
                </span>
              </div>

              <div className="p-3.5 bg-vscode-sidebar border border-vscode-border/70 rounded-xl flex flex-col">
                <span className="text-[11px] text-vscode-textMuted flex items-center gap-1 mb-1">
                  <Box className="w-3.5 h-3.5 text-amber-400" />
                  Row Groups
                </span>
                <span className="text-lg font-bold text-vscode-textBright font-mono">
                  {fileInfo?.numRowGroups || 0}
                </span>
              </div>

              <div className="p-3.5 bg-vscode-sidebar border border-vscode-border/70 rounded-xl flex flex-col">
                <span className="text-[11px] text-vscode-textMuted flex items-center gap-1 mb-1">
                  <Info className="w-3.5 h-3.5 text-emerald-400" />
                  File Size
                </span>
                <span className="text-lg font-bold text-vscode-textBright font-mono">
                  {tab.fileSize ? `${(tab.fileSize / (1024 * 1024)).toFixed(2)} MB` : "Unknown"}
                </span>
              </div>
            </div>

            {/* Writer Application / Metadata Info */}
            {fileInfo?.createdBy && (
              <div className="px-4 py-2.5 bg-vscode-sidebar/50 border border-vscode-border/60 rounded-lg text-xs flex items-center gap-2">
                <span className="text-vscode-textMuted">Created By:</span>
                <span className="font-mono text-vscode-textBright bg-vscode-bg/80 px-2 py-0.5 rounded border border-vscode-border/40">
                  {fileInfo.createdBy}
                </span>
              </div>
            )}

            {/* Schema Table */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-vscode-textBright uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-vscode-activityBarActive" />
                <span>Column Schema Definitions</span>
              </h3>

              <div className="border border-vscode-border/80 rounded-xl overflow-hidden bg-vscode-sidebar">
                <table className="w-full text-left text-xs">
                  <thead className="bg-vscode-bg/80 border-b border-vscode-border/80 text-[11px] text-vscode-textMuted uppercase font-semibold">
                    <tr>
                      <th className="px-3.5 py-2.5">#</th>
                      <th className="px-3.5 py-2.5">Column Name</th>
                      <th className="px-3.5 py-2.5">Logical Type</th>
                      <th className="px-3.5 py-2.5">Physical Type</th>
                      <th className="px-3.5 py-2.5">Repetition</th>
                      <th className="px-3.5 py-2.5">Compression</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-vscode-border/40 font-mono">
                    {fileInfo?.columnsMeta.map((col, idx) => (
                      <tr key={col.name} className="hover:bg-white/5 transition-colors">
                        <td className="px-3.5 py-2 text-vscode-textMuted/60 text-[11px]">{idx + 1}</td>
                        <td className="px-3.5 py-2 text-vscode-textBright font-semibold">{col.name}</td>
                        <td className="px-3.5 py-2 text-sky-400 font-sans">
                          {col.logicalType ? (
                            <span className="px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/20 text-[11px]">
                              {col.logicalType}
                            </span>
                          ) : (
                            <span className="text-vscode-textMuted/50">-</span>
                          )}
                        </td>
                        <td className="px-3.5 py-2 text-amber-300/90 text-[11px]">{col.physicalType}</td>
                        <td className="px-3.5 py-2 text-vscode-textMuted text-[11px] font-sans">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] ${
                              col.repetitionType === "REQUIRED"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : "bg-vscode-border/40 text-vscode-textMuted"
                            }`}
                          >
                            {col.repetitionType}
                          </span>
                        </td>
                        <td className="px-3.5 py-2 text-violet-400 text-[11px]">
                          {col.compression || "UNCOMPRESSED"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
