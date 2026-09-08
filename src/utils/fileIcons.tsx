import React from "react";
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  FileJson,
  FileTerminal,
  Settings,
  ShieldAlert,
  File,
  Boxes,
} from "lucide-react";

export function getFileIcon(fileName: string, isDir: boolean, isOpen: boolean): React.ReactNode {
  if (isDir) {
    if (fileName === ".git") {
      return <Boxes className="w-4 h-4 text-orange-500 flex-shrink-0" />;
    }
    if (fileName === "node_modules") {
      return <Boxes className="w-4 h-4 text-emerald-500 flex-shrink-0" />;
    }
    if (fileName === "target" || fileName === "dist" || fileName === "build") {
      return <Boxes className="w-4 h-4 text-slate-500 flex-shrink-0" />;
    }
    return isOpen ? (
      <FolderOpen className="w-4 h-4 text-amber-400 flex-shrink-0" />
    ) : (
      <Folder className="w-4 h-4 text-amber-400 flex-shrink-0" />
    );
  }

  const lower = fileName.toLowerCase();
  const ext = lower.split(".").pop() || "";

  switch (ext) {
    case "rs":
      return <FileCode className="w-4 h-4 text-orange-400 flex-shrink-0" />;
    case "ts":
    case "tsx":
      return <FileCode className="w-4 h-4 text-blue-400 flex-shrink-0" />;
    case "js":
    case "jsx":
      return <FileCode className="w-4 h-4 text-yellow-300 flex-shrink-0" />;
    case "py":
      return <FileCode className="w-4 h-4 text-emerald-400 flex-shrink-0" />;
    case "go":
      return <FileCode className="w-4 h-4 text-cyan-400 flex-shrink-0" />;
    case "json":
      return <FileJson className="w-4 h-4 text-amber-300 flex-shrink-0" />;
    case "md":
    case "txt":
      return <FileText className="w-4 h-4 text-sky-400 flex-shrink-0" />;
    case "toml":
    case "yaml":
    case "yml":
      return <Settings className="w-4 h-4 text-rose-400 flex-shrink-0" />;
    case "sh":
    case "bash":
    case "zsh":
      return <FileTerminal className="w-4 h-4 text-emerald-400 flex-shrink-0" />;
    case "lock":
      return <ShieldAlert className="w-4 h-4 text-amber-500 flex-shrink-0" />;
    default:
      return <File className="w-4 h-4 text-slate-400 flex-shrink-0" />;
  }
}
