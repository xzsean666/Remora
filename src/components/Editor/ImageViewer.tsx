import React, { useState, useRef, useEffect } from "react";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Code2,
  FileImage,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { type EditorTab, useEditorStore } from "../../stores/editorStore";

interface ImageViewerProps {
  tab: EditorTab;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({ tab }) => {
  const { toggleSvgViewMode, openFile } = useEditorStore();

  const [zoom, setZoom] = useState<number>(1);
  const [isFit, setIsFit] = useState<boolean>(true);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ startX: number; startY: number; initPanX: number; initPanY: number }>({
    startX: 0,
    startY: 0,
    initPanX: 0,
    initPanY: 0,
  });

  // Reset view states when switching to a different image tab
  useEffect(() => {
    setZoom(1);
    setIsFit(true);
    setPan({ x: 0, y: 0 });
    setHasError(false);
  }, [tab.path]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalSize({
      width: img.naturalWidth,
      height: img.naturalHeight,
    });
    setHasError(false);
  };

  const handleZoomIn = () => {
    setIsFit(false);
    setZoom((prev) => Math.min(10, Math.round((prev * 1.25) * 100) / 100));
  };

  const handleZoomOut = () => {
    setIsFit(false);
    setZoom((prev) => Math.max(0.1, Math.round((prev / 1.25) * 100) / 100));
  };

  const handleResetZoom = () => {
    setIsFit(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleFitToggle = () => {
    setIsFit(true);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Wheel zoom handling
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.85;
    setIsFit(false);
    setZoom((prev) => Math.max(0.1, Math.min(10, Math.round(prev * factor * 100) / 100)));
  };

  // Drag pan handling
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click drags
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initPanX: pan.x,
      initPanY: pan.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;
    setPan({
      x: dragStartRef.current.initPanX + deltaX,
      y: dragStartRef.current.initPanY + deltaY,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes || bytes <= 0) return "Unknown size";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const isSvg = tab.mimeType?.includes("svg") || tab.path.toLowerCase().endsWith(".svg");

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col bg-[#1e1e1e] relative overflow-hidden select-none"
      onWheel={handleWheel}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Top Floating Control Toolbar */}
      <div className="absolute top-3 right-4 z-30 flex items-center gap-1 px-2 py-1 bg-vscode-sidebar/85 backdrop-blur-md border border-vscode-border/80 rounded-lg shadow-xl text-vscode-textBright">
        {isSvg && (
          <>
            <button
              onClick={() => toggleSvgViewMode(tab.path)}
              title="Switch to SVG Source Code View"
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-vscode-activityBarActive hover:bg-vscode-hover transition-colors font-medium mr-1 border-r border-vscode-border/50 pr-2.5"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Source</span>
            </button>
          </>
        )}

        <button
          onClick={handleZoomOut}
          title="Zoom Out (-)"
          className="p-1.5 rounded hover:bg-vscode-hover hover:text-white transition-colors"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleResetZoom}
          title="Reset to 100% (1:1)"
          className={`px-1.5 py-0.5 rounded text-[11px] font-mono hover:bg-vscode-hover transition-colors ${
            !isFit && zoom === 1 ? "text-vscode-activityBarActive font-semibold" : "text-vscode-textMuted"
          }`}
        >
          100%
        </button>

        <button
          onClick={handleZoomIn}
          title="Zoom In (+)"
          className="p-1.5 rounded hover:bg-vscode-hover hover:text-white transition-colors"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        <div className="w-[1px] h-3.5 bg-vscode-border/60 mx-1" />

        <button
          onClick={handleFitToggle}
          title="Fit Image to Window"
          className={`p-1.5 rounded hover:bg-vscode-hover transition-colors ${
            isFit ? "text-vscode-activityBarActive" : "text-vscode-textMuted hover:text-white"
          }`}
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => {
            setZoom(1);
            setIsFit(true);
            setPan({ x: 0, y: 0 });
          }}
          title="Reset View"
          className="p-1.5 rounded hover:bg-vscode-hover hover:text-white text-vscode-textMuted transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Image Viewport Area with Checkerboard Background */}
      <div
        onMouseDown={handleMouseDown}
        className={`flex-1 min-h-0 w-full relative overflow-hidden flex items-center justify-center p-6 ${
          isDragging ? "cursor-grabbing" : isFit ? "cursor-default" : "cursor-grab"
        }`}
        style={{
          backgroundColor: "#181818",
          backgroundImage: `
            linear-gradient(45deg, #202020 25%, transparent 25%),
            linear-gradient(-45deg, #202020 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #202020 75%),
            linear-gradient(-45deg, transparent 75%, #202020 75%)
          `,
          backgroundSize: "20px 20px",
          backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
        }}
      >
        {hasError ? (
          <div className="flex flex-col items-center gap-3 p-6 bg-vscode-sidebar/90 border border-rose-500/40 rounded-xl shadow-xl text-rose-300 max-w-sm text-center">
            <AlertCircle className="w-8 h-8 text-rose-400" />
            <div>
              <h4 className="text-sm font-semibold text-rose-200">Unable to preview image</h4>
              <p className="text-xs text-rose-300/80 mt-1">
                The image file could not be decoded or is corrupted.
              </p>
            </div>
            <button
              onClick={() => openFile(tab.serverId, tab.path, tab.isPreview)}
              className="mt-2 flex items-center gap-1.5 px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 rounded text-xs font-medium transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        ) : tab.imageDataUrl ? (
          <div
            className="transition-transform duration-75 ease-out select-none flex items-center justify-center pointer-events-none"
            style={{
              transform: isFit
                ? undefined
                : `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "center center",
            }}
          >
            <img
              src={tab.imageDataUrl}
              alt={tab.name}
              onLoad={handleImageLoad}
              onError={() => setHasError(true)}
              className={`select-none shadow-2xl rounded-xs pointer-events-auto ${
                isFit
                  ? "max-w-[calc(100vw-80px)] max-h-[calc(100vh-140px)] w-auto h-auto object-contain"
                  : ""
              }`}
              style={{
                imageRendering: zoom > 2 ? "pixelated" : "auto",
              }}
              draggable={false}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-vscode-textMuted">
            <FileImage className="w-8 h-8 text-vscode-textMuted/40 animate-pulse" />
            <span className="text-xs">Loading image...</span>
          </div>
        )}
      </div>

      {/* Bottom Image Metadata Status Bar */}
      <div className="h-6 px-3 bg-vscode-statusbar/95 border-t border-vscode-border/50 text-[11px] text-vscode-textMuted flex items-center justify-between select-none flex-shrink-0 z-20">
        <div className="flex items-center gap-3 truncate">
          <span className="truncate font-medium text-vscode-textBright">{tab.name}</span>
          {naturalSize && (
            <span className="font-mono text-vscode-textMuted">
              {naturalSize.width} × {naturalSize.height} px
            </span>
          )}
          <span className="font-mono text-vscode-textMuted">{formatFileSize(tab.fileSize)}</span>
        </div>

        <div className="flex items-center gap-3 font-mono flex-shrink-0">
          {tab.mimeType && (
            <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-vscode-bg/60 text-vscode-textMuted">
              {tab.mimeType.split("/").pop()}
            </span>
          )}
          <span className="text-vscode-textBright">
            {isFit ? "Fit" : `${Math.round(zoom * 100)}%`}
          </span>
        </div>
      </div>
    </div>
  );
};
