import React from "react";
import { ChevronLeft } from "lucide-react";
import { useLayoutStore } from "../../stores/layoutStore";

interface SidebarContainerProps {
  children?: React.ReactNode;
}

export const SidebarContainer: React.FC<SidebarContainerProps> = ({ children }) => {
  const { sidebarWidth, isSidebarOpen, setSidebarOpen, activeSidebarTab } = useLayoutStore();

  if (!isSidebarOpen) return null;

  const titles: Record<string, string> = {
    explorer: "PROJECT EXPLORER",
    servers: "SSH SERVERS",
    transfers: "FILE TRANSFERS",
    settings: "PREFERENCES & SETTINGS",
  };

  return (
    <div
      style={{ width: `${sidebarWidth}px` }}
      className="h-full bg-vscode-sidebar flex flex-col flex-shrink-0 select-none overflow-hidden"
    >
      {/* Sidebar Header */}
      <div className="h-9 px-3 flex items-center justify-between border-b border-vscode-border/50 text-xs font-semibold tracking-wider text-vscode-textMuted uppercase">
        <span>{titles[activeSidebarTab] || "SIDEBAR"}</span>
        <button
          title="Collapse Sidebar"
          onClick={() => setSidebarOpen(false)}
          className="p-1 hover:text-vscode-textBright hover:bg-vscode-hover rounded"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Sidebar Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {children}
      </div>
    </div>
  );
};
