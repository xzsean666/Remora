import React from "react";
import { ChevronLeft } from "lucide-react";
import { useLayoutStore } from "../../stores/layoutStore";

interface SidebarContainerProps {
  children?: React.ReactNode;
}

export const SidebarContainer: React.FC<SidebarContainerProps> = ({ children }) => {
  const { sidebarWidth, isSidebarOpen, setSidebarOpen, activeSidebarTab, isMobile } = useLayoutStore();

  if (!isSidebarOpen && !isMobile) return null;

  const titles: Record<string, string> = {
    explorer: "PROJECT EXPLORER",
    git: "SOURCE CONTROL (GIT)",
    servers: "SSH SERVERS",
    snippets: "QUICK INPUTS (快捷输入)",
    transfers: "FILE TRANSFERS",
    settings: "PREFERENCES & SETTINGS",
  };

  return (
    <div
      style={isMobile ? undefined : { width: `${sidebarWidth}px` }}
      className={`h-full bg-vscode-sidebar flex flex-col flex-shrink-0 select-none overflow-hidden ${
        isMobile ? "w-full flex-1 min-w-0" : ""
      }`}
    >
      {/* Sidebar Header */}
      <div className="h-9 px-3 flex items-center justify-between border-b border-vscode-border/50 text-xs font-semibold tracking-wider text-vscode-textMuted uppercase flex-shrink-0">
        <span className="truncate min-w-0 mr-1">{titles[activeSidebarTab] || "SIDEBAR"}</span>
        {!isMobile && (
          <button
            title="Collapse Sidebar"
            onClick={() => setSidebarOpen(false)}
            className="p-1 hover:text-vscode-textBright hover:bg-vscode-hover rounded flex-shrink-0 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Sidebar Content (Managed by sub-panels) */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
};
