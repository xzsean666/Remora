import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search,
  Plus,
  Play,
  Copy,
  Pencil,
  Trash2,
  FolderPlus,
  Folder,
  ChevronDown,
  ChevronRight,
  Terminal,
  Sparkles,
  CornerDownLeft,
  Check,
  MoreVertical,
  Layers,
  Upload,
  Download,
} from "lucide-react";
import { useQuickSnippetStore } from "../../../stores/quickSnippetStore";
import { QuickSnippet } from "../../../utils/tauriBridge";
import { SnippetEditModal } from "./SnippetEditModal";
import { GroupModal } from "./GroupModal";
import { ImportSnippetModal } from "./ImportSnippetModal";

export const QuickInputPanel: React.FC = () => {
  const {
    snippets,
    loading,
    activeGroup,
    searchQuery,
    notification,
    loadSnippets,
    saveSnippet,
    deleteSnippet,
    renameGroup,
    deleteGroup,
    exportSnippets,
    importSnippets,
    setActiveGroup,
    setSearchQuery,
    sendToTerminal,
  } = useQuickSnippetStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFileName, setImportFileName] = useState("");
  const [importSnippetsList, setImportSnippetsList] = useState<QuickSnippet[]>([]);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [targetSnippet, setTargetSnippet] = useState<QuickSnippet | null>(null);
  const [modalInitialGroup, setModalInitialGroup] = useState<string | undefined>(undefined);

  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupModalMode, setGroupModalMode] = useState<"create" | "rename">("create");
  const [targetGroupName, setTargetGroupName] = useState("");

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeGroupMenu, setActiveGroupMenu] = useState<string | null>(null);

  useEffect(() => {
    loadSnippets();
  }, [loadSnippets]);

  // Derive distinct groups
  const groups = useMemo(() => {
    const set = new Set<string>();
    snippets.forEach((s) => {
      if (s.group_name) set.add(s.group_name);
    });
    return Array.from(set).sort();
  }, [snippets]);

  // Filter snippets based on active group & search query
  const filteredSnippets = useMemo(() => {
    return snippets.filter((s) => {
      const matchGroup = activeGroup === "ALL" || s.group_name === activeGroup;
      if (!matchGroup) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        s.title.toLowerCase().includes(q) ||
        s.command.toLowerCase().includes(q) ||
        (s.description && s.description.toLowerCase().includes(q))
      );
    });
  }, [snippets, activeGroup, searchQuery]);

  // Group filtered snippets by group name for presentation
  const groupedSnippets = useMemo(() => {
    const map = new Map<string, QuickSnippet[]>();
    filteredSnippets.forEach((s) => {
      const grp = s.group_name || "General";
      if (!map.has(grp)) map.set(grp, []);
      map.get(grp)!.push(s);
    });
    return map;
  }, [filteredSnippets]);

  const toggleGroupCollapse = (grp: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [grp]: !prev[grp] }));
  };

  const handleCopy = (snippet: QuickSnippet, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(snippet.command);
    setCopiedId(snippet.id);
    setTimeout(() => {
      setCopiedId((curr) => (curr === snippet.id ? null : curr));
    }, 1500);
  };

  const handleCreateSnippetInGroup = (grp?: string) => {
    setTargetSnippet(null);
    setModalInitialGroup(grp || (activeGroup !== "ALL" ? activeGroup : undefined));
    setEditModalOpen(true);
  };

  const handleEditSnippet = (snippet: QuickSnippet, e: React.MouseEvent) => {
    e.stopPropagation();
    setTargetSnippet(snippet);
    setModalInitialGroup(snippet.group_name);
    setEditModalOpen(true);
  };

  const handleDeleteSnippet = (snippet: QuickSnippet, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`确认删除快捷输入「${snippet.title}」吗？`)) {
      deleteSnippet(snippet.id);
    }
  };

  const handleOpenRenameGroup = (grp: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveGroupMenu(null);
    setTargetGroupName(grp);
    setGroupModalMode("rename");
    setGroupModalOpen(true);
  };

  const handleDeleteGroup = (grp: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveGroupMenu(null);
    if (confirm(`确认删除分组「${grp}」及其所属所有快捷输入吗？`)) {
      deleteGroup(grp);
    }
  };

  const handleConfirmGroupModal = async (name: string) => {
    if (groupModalMode === "create") {
      // Open snippet edit modal with this new group selected
      setTargetSnippet(null);
      setModalInitialGroup(name);
      setEditModalOpen(true);
    } else {
      await renameGroup(targetGroupName, name);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        const rawList = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed.snippets)
          ? parsed.snippets
          : [];

        if (rawList.length === 0) {
          useQuickSnippetStore.getState().setNotification({
            message: "未在文件中识别出快捷输入数据，请确认文件格式",
            type: "error",
          });
          return;
        }

        const now = Date.now();
        const validSnippets: QuickSnippet[] = [];

        rawList.forEach((item: any, idx: number) => {
          if (item && typeof item === "object") {
            const title = String(item.title || "").trim();
            const command = String(item.command || "").trim();
            if (title && command) {
              validSnippets.push({
                id: item.id || `snip-imported-${now}-${idx}`,
                title,
                command,
                group_name: String(item.group_name || "Imported").trim() || "Imported",
                auto_execute: item.auto_execute !== false,
                description: item.description ? String(item.description).trim() : null,
                sort_order: typeof item.sort_order === "number" ? item.sort_order : idx,
                created_at: typeof item.created_at === "number" ? item.created_at : now,
                updated_at: now,
              });
            }
          }
        });

        if (validSnippets.length === 0) {
          useQuickSnippetStore.getState().setNotification({
            message: "文件中缺少有效的 title 与 command 字段",
            type: "error",
          });
          return;
        }

        setImportFileName(file.name);
        setImportSnippetsList(validSnippets);
        setImportModalOpen(true);
      } catch (err: any) {
        console.error("Failed to parse JSON snippet file:", err);
        useQuickSnippetStore.getState().setNotification({
          message: `JSON 解析失败: ${err?.message || "格式不合法"}`,
          type: "error",
        });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="w-full h-full flex flex-col bg-vscode-sidebar text-vscode-text overflow-hidden select-none">
      {/* Hidden File Input for JSON Import */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".json,application/json"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Top Floating Notification Feedback */}
      {notification && (
        <div
          className={`px-3 py-1.5 text-xs font-medium flex items-center justify-between border-b animate-fadeIn z-20 flex-shrink-0 ${
            notification.type === "success"
              ? "bg-emerald-950/80 text-emerald-200 border-emerald-600/40"
              : notification.type === "warning"
              ? "bg-amber-950/80 text-amber-200 border-amber-600/40"
              : notification.type === "error"
              ? "bg-rose-950/80 text-rose-200 border-rose-600/40"
              : "bg-blue-950/80 text-blue-200 border-blue-600/40"
          }`}
        >
          <span className="truncate pr-2">{notification.message}</span>
        </div>
      )}

      {/* Control Bar: Search & Action Buttons */}
      <div className="p-2 border-b border-vscode-border/60 flex flex-col gap-2 flex-shrink-0 bg-vscode-sidebar/80">
        <div className="flex items-center gap-1.5">
          {/* Search Bar */}
          <div className="flex-1 relative flex items-center min-w-0">
            <Search className="w-3.5 h-3.5 absolute left-2 text-vscode-textMuted pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索快捷命令 (Search)..."
              className="w-full pl-7 pr-2 py-1 bg-vscode-input border border-vscode-border rounded text-xs text-vscode-text placeholder:text-vscode-textMuted/60 focus:outline-hidden focus:border-vscode-activityBarActive transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-1.5 text-vscode-textMuted hover:text-white text-[10px] px-1"
              >
                ✕
              </button>
            )}
          </div>

          {/* New Snippet Button */}
          <button
            onClick={() => handleCreateSnippetInGroup()}
            title="新建快捷输入 (Add Snippet)"
            className="p-1.5 rounded bg-vscode-activityBarActive hover:bg-vscode-activityBarActive/90 text-white transition-colors flex items-center justify-center flex-shrink-0 cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          {/* New Group Button */}
          <button
            onClick={() => {
              setGroupModalMode("create");
              setTargetGroupName("");
              setGroupModalOpen(true);
            }}
            title="新建分组 (New Group)"
            className="p-1.5 rounded hover:bg-vscode-hover text-vscode-textMuted hover:text-white border border-vscode-border transition-colors flex items-center justify-center flex-shrink-0 cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>

          {/* Import JSON Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            title="从 JSON 文件批量导入 (Import)"
            className="p-1.5 rounded hover:bg-vscode-hover text-vscode-textMuted hover:text-white border border-vscode-border transition-colors flex items-center justify-center flex-shrink-0 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
          </button>

          {/* Export JSON Button */}
          <button
            onClick={() => exportSnippets(activeGroup)}
            title="导出为 JSON 文件 (Export)"
            className="p-1.5 rounded hover:bg-vscode-hover text-vscode-textMuted hover:text-white border border-vscode-border transition-colors flex items-center justify-center flex-shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Group Filter Chips Bar */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
          <button
            onClick={() => setActiveGroup("ALL")}
            className={`px-2 py-0.5 rounded-full text-[11px] font-medium flex-shrink-0 transition-colors flex items-center gap-1 cursor-pointer ${
              activeGroup === "ALL"
                ? "bg-vscode-activityBarActive text-white"
                : "bg-vscode-hover/70 text-vscode-textMuted hover:text-vscode-textBright"
            }`}
          >
            <Layers className="w-2.5 h-2.5" />
            <span>全部 ({snippets.length})</span>
          </button>

          {groups.map((grp) => {
            const count = snippets.filter((s) => s.group_name === grp).length;
            const isSelected = activeGroup === grp;
            return (
              <button
                key={grp}
                onClick={() => setActiveGroup(grp)}
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium flex-shrink-0 transition-colors flex items-center gap-1 cursor-pointer ${
                  isSelected
                    ? "bg-vscode-activityBarActive text-white"
                    : "bg-vscode-hover/70 text-vscode-textMuted hover:text-vscode-textBright"
                }`}
              >
                <Folder className="w-2.5 h-2.5" />
                <span>{grp}</span>
                <span className="text-[9px] opacity-75">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Snippet List Container */}
      <div className="flex-1 overflow-y-auto p-2 min-h-0 flex flex-col gap-3">
        {loading ? (
          <div className="p-4 text-center text-xs text-vscode-textMuted">加载快捷命令中...</div>
        ) : filteredSnippets.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-vscode-textMuted">
            <Terminal className="w-8 h-8 text-vscode-textMuted/40 mb-2" />
            <p className="text-xs mb-1">未找到快捷输入</p>
            <p className="text-[11px] text-vscode-textMuted/70 mb-3">
              {searchQuery ? "换个关键词搜搜看" : "点击下方按钮创建第一个快捷输入"}
            </p>
            <button
              onClick={() => handleCreateSnippetInGroup()}
              className="px-3 py-1.5 rounded bg-vscode-activityBarActive text-white text-xs font-medium hover:bg-vscode-activityBarActive/90 transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              新建快捷输入
            </button>
          </div>
        ) : (
          Array.from(groupedSnippets.entries()).map(([grp, items]) => {
            const isCollapsed = collapsedGroups[grp];
            const isMenuOpen = activeGroupMenu === grp;

            return (
              <div key={grp} className="flex flex-col gap-1.5">
                {/* Group Accordion Header */}
                <div className="flex items-center justify-between px-2 py-1 bg-vscode-hover/40 rounded text-xs font-semibold text-vscode-textMuted hover:text-vscode-textBright transition-colors group">
                  <div
                    onClick={() => toggleGroupCollapse(grp)}
                    className="flex items-center gap-1.5 cursor-pointer flex-1 min-w-0"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                    <Folder className="w-3.5 h-3.5 text-amber-400/80 flex-shrink-0" />
                    <span className="truncate">{grp}</span>
                    <span className="text-[10px] text-vscode-textMuted font-normal">
                      ({items.length})
                    </span>
                  </div>

                  {/* Group Action Tools */}
                  <div className="flex items-center gap-1 relative">
                    <button
                      title={`在「${grp}」分组中添加快捷输入`}
                      onClick={() => handleCreateSnippetInGroup(grp)}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-vscode-hover text-vscode-textMuted hover:text-white transition-all cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>

                    <button
                      title="分组操作"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveGroupMenu(isMenuOpen ? null : grp);
                      }}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-vscode-hover text-vscode-textMuted hover:text-white transition-all cursor-pointer"
                    >
                      <MoreVertical className="w-3 h-3" />
                    </button>

                    {/* Popover Dropdown Menu */}
                    {isMenuOpen && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-full mt-1 z-30 w-32 bg-vscode-bg border border-vscode-border rounded shadow-xl py-1 text-xs"
                      >
                        <button
                          onClick={(e) => handleOpenRenameGroup(grp, e)}
                          className="w-full px-2.5 py-1 text-left text-vscode-text hover:bg-vscode-hover hover:text-white flex items-center gap-1.5"
                        >
                          <Pencil className="w-3 h-3" />
                          重命名分组
                        </button>
                        <button
                          onClick={(e) => handleDeleteGroup(grp, e)}
                          className="w-full px-2.5 py-1 text-left text-red-400 hover:bg-red-950/50 hover:text-red-300 flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3 h-3" />
                          删除分组
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Snippets in this Group */}
                {!isCollapsed && (
                  <div className="flex flex-col gap-1.5 pl-2">
                    {items.map((snippet) => {
                      const isCopied = copiedId === snippet.id;

                      return (
                        <div
                          key={snippet.id}
                          className="group relative flex flex-col p-2.5 bg-vscode-bg/80 hover:bg-vscode-hover/50 border border-vscode-border/80 rounded-md transition-all shadow-2xs"
                        >
                          {/* Top Row: Title, Badges, Hover Actions */}
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <span className="font-semibold text-xs text-vscode-textBright truncate">
                                {snippet.title}
                              </span>

                              {/* Auto-execute status pill */}
                              {snippet.auto_execute ? (
                                <span
                                  title="自动回车执行 (点击即运行)"
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-medium bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 flex-shrink-0"
                                >
                                  <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                                  回车执行
                                </span>
                              ) : (
                                <span
                                  title="仅键入命令 (不按回车)"
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-medium bg-sky-950/70 border border-sky-500/40 text-sky-300 flex-shrink-0"
                                >
                                  仅填入
                                </span>
                              )}
                            </div>

                            {/* Quick Actions */}
                            <div className="flex items-center gap-0.5">
                              {/* Send / Run Button */}
                              <button
                                title={
                                  snippet.auto_execute
                                    ? "输入并执行 (Send & Execute)"
                                    : "填充至终端 (Insert into Terminal)"
                                }
                                onClick={() =>
                                  sendToTerminal(snippet.command, snippet.auto_execute)
                                }
                                className="p-1 rounded text-emerald-400 hover:text-emerald-200 hover:bg-emerald-950/80 transition-colors flex items-center justify-center cursor-pointer"
                              >
                                <Play className="w-3 h-3 fill-current" />
                              </button>

                              {/* Insert without Enter Button */}
                              {snippet.auto_execute && (
                                <button
                                  title="仅填充至终端 (不执行回车，方便修改参数)"
                                  onClick={() => sendToTerminal(snippet.command, false)}
                                  className="p-1 rounded text-sky-400 hover:text-sky-200 hover:bg-sky-950/80 transition-colors flex items-center justify-center cursor-pointer"
                                >
                                  <CornerDownLeft className="w-3 h-3" />
                                </button>
                              )}

                              {/* Copy to Clipboard */}
                              <button
                                title={isCopied ? "已复制!" : "复制命令"}
                                onClick={(e) => handleCopy(snippet, e)}
                                className={`p-1 rounded transition-colors flex items-center justify-center cursor-pointer ${
                                  isCopied
                                    ? "text-emerald-400 bg-emerald-950/60"
                                    : "text-vscode-textMuted hover:text-white hover:bg-vscode-hover"
                                }`}
                              >
                                {isCopied ? (
                                  <Check className="w-3 h-3" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>

                              {/* Edit Button */}
                              <button
                                title="编辑快捷输入"
                                onClick={(e) => handleEditSnippet(snippet, e)}
                                className="p-1 rounded text-vscode-textMuted hover:text-white hover:bg-vscode-hover transition-colors flex items-center justify-center cursor-pointer"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>

                              {/* Delete Button */}
                              <button
                                title="删除"
                                onClick={(e) => handleDeleteSnippet(snippet, e)}
                                className="p-1 rounded text-vscode-textMuted hover:text-red-400 hover:bg-red-950/40 transition-colors flex items-center justify-center cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {/* Command Box - Clicking inputs into terminal */}
                          <div
                            onClick={() => sendToTerminal(snippet.command, snippet.auto_execute)}
                            title="点击直接输入至终端"
                            className="p-2 bg-[#121212] border border-vscode-border/50 hover:border-vscode-activityBarActive/80 rounded font-mono text-[11px] text-vscode-textBright cursor-pointer overflow-x-auto scrollbar-none transition-colors group/cmd"
                          >
                            <div className="flex items-start gap-1.5">
                              <span className="text-emerald-500 font-bold select-none">$</span>
                              <pre className="whitespace-pre-wrap break-all font-mono leading-tight flex-1">
                                {snippet.command}
                              </pre>
                            </div>
                          </div>

                          {/* Description Footer */}
                          {snippet.description && (
                            <p className="mt-1 text-[10px] text-vscode-textMuted/70 italic truncate">
                              {snippet.description}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modals */}
      <SnippetEditModal
        isOpen={editModalOpen}
        snippet={targetSnippet}
        existingGroups={groups}
        initialGroup={modalInitialGroup}
        onClose={() => setEditModalOpen(false)}
        onSave={saveSnippet}
      />

      <GroupModal
        isOpen={groupModalOpen}
        mode={groupModalMode}
        initialGroupName={targetGroupName}
        onClose={() => setGroupModalOpen(false)}
        onConfirm={handleConfirmGroupModal}
      />

      <ImportSnippetModal
        isOpen={importModalOpen}
        fileName={importFileName}
        parsedSnippets={importSnippetsList}
        onClose={() => setImportModalOpen(false)}
        onConfirm={async (snippets, overwrite) => {
          await importSnippets(snippets, overwrite);
        }}
      />
    </div>
  );
};
