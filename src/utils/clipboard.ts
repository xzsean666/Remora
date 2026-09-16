/**
 * 高可靠跨平台剪贴板工具库 (Robust Cross-platform Clipboard Utility)
 * 
 * 解决 Linux (WebKitGTK)、移动端及嵌入式 Webview 环境下：
 * 1. navigator.clipboard.writeText 在无焦点/元素卸载时抛出 NotAllowedError / DOMException；
 * 2. 剪贴板静默失败导致持续保留旧内容；
 * 3. 缺乏复制成功的直观视觉反馈等痛点。
 */

import { safeInvoke } from "./tauriBridge";

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

/**
 * 将 Blob / File 转换为纯 Base64 字符串（不含 data:url 前缀）
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const commaIndex = dataUrl.indexOf(",");
      if (commaIndex !== -1) {
        resolve(dataUrl.slice(commaIndex + 1));
      } else {
        resolve(dataUrl);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * 根据 MIME 类型推断合适的文件后缀名
 */
export function getImageExtension(mimeType: string): string {
  switch (mimeType.toLowerCase()) {
    case "image/jpeg":
    case "image/jpg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/gif":
      return ".gif";
    case "image/webp":
      return ".webp";
    case "image/svg+xml":
      return ".svg";
    case "image/bmp":
      return ".bmp";
    case "image/x-icon":
    case "image/vnd.microsoft.icon":
      return ".ico";
    case "image/avif":
      return ".avif";
    default:
      return ".png";
  }
}

/**
 * 从本地/浏览器系统剪贴板中读取图片数据 (Blob 与 MIME)
 * 优先调用异步 Clipboard API，若不可用则检查纯文本中的 Data URL
 */
export async function readClipboardImage(): Promise<{ blob: Blob; mimeType: string } | null> {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    return null;
  }

  try {
    if (typeof window !== "undefined" && typeof window.focus === "function") {
      window.focus();
    }
  } catch {}

  // 1. 尝试现代异步 Clipboard API (navigator.clipboard.read)
  if (typeof navigator.clipboard.read === "function") {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((t) => t.startsWith("image/"));
        if (imageType) {
          const blob = await item.getType(imageType);
          return { blob, mimeType: imageType };
        }
      }
    } catch (err) {
      console.warn("[Clipboard] navigator.clipboard.read failed or not permitted:", err);
    }
  }

  // 2. 检查纯文本中是否包含 data:image/xxx;base64,... 图片数据
  if (typeof navigator.clipboard.readText === "function") {
    try {
      const text = await navigator.clipboard.readText();
      const trimmed = text.trim();
      if (trimmed.startsWith("data:image/")) {
        const match = trimmed.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
        if (match) {
          const mimeType = match[1];
          const base64Data = match[2];
          const byteChars = atob(base64Data);
          const byteNumbers = new Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++) {
            byteNumbers[i] = byteChars.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: mimeType });
          return { blob, mimeType };
        }
      }
    } catch {}
  }

  return null;
}

/**
 * 优先调用 Tauri 本地原生命令直接从操作系统剪贴板读取图片 Base64 数据 (PNG)
 * 能够穿透 Webview 沙箱与权限限制，完美支持 Slack、微信、系统截屏、浏览器复制的原生位图
 */
export async function readNativeClipboardImage(): Promise<{ base64Data: string; mimeType: string } | null> {
  try {
    const res = await safeInvoke<string | null>("read_clipboard_image_native");
    if (res && typeof res === "string" && res.length > 0) {
      return { base64Data: res, mimeType: "image/png" };
    }
  } catch (err) {
    console.warn("[Clipboard] read_clipboard_image_native failed:", err);
  }
  return null;
}
