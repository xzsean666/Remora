import React, { useMemo, useState } from "react";
import Papa from "papaparse";
import { DataTableViewer, type ColumnDef } from "./DataTableViewer";
import type { EditorTab } from "../../stores/editorStore";
import { AlertCircle, FileSpreadsheet } from "lucide-react";

interface CsvViewerProps {
  tab: EditorTab;
}

export const CsvViewer: React.FC<CsvViewerProps> = ({ tab }) => {
  const [parseError, setParseError] = useState<string | null>(null);

  // Parse CSV content using PapaParse
  const { columns, data, delimiter } = useMemo(() => {
    if (!tab.content) {
      return { columns: [], data: [], delimiter: "," };
    }

    try {
      const parsed = Papa.parse<Record<string, any>>(tab.content, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: "greedy",
      });

      if (parsed.errors && parsed.errors.length > 0 && parsed.data.length === 0) {
        setParseError(parsed.errors[0]?.message || "Failed to parse CSV format");
        return { columns: [], data: [], delimiter: "," };
      }

      setParseError(null);

      const fieldNames = parsed.meta.fields || [];
      const inferredColumns: ColumnDef[] = fieldNames.map((name) => {
        // Detect common data type based on first few non-null values
        let detectedType = "string";
        for (let i = 0; i < Math.min(20, parsed.data.length); i++) {
          const val = parsed.data[i]?.[name];
          if (val !== null && val !== undefined) {
            if (typeof val === "number") detectedType = "number";
            else if (typeof val === "boolean") detectedType = "boolean";
            else if (typeof val === "object") detectedType = "json";
            break;
          }
        }

        return {
          key: name,
          label: name,
          type: detectedType,
        };
      });

      return {
        columns: inferredColumns,
        data: parsed.data,
        delimiter: parsed.meta.delimiter || ",",
      };
    } catch (e: any) {
      setParseError(e?.message || "Error parsing CSV file");
      return { columns: [], data: [], delimiter: "," };
    }
  }, [tab.content]);

  // Handle Export CSV
  const handleExportCsv = () => {
    const blob = new Blob([tab.content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", tab.name || "export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (parseError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-vscode-textMuted bg-vscode-bg">
        <div className="p-6 max-w-md bg-vscode-sidebar border border-rose-500/40 rounded-xl flex flex-col items-center">
          <AlertCircle className="w-10 h-10 text-rose-400 mb-3" />
          <h3 className="text-sm font-semibold text-vscode-textBright mb-1">CSV Parsing Error</h3>
          <p className="text-xs text-vscode-textMuted mb-4 leading-relaxed">{parseError}</p>
          <span className="text-[11px] text-vscode-textMuted/70">
            You can switch to Source Code mode to inspect and fix raw formatting issues.
          </span>
        </div>
      </div>
    );
  }

  const delimiterName =
    delimiter === "\t" ? "TSV (Tab)" : delimiter === ";" ? "Semicolon (;)" : delimiter === "|" ? "Pipe (|)" : "CSV (Comma)";

  return (
    <DataTableViewer
      columns={columns}
      data={data}
      fileSize={tab.fileSize || tab.content.length}
      emptyMessage="This CSV file is empty or contains only empty rows"
      onExportCsv={handleExportCsv}
      footerNotes={`Format: ${delimiterName}`}
      extraToolbarAction={
        <div className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
          <FileSpreadsheet className="w-3 h-3" />
          <span>{delimiterName}</span>
        </div>
      }
    />
  );
};
