import React, { useState, useEffect } from "react";
import { X, Sparkles, Key, Globe, Cpu, Check, RotateCcw, Eye, EyeOff } from "lucide-react";
import { getAiConfig, saveAiConfig } from "../../../services/aiCommitService";

interface AiConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const AiConfigModal: React.FC<AiConfigModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const cfg = getAiConfig();
      setApiKey(cfg.apiKey);
      setBaseUrl(cfg.baseUrl);
      setModel(cfg.model);
      setSavedSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    saveAiConfig({
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim(),
      model: model.trim(),
    });
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onSaved?.();
      onClose();
    }, 500);
  };

  const handleReset = () => {
    const defaultKey = (import.meta as any).env?.VITE_AI_API_KEY || "";
    const defaultBaseUrl =
      (import.meta as any).env?.VITE_AI_BASE_URL || "https://openrouter.ai/api/v1";
    const defaultModel =
      (import.meta as any).env?.VITE_AI_MODEL || "nvidia/nemotron-3.5-lightning:free";

    setApiKey(defaultKey);
    setBaseUrl(defaultBaseUrl);
    setModel(defaultModel);
  };

  const hasEnvKey = Boolean((import.meta as any).env?.VITE_AI_API_KEY);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-xs select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#1e1e1e] border border-vscode-border rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150 text-vscode-text text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 bg-[#252526] border-b border-vscode-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400 flex-shrink-0" />
            <span className="font-semibold text-white">AI Commit Message 配置</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-vscode-hover text-vscode-textMuted hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* API Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-vscode-textBright font-medium flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>API Key (OpenRouter / OpenAI)</span>
              </label>
              {hasEnvKey && (
                <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/60">
                  Build/Env 已内置
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-or-v1-..."
                className="w-full bg-[#141414] border border-vscode-border/80 focus:border-vscode-activityBarActive rounded px-2.5 py-1.5 pr-8 text-vscode-textBright font-mono text-xs outline-hidden"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-vscode-textMuted hover:text-white transition-colors"
                title={showKey ? "隐藏 Key" : "显示 Key"}
              >
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[11px] text-vscode-textMuted">
              支持 OpenRouter 密钥或任何 OpenAI 兼容接口密钥。
            </p>
          </div>

          {/* Base URL */}
          <div className="space-y-1.5">
            <label className="text-vscode-textBright font-medium flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-sky-400" />
              <span>Base URL</span>
            </label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://openrouter.ai/api/v1"
              className="w-full bg-[#141414] border border-vscode-border/80 focus:border-vscode-activityBarActive rounded px-2.5 py-1.5 text-vscode-textBright font-mono text-xs outline-hidden"
            />
          </div>

          {/* Model */}
          <div className="space-y-1.5">
            <label className="text-vscode-textBright font-medium flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              <span>Model Name (默认快速免费模型)</span>
            </label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="nvidia/nemotron-3.5-lightning:free"
              className="w-full bg-[#141414] border border-vscode-border/80 focus:border-vscode-activityBarActive rounded px-2.5 py-1.5 text-vscode-textBright font-mono text-xs outline-hidden"
            />
            <div className="flex flex-wrap gap-1 pt-1">
              <span className="text-[10px] text-vscode-textMuted self-center">推荐免费模型:</span>
              <button
                type="button"
                onClick={() => setModel("nvidia/nemotron-3.5-lightning:free")}
                className="text-[10px] px-1.5 py-0.5 rounded bg-[#2a2a2a] hover:bg-[#383838] text-gray-300 transition-colors"
              >
                nemotron-3.5 (推荐)
              </button>
              <button
                type="button"
                onClick={() => setModel("google/gemma-4-31b-it:free")}
                className="text-[10px] px-1.5 py-0.5 rounded bg-[#2a2a2a] hover:bg-[#383838] text-gray-300 transition-colors"
              >
                gemma-4-31b
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-[#252526] border-t border-vscode-border flex items-center justify-between">
          <button
            type="button"
            onClick={handleReset}
            className="px-2.5 py-1 rounded hover:bg-[#333333] text-vscode-textMuted hover:text-white text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            title="恢复默认设置"
          >
            <RotateCcw className="w-3 h-3" />
            <span>恢复默认</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 rounded bg-[#333333] hover:bg-[#3e3e3e] text-vscode-textBright text-xs font-medium transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-3.5 py-1 rounded bg-vscode-activityBarActive hover:bg-vscode-activityBarActive/90 text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {savedSuccess ? <Check className="w-3.5 h-3.5" /> : null}
              <span>{savedSuccess ? "已保存" : "保存配置"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
