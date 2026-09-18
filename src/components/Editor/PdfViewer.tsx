import React, { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { EditorTab } from "../../stores/editorStore";
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  AlertCircle,
  Download,
  Loader2,
} from "lucide-react";

// Configure worker URL for pdfjs in Vite
if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

interface PdfViewerProps {
  tab: EditorTab;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ tab }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [rendering, setRendering] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [pageInput, setPageInput] = useState<string>("1");

  const renderTaskRef = useRef<any>(null);

  // Load PDF Document from binary base64
  useEffect(() => {
    let isMounted = true;

    async function loadPdf() {
      try {
        setLoading(true);
        setError(null);

        if (!tab.binaryBase64) {
          throw new Error("No binary PDF data received from server.");
        }

        const binString = atob(tab.binaryBase64);
        const len = binString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binString.charCodeAt(i);
        }

        const loadingTask = pdfjsLib.getDocument({
          data: bytes,
          cMapUrl: "https://unpkg.com/pdfjs-dist@6.3.289/cmaps/",
          cMapPacked: true,
        });

        const doc = await loadingTask.promise;

        if (isMounted) {
          setPdfDoc(doc);
          setTotalPages(doc.numPages);
          setCurrentPage(1);
          setPageInput("1");
          setLoading(false);
        }
      } catch (err: any) {
        console.error("Failed to load PDF document:", err);
        if (isMounted) {
          setError(err?.message || "Failed to load PDF document");
          setLoading(false);
        }
      }
    }

    loadPdf();

    return () => {
      isMounted = false;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {}
      }
    };
  }, [tab.binaryBase64, tab.path]);

  // Render current page onto canvas
  const renderPage = useCallback(
    async (pageNum: number, currentScale: number, currentRot: number) => {
      if (!pdfDoc || !canvasRef.current) return;

      try {
        setRendering(true);

        // Cancel previous render task if still in progress
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {}
        }

        const page = await pdfDoc.getPage(pageNum);
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const viewport = page.getViewport({ scale: currentScale, rotation: currentRot });

        // High DPI sharpness support
        const pixelRatio = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;

        await renderTask.promise;
        setRendering(false);
      } catch (err: any) {
        if (err?.name !== "RenderingCancelledException") {
          console.error("PDF page render error:", err);
        }
        setRendering(false);
      }
    },
    [pdfDoc]
  );

  // Trigger render when page, scale, or rotation changes
  useEffect(() => {
    if (pdfDoc && currentPage > 0) {
      renderPage(currentPage, scale, rotation);
    }
  }, [pdfDoc, currentPage, scale, rotation, renderPage]);

  // Navigation handlers
  const handlePrevPage = () => {
    if (currentPage > 1) {
      const next = currentPage - 1;
      setCurrentPage(next);
      setPageInput(String(next));
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      const next = currentPage + 1;
      setCurrentPage(next);
      setPageInput(String(next));
    }
  };

  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(pageInput, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
      setCurrentPage(parsed);
    } else {
      setPageInput(String(currentPage));
    }
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.2, 3.0));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.2, 0.4));
  };

  const handleResetZoom = () => {
    setScale(1.0);
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Fit Width
  const handleFitWidth = () => {
    if (!containerRef.current || !pdfDoc) return;
    pdfDoc.getPage(currentPage).then((page: any) => {
      const viewport = page.getViewport({ scale: 1.0, rotation });
      const containerWidth = containerRef.current?.clientWidth || 800;
      const targetScale = Math.max(0.4, (containerWidth - 64) / viewport.width);
      setScale(targetScale);
    });
  };

  // Download PDF
  const handleDownloadPdf = () => {
    if (!tab.binaryBase64) return;
    const binString = atob(tab.binaryBase64);
    const len = binString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = tab.name || "document.pdf";
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
          <h3 className="text-sm font-semibold text-vscode-textBright mb-1">PDF Loading Error</h3>
          <p className="text-xs text-vscode-textMuted mb-2 leading-relaxed">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-vscode-bg select-text overflow-hidden font-sans">
      {/* Top PDF Controls Toolbar */}
      <div className="h-10 px-3 bg-vscode-sidebar/95 border-b border-vscode-border/80 flex items-center justify-between text-xs text-vscode-textMuted flex-shrink-0 select-none">
        {/* Left: Document Badge */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded">
            <FileText className="w-3.5 h-3.5" />
            <span>PDF Document</span>
          </div>
          <span className="text-[11px] text-vscode-textBright font-medium truncate max-w-[200px]">
            {tab.name}
          </span>
        </div>

        {/* Center: Pagination controls */}
        {totalPages > 0 && (
          <div className="flex items-center gap-1 bg-vscode-bg/80 p-0.5 rounded border border-vscode-border/70 text-[11px]">
            <button
              onClick={handlePrevPage}
              disabled={currentPage <= 1}
              className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-vscode-text"
              title="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <form onSubmit={handlePageInputSubmit} className="flex items-center">
              <input
                type="text"
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onBlur={handlePageInputSubmit}
                aria-label="Current page number"
                className="w-10 h-5 px-1 bg-vscode-sidebar text-center text-vscode-textBright rounded border border-vscode-border/80 text-[11px] focus:outline-hidden focus:border-vscode-activityBarActive font-mono"
              />
              <span className="px-1.5 text-vscode-textMuted font-mono">/ {totalPages}</span>
            </form>

            <button
              onClick={handleNextPage}
              disabled={currentPage >= totalPages}
              className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-vscode-text"
              title="Next Page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Right: Zoom & Orientation actions */}
        <div className="flex items-center gap-1.5 text-[11px]">
          {/* Zoom buttons */}
          <div className="flex items-center bg-vscode-bg/80 p-0.5 rounded border border-vscode-border/70">
            <button
              onClick={handleZoomOut}
              disabled={scale <= 0.4}
              className="p-1 rounded hover:bg-white/10 disabled:opacity-30 text-vscode-text"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleResetZoom}
              className="px-1.5 text-[11px] font-mono text-vscode-text hover:text-vscode-textBright"
              title="Reset Zoom to 100%"
            >
              {Math.round(scale * 100)}%
            </button>

            <button
              onClick={handleZoomIn}
              disabled={scale >= 3.0}
              className="p-1 rounded hover:bg-white/10 disabled:opacity-30 text-vscode-text"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Fit Width */}
          <button
            onClick={handleFitWidth}
            className="h-7 px-2 rounded bg-vscode-bg/80 hover:bg-white/10 border border-vscode-border/70 text-vscode-text text-[11px] flex items-center gap-1"
            title="Fit Width"
          >
            <Maximize2 className="w-3 h-3 text-sky-400" />
            <span className="hidden md:inline">Fit Width</span>
          </button>

          {/* Rotate */}
          <button
            onClick={handleRotate}
            className="p-1.5 rounded bg-vscode-bg/80 hover:bg-white/10 border border-vscode-border/70 text-vscode-text"
            title="Rotate 90° Clockwise"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          {/* Download */}
          <button
            onClick={handleDownloadPdf}
            className="p-1.5 rounded bg-vscode-bg/80 hover:bg-white/10 border border-vscode-border/70 text-vscode-text"
            title="Download PDF"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
          </button>
        </div>
      </div>

      {/* Main Canvas Container with smooth scroll */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 min-w-0 overflow-auto bg-[#1e1e1e] flex items-center justify-center p-6 relative"
      >
        {loading && (
          <div className="flex flex-col items-center gap-3 text-vscode-textMuted">
            <Loader2 className="w-8 h-8 animate-spin text-rose-400" />
            <span className="text-xs">Loading PDF stream...</span>
          </div>
        )}

        <div
          className={`transition-opacity duration-200 ${
            loading ? "opacity-0" : "opacity-100"
          } flex items-center justify-center`}
        >
          {/* Paper Canvas Shadow Frame */}
          <div className="relative shadow-2xl rounded-sm overflow-hidden border border-neutral-800 bg-white">
            <canvas ref={canvasRef} className="block mx-auto" />
            {rendering && (
              <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-xs text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin text-rose-400" />
                <span>Rendering...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
