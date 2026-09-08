import React from "react";
import { FolderTree, Server, Zap, ArrowLeftRight, Settings, TerminalSquare, CopyPlus } from "lucide-react";
import { useLayoutStore, SidebarTab } from "../../stores/layoutStore";
import { createNewWindow } from "../../utils/tauriBridge";

export const ActivityBar: React.FC = () => {
  const {
    activeSidebarTab,
    isSidebarOpen,
    toggleSidebarTab,
    isTerminalOpen,
    toggleTerminal,
  } = useLayoutStore();

  const navItems: { id: SidebarTab; label: string; icon: React.ReactNode }[] = [
    { id: "explorer", label: "Project Explorer (Ctrl+Shift+E)", icon: <FolderTree className="w-5 h-5" /> },
    { id: "servers", label: "SSH Servers (Ctrl+Shift+S)", icon: <Server className="w-5 h-5" /> },
    { id: "snippets", label: "Quick Inputs / 快捷命令 (Ctrl+Shift+K)", icon: <Zap className="w-5 h-5" /> },
    { id: "transfers", label: "File Transfers (Ctrl+Shift+T)", icon: <ArrowLeftRight className="w-5 h-5" /> },
  ];

  return (
    <aside className="w-12 bg-vscode-activityBar flex flex-col items-center py-2 justify-between border-r border-vscode-border flex-shrink-0 select-none z-30">
      <div className="flex flex-col gap-2 w-full items-center">
        {navItems.map((item) => {
          const isActive = isSidebarOpen && activeSidebarTab === item.id;
          return (
            <button
              key={item.id}
              title={item.label}
              onClick={() => toggleSidebarTab(item.id)}
              className={`p-2.5 rounded transition-colors relative w-10 h-10 flex items-center justify-center ${
                isActive
                  ? "text-vscode-textBright bg-vscode-hover"
                  : "text-vscode-textMuted hover:text-white hover:bg-vscode-hover"
              }`}
            >
              {isActive && (
                <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-vscode-activityBarActive rounded-r" />
              )}
              {item.icon}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 w-full items-center">
        <button
          title="New Window (Ctrl+Shift+N)"
          onClick={() => createNewWindow()}
          className="p-2.5 rounded transition-colors w-10 h-10 flex items-center justify-center text-vscode-textMuted hover:text-white hover:bg-vscode-hover"
        >
          <CopyPlus className="w-5 h-5" />
        </button>
        <button
          title="Toggle Terminal Panel (`)"
          onClick={toggleTerminal}
          className={`p-2.5 rounded transition-colors w-10 h-10 flex items-center justify-center ${
            isTerminalOpen
              ? "text-vscode-activityBarActive bg-vscode-hover"
              : "text-vscode-textMuted hover:text-white hover:bg-vscode-hover"
          }`}
        >
          <TerminalSquare className="w-5 h-5" />
        </button>
        <button
          title="Settings"
          onClick={() => toggleSidebarTab("settings")}
          className={`p-2.5 rounded transition-colors w-10 h-10 flex items-center justify-center ${
            isSidebarOpen && activeSidebarTab === "settings"
              ? "text-vscode-textBright bg-vscode-hover"
              : "text-vscode-textMuted hover:text-white hover:bg-vscode-hover"
          }`}
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </aside>
  );
};
