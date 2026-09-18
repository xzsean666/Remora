import { Component, ErrorInfo, ReactNode } from "react";
import { AlertOctagon, RefreshCw, Code2, X } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  onReset?: () => void;
  onSwitchToSource?: () => void;
  onClose?: () => void;
  resetKeys?: any[];
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught component rendering error:", error, errorInfo);
  }

  public componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && this.props.resetKeys) {
      const hasChanged = this.props.resetKeys.some(
        (key, index) => key !== prevProps.resetKeys?.[index]
      );
      if (hasChanged) {
        this.reset();
      }
    }
  }

  public reset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  public render() {
    if (this.state.hasError) {
      if (typeof this.props.fallback === "function") {
        return this.props.fallback(this.state.error || new Error("Unknown error"), this.reset);
      }
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-vscode-bg select-none text-center">
          <div className="max-w-md w-full p-6 rounded-xl border border-rose-500/40 bg-rose-950/20 backdrop-blur-md flex flex-col items-center text-vscode-text shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-3.5">
              <AlertOctagon className="w-6 h-6" />
            </div>

            <h3 className="text-sm font-semibold text-rose-200 mb-1.5">
              文档视图渲染异常 (Render Error)
            </h3>
            <p className="text-xs text-vscode-textMuted mb-3 leading-relaxed">
              文档内容解析或视图渲染发生错误，已自动保护主程序防止黑屏。
            </p>

            {this.state.error && (
              <div className="w-full p-2.5 rounded bg-black/40 border border-vscode-border/50 text-[11px] font-mono text-rose-300 text-left overflow-x-auto max-h-24 mb-4 select-text scrollbar-thin">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap justify-center">
              <button
                onClick={this.reset}
                className="px-3 py-1.5 rounded bg-vscode-selected text-white text-xs hover:brightness-110 transition-all font-medium flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>重新加载</span>
              </button>

              {this.props.onSwitchToSource && (
                <button
                  onClick={this.props.onSwitchToSource}
                  className="px-3 py-1.5 rounded bg-vscode-hover border border-vscode-border text-vscode-textBright text-xs hover:bg-vscode-selected hover:text-white transition-all font-medium flex items-center gap-1.5"
                >
                  <Code2 className="w-3.5 h-3.5 text-sky-400" />
                  <span>切换至源码编辑</span>
                </button>
              )}

              {this.props.onClose && (
                <button
                  onClick={this.props.onClose}
                  className="px-3 py-1.5 rounded bg-vscode-hover border border-vscode-border text-vscode-textMuted text-xs hover:text-white transition-all font-medium flex items-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>关闭标签页</span>
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
