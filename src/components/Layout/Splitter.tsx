import React, { useEffect, useRef, useState } from "react";

interface SplitterProps {
  direction: "horizontal" | "vertical";
  onDrag: (delta: number) => void;
  className?: string;
}

export const Splitter: React.FC<SplitterProps> = ({ direction, onDrag, className = "" }) => {
  const [isDragging, setIsDragging] = useState(false);
  const startPosRef = useRef<number>(0);
  const onDragRef = useRef(onDrag);
  onDragRef.current = onDrag;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startPosRef.current = direction === "horizontal" ? e.clientX : e.clientY;
    document.body.style.userSelect = "none";
    document.body.style.cursor = direction === "horizontal" ? "col-resize" : "row-resize";
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const currentPos = direction === "horizontal" ? e.clientX : e.clientY;
      const delta = currentPos - startPosRef.current;
      startPosRef.current = currentPos;
      onDragRef.current(delta);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [isDragging, direction]);

  if (direction === "horizontal") {
    return (
      <div
        onMouseDown={handleMouseDown}
        className={`w-1 hover:w-1 cursor-col-resize flex-shrink-0 transition-colors z-20 ${
          isDragging ? "bg-vscode-activityBarActive" : "bg-vscode-border hover:bg-vscode-activityBarActive"
        } ${className}`}
        title="Drag to resize sidebar"
      />
    );
  }

  return (
    <div
      onMouseDown={handleMouseDown}
      className={`h-1 hover:h-1 cursor-row-resize flex-shrink-0 transition-colors z-20 ${
        isDragging ? "bg-vscode-activityBarActive" : "bg-vscode-border hover:bg-vscode-activityBarActive"
      } ${className}`}
      title="Drag to resize terminal panel"
    />
  );
};
