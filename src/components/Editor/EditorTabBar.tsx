import React, { useState } from "react";
import { X, Circle, Save, Check } from "lucide-react";
import { useEditorStore } from "../../stores/editorStore";
import { useLayoutStore } from "../../stores/layoutStore";
import { getFileIcon } from "../../utils/fileIcons";

export const EditorTabBar: React.FC = () => {
  const { tabs, activeTabPath, setActiveTab, closeTab, pinTab, saveActiveFile } = useEditorStore();
  const { isMobile } = useLayoutStore();
  const [isSavedRecently, setIsSavedRecently] = useState(false);

  if (tabs.length === 0) return null;

  const activeTab = tabs.find((t) => t.path === activeTabPath);

  const handleSave = async () => {
    const success = await saveActiveFile();
    if (success) {
      setIsSavedRecently(true);
      setTimeout(() => setIsSavedRecently(false), 1500);
    }
  };

  return (
    <div className="h-9 bg-[#252526] border-b border-vscode-border/80 flex items-center justify-between select-none flex-shrink-0">
      <div className="flex items-center overflow-x-auto overflow-y-hidden scrollbar-none flex-1 h-full">
        {tabs.map((tab) => {
          const isActive = tab.path === activeTabPath;

          return (
            <div
              key={tab.path}
              onClick={() => setActiveTab(tab.path)}
              onDoubleClick={() => pinTab(tab.path)}
              onAuxClick={(e) => {
                if (e.button === 1) {
                  e.preventDefault();
                  closeTab(tab.path);
                }
              }}
              title={tab.path}
              className={`group h-full flex items-center px-3 border-r border-vscode-border/50 cursor-pointer min-w-[120px] max-w-[200px] relative transition-colors ${
                isActive
                  ? "bg-vscode-bg text-vscode-textBright border-t-2 border-t-vscode-activityBarActive font-medium"
                  : "bg-[#2d2d2d] text-vscode-text hover:bg-vscode-bg/60 border-t-2 border-t-transparent"
              }`}
            >
              {/* File Icon */}
              <span className="mr-2 flex items-center flex-shrink-0">
                {getFileIcon(tab.name, false, false)}
              </span>

              {/* File Name */}
              <span
                className={`truncate text-xs flex-1 min-w-0 ${
                  tab.isPreview ? "italic opacity-85" : ""
                }`}
              >
                {tab.name}
              </span>

              {/* Dirty or Close action */}
              <div className="ml-2 w-4 h-4 flex items-center justify-center flex-shrink-0">
                {tab.isDirty ? (
                  <>
                    <Circle className="w-2 h-2 fill-current text-vscode-textBright group-hover:hidden" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(tab.path);
                      }}
                      className="hidden group-hover:flex items-center justify-center p-0.5 rounded hover:bg-vscode-hover hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.path);
                    }}
                    className="opacity-0 group-hover:opacity-100 flex items-center justify-center p-0.5 rounded hover:bg-vscode-hover hover:text-white transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {activeTab && (
        <div className="flex items-center px-2 flex-shrink-0 gap-1 border-l border-vscode-border/40">
          <button
            onClick={handleSave}
            title={activeTab.isDirty ? "Save file (Ctrl+S)" : "File is saved"}
            disabled={!activeTab.isDirty && !isSavedRecently}
            className={`px-2 py-1 rounded text-xs flex items-center gap-1 transition-all ${
              isSavedRecently
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                : activeTab.isDirty
                ? "bg-vscode-activityBarActive text-white hover:brightness-110 font-medium shadow-xs"
                : "text-vscode-textMuted/50 opacity-60 cursor-default"
            }`}
          >
            {isSavedRecently ? (
              <>
                <Check className="w-3 h-3" />
                <span className="text-[10px]">Saved</span>
              </>
            ) : (
              <>
                <Save className="w-3 h-3" />
                {isMobile && <span className="text-[10px]">保存</span>}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
