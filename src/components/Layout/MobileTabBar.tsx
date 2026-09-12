import React from "react";
import { FolderTree, FileCode, Terminal } from "lucide-react";
import { useLayoutStore, type MobileTab } from "../../stores/layoutStore";
import { useEditorStore } from "../../stores/editorStore";
import { useTerminalStore } from "../../stores/terminalStore";
import { useConnectionStore } from "../../stores/connectionStore";

export const MobileTabBar: React.FC = () => {
  const { mobileTab, setMobileTab } = useLayoutStore();
  const { tabs: editorTabs } = useEditorStore();
  const { sessions: terminalSessions } = useTerminalStore();
  const { activeServerId, serverStates } = useConnectionStore();

  const dirtyFilesCount = editorTabs.filter((f) => f.isDirty).length;
  const isConnected = activeServerId ? serverStates[activeServerId] === "connected" : false;

  const navItems: {
    id: MobileTab;
    label: string;
    icon: React.ReactNode;
    badge?: React.ReactNode;
  }[] = [
    {
      id: "workspace",
      label: "工作区",
      icon: <FolderTree className="w-4 h-4" />,
      badge: isConnected ? (
        <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" title="Connected" />
      ) : null,
    },
    {
      id: "editor",
      label: "编辑器",
      icon: <FileCode className="w-4 h-4" />,
      badge:
        dirtyFilesCount > 0
          ? dirtyFilesCount
          : editorTabs.length > 0
          ? editorTabs.length
          : null,
    },
    {
      id: "terminal",
      label: "终端",
      icon: <Terminal className="w-4 h-4" />,
      badge: terminalSessions.length > 0 ? terminalSessions.length : null,
    },
  ];

  return (
    <nav className="min-h-[50px] bg-vscode-sidebar border-t border-vscode-border flex items-center justify-around select-none z-40 flex-shrink-0 px-2 pb-[env(safe-area-inset-bottom,0px)] shadow-lg overflow-hidden">
      {navItems.map((item) => {
        const isActive = mobileTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setMobileTab(item.id)}
            className={`flex-1 py-1 max-w-[120px] flex flex-col items-center justify-center transition-all relative cursor-pointer ${
              isActive
                ? "text-vscode-activityBarActive font-medium"
                : "text-vscode-textMuted hover:text-vscode-textBright active:scale-95"
            }`}
          >
            <div
              className={`relative px-3.5 py-1 rounded-full transition-all flex items-center justify-center ${
                isActive
                  ? "bg-vscode-activityBarActive/15 text-vscode-activityBarActive shadow-2xs"
                  : "bg-transparent text-vscode-textMuted"
              }`}
            >
              {item.icon}
              {typeof item.badge === "number" && (
                <span className="absolute -top-1 -right-1 bg-vscode-selected text-white text-[9px] font-bold px-1 rounded-full min-w-[14px] text-center leading-3 ring-1 ring-vscode-sidebar">
                  {item.badge}
                </span>
              )}
              {typeof item.badge !== "number" && item.badge && (
                <span className="absolute -top-0.5 -right-0.5">{item.badge}</span>
              )}
            </div>
            <span
              className={`text-[10px] mt-0.5 leading-none transition-colors ${
                isActive ? "font-semibold text-vscode-activityBarActive" : "text-vscode-textMuted"
              }`}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
