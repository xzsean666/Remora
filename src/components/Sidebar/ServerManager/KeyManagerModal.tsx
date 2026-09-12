import React, { useState, useEffect, useRef } from "react";
import { Key, Plus, Trash2, X, Upload, Shield, Check, Lock, AlertCircle } from "lucide-react";
import { useSshKeyStore } from "../../../stores/sshKeyStore";
import { formatErrorMessage, type SshKey } from "../../../utils/tauriBridge";

interface KeyManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectKey?: (keyId: string) => void;
}

export const KeyManagerModal: React.FC<KeyManagerModalProps> = ({
  isOpen,
  onClose,
  onSelectKey,
}) => {
  const { keys, loadKeys, saveKey, deleteKey } = useSshKeyStore();
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadKeys();
      setIsAdding(false);
      setName("");
      setPrivateKey("");
      setPassphrase("");
      setErrorMsg(null);
    }
  }, [isOpen, loadKeys]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!name) {
      setName(file.name.replace(/\.[^/.]+$/, ""));
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setPrivateKey(content);
      }
    };
    reader.readAsText(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedKey = privateKey.trim();
    if (!name.trim()) {
      setErrorMsg("Please enter a key name / 请输入私钥名称");
      return;
    }
    if (!trimmedKey) {
      setErrorMsg("Please provide private key content / 请提供私钥内容");
      return;
    }

    try {
      const newKey: SshKey = {
        id: "key-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7),
        name: name.trim(),
        private_key: trimmedKey,
        passphrase: passphrase.trim() ? passphrase.trim() : null,
        public_key: null,
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      await saveKey(newKey);
      setIsAdding(false);
      setName("");
      setPrivateKey("");
      setPassphrase("");
      if (onSelectKey) {
        onSelectKey(newKey.id);
      }
    } catch (err: any) {
      setErrorMsg(formatErrorMessage(err) || "Failed to save private key");
    }
  };

  const getKeyType = (keyStr: string) => {
    if (keyStr.includes("OPENSSH")) return "OpenSSH";
    if (keyStr.includes("RSA")) return "RSA";
    if (keyStr.includes("EC PRIVATE") || keyStr.includes("ECDSA")) return "ECDSA";
    if (keyStr.includes("ED25519")) return "Ed25519";
    return "Private Key";
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-vscode-sidebar border border-vscode-border rounded-lg shadow-2xl w-full max-w-lg flex flex-col max-h-[min(85vh,calc(100dvh-1rem))] overflow-hidden animate-fadeIn my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-vscode-border bg-vscode-bg/50">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-vscode-textBright">
              SSH Private Keys / 私钥管理
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-vscode-textMuted hover:text-white p-1 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {!isAdding ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs text-vscode-textMuted">
                  Saved Private Keys ({keys.length})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(true);
                    setErrorMsg(null);
                  }}
                  className="px-2.5 py-1 bg-vscode-activityBarActive text-white text-xs rounded hover:brightness-110 transition-all flex items-center gap-1 font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Private Key / 添加私钥</span>
                </button>
              </div>

              {keys.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-vscode-border rounded-lg text-vscode-textMuted flex flex-col items-center gap-2">
                  <Shield className="w-8 h-8 opacity-40 text-amber-400" />
                  <p className="text-xs">No SSH private keys configured yet.</p>
                  <p className="text-[11px] opacity-75">
                    Click "Add Private Key" to paste or upload an OpenSSH / RSA / Ed25519 key.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {keys.map((k) => (
                    <div
                      key={k.id}
                      className="p-3 bg-vscode-bg/60 border border-vscode-border rounded-lg flex items-center justify-between gap-3 hover:border-vscode-border/80 transition-all"
                    >
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <div className="p-1.5 rounded bg-amber-500/10 text-amber-400 flex-shrink-0 mt-0.5">
                          <Key className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-vscode-textBright truncate">
                              {k.name}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-vscode-sidebar border border-vscode-border text-vscode-textMuted font-mono">
                              {getKeyType(k.private_key)}
                            </span>
                            {k.passphrase && (
                              <span
                                title="Passphrase protected"
                                className="text-[10px] text-amber-400 flex items-center gap-0.5"
                              >
                                <Lock className="w-2.5 h-2.5" />
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-vscode-textMuted font-mono mt-0.5 truncate">
                            {k.private_key.split("\n")[0] || "PRIVATE KEY"}
                          </p>
                          <span className="text-[10px] text-vscode-textMuted/70 block mt-0.5">
                            Added: {new Date(k.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        {onSelectKey && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectKey(k.id);
                              onClose();
                            }}
                            className="px-2 py-1 bg-vscode-hover text-vscode-textBright text-xs rounded hover:bg-vscode-selected hover:text-white transition-colors"
                          >
                            Select
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Delete private key "${k.name}"?`)) {
                              deleteKey(k.id);
                            }
                          }}
                          title="Delete Key"
                          className="p-1.5 text-vscode-textMuted hover:text-rose-400 hover:bg-vscode-hover rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <form onSubmit={handleSave} className="flex flex-col gap-3">
              {errorMsg && (
                <div className="p-2.5 bg-rose-500/15 border border-rose-500/30 text-rose-300 rounded text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="text-[11px] text-vscode-textMuted block mb-1">
                  Key Name / 标识名称 *
                </label>
                <input
                  required
                  placeholder="e.g. Aliyun ECS / id_ed25519"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-vscode-bg border border-vscode-border rounded px-2.5 py-1.5 text-xs outline-none focus:border-vscode-activityBarActive transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-vscode-textMuted flex items-center gap-1">
                    <span>Private Key Content / 私钥内容 *</span>
                  </label>
                  <div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      className="hidden"
                      accept=".pem,.key,.pub,id_rsa,id_ed25519,id_ecdsa,*"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[11px] text-vscode-activityBarActive hover:underline flex items-center gap-1 font-medium"
                    >
                      <Upload className="w-3 h-3" />
                      <span>Upload File / 上传文件</span>
                    </button>
                  </div>
                </div>
                <textarea
                  required
                  rows={7}
                  placeholder={`-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END OPENSSH PRIVATE KEY-----`}
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                  className="w-full bg-vscode-bg border border-vscode-border rounded px-2.5 py-2 text-xs font-mono outline-none focus:border-vscode-activityBarActive transition-colors resize-none leading-relaxed"
                />
                <p className="text-[10px] text-vscode-textMuted mt-0.5">
                  Supports OpenSSH, RSA, Ed25519, and PKCS#8 private keys.
                </p>
              </div>

              <div>
                <label className="text-[11px] text-vscode-textMuted block mb-1 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-amber-400" />
                  <span>Passphrase (Optional / 密码短语，如有)</span>
                </label>
                <input
                  type="password"
                  placeholder="Optional passphrase to decrypt private key"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  className="w-full bg-vscode-bg border border-vscode-border rounded px-2.5 py-1.5 text-xs outline-none focus:border-vscode-activityBarActive transition-colors"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-vscode-border">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-3 py-1.5 text-xs text-vscode-textMuted hover:text-white rounded transition-colors"
                >
                  Cancel / 取消
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-vscode-activityBarActive text-white text-xs font-medium rounded hover:brightness-110 transition-all flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Private Key / 保存私钥</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
