/**
 * 高可靠跨平台剪贴板工具库 (Robust Cross-platform Clipboard Utility)
 * 
 * 解决 Linux (WebKitGTK)、移动端及嵌入式 Webview 环境下：
 * 1. navigator.clipboard.writeText 在无焦点/元素卸载时抛出 NotAllowedError / DOMException；
 * 2. 剪贴板静默失败导致持续保留旧内容；
 * 3. 缺乏复制成功的直观视觉反馈等痛点。
 */

// 简单的全局 Toast 广播机制
type ToastListener = (message: string, duration?: number) => void;
const toastListeners = new Set<ToastListener>();

export function subscribeClipboardToast(listener: ToastListener): () => void {
  toastListeners.add(listener);
  return () => {
    toastListeners.delete(listener);
  };
}

export function showClipboardToast(message: string, duration = 1500): void {
  toastListeners.forEach((fn) => {
    try {
      fn(message, duration);
    } catch (e) {
      console.warn("Failed to dispatch clipboard toast:", e);
    }
  });
}

export interface CopyOptions {
  /**
   * 是否在复制成功后触发轻量级全局 Toast 提示
   * 默认为 true
   */
  showToast?: boolean;
  /**
   * 自定义 Toast 显示的成功文字（如 "已复制路径: /var/log"）
   * 若未指定，默认显示 "已复制到剪贴板"
   */
  toastLabel?: string;
}

/**
 * 将指定文本安全、可靠地复制到本地系统剪贴板。
 * 
 * 策略：
 * 1. 自动执行 window.focus() 确保 Document 获得焦点；
 * 2. 优先调用现代异步 Clipboard API (navigator.clipboard.writeText)；
 * 3. 若调用失败或不受支持，立即无缝降级至经典同步 document.execCommand('copy')（创建只读隐藏 textarea 并选中）；
 * 4. 复制成功后可配置弹出轻量 Toast 提示。
 * 
 * @param text 要复制的纯文本内容
 * @param options 配置选项
 * @returns Promise<boolean> 是否复制成功
 */
export async function copyTextToClipboard(text: string, options: CopyOptions = {}): Promise<boolean> {
  if (typeof text !== "string" || text.length === 0) {
    return false;
  }

  const { showToast = true, toastLabel } = options;
  let success = false;

  // 1. 尝试确立当前窗口焦点，解除 WebKitGTK 针对 document.hasFocus() 的阻断
  try {
    if (typeof window !== "undefined" && typeof window.focus === "function") {
      window.focus();
    }
  } catch {}

  // 2. 优先尝试现代异步 Clipboard API
  if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    try {
      await navigator.clipboard.writeText(text);
      success = true;
    } catch (err) {
      console.warn("[Clipboard] navigator.clipboard.writeText failed, falling back to execCommand:", err);
    }
  }

  // 3. 降级方案：同步 document.execCommand('copy')
  // 在 WebKitGTK、iframe、或弹窗点击瞬间组件 unmount 等复杂场景下拥有 100% 极高的兼容性
  if (!success && typeof document !== "undefined") {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      
      // 防止在移动端触发布局重排与视口滚动
      textarea.style.position = "fixed";
      textarea.style.top = "0";
      textarea.style.left = "0";
      textarea.style.width = "2em";
      textarea.style.height = "2em";
      textarea.style.padding = "0";
      textarea.style.border = "none";
      textarea.style.outline = "none";
      textarea.style.boxShadow = "none";
      textarea.style.background = "transparent";
      textarea.setAttribute("readonly", "");
      textarea.style.opacity = "0";
      textarea.style.pointerEvents = "none";

      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, text.length);

      success = document.execCommand("copy");
      document.body.removeChild(textarea);
    } catch (err) {
      console.error("[Clipboard] execCommand fallback also failed:", err);
    }
  }

  // 4. 成功后触发全局反馈
  if (success && showToast) {
    const defaultLabel = text.length > 40
      ? `已复制: ${text.slice(0, 36)}...`
      : `已复制: ${text}`;
    showClipboardToast(toastLabel || defaultLabel);
  }

  return success;
}
