/**
 * Mobile Virtual Keyboard Auto-Scroll & Avoidance Engine
 *
 * Fixes the mobile issue where the virtual soft keyboard covers the focused input
 * until a character is typed. This utility automatically and smoothly scrolls
 * the focused input element to the center of the visible viewport as soon as
 * focus is received or when the virtual keyboard expands (detected via visualViewport resize).
 */

let isInitialized = false;
let pendingScrollTimer1: ReturnType<typeof setTimeout> | null = null;
let pendingScrollTimer2: ReturnType<typeof setTimeout> | null = null;
let pendingScrollTimer3: ReturnType<typeof setTimeout> | null = null;
let lastFocusedElement: HTMLElement | null = null;

function isEditableElement(el: Element | null): el is HTMLElement {
  if (!el || !(el instanceof HTMLElement)) return false;
  // Ignore xterm internal helper textarea to prevent disrupting terminal fit
  if (el.classList.contains("xterm-helper-textarea")) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}

export function scrollActiveElementIntoSafeView(el?: HTMLElement | null) {
  const target = el || (document.activeElement as HTMLElement | null);
  if (!isEditableElement(target)) return;

  // Use requestAnimationFrame to ensure DOM layout / keyboard height has propagated
  requestAnimationFrame(() => {
    try {
      target.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
    } catch {
      // Fallback if smooth scrolling is unsupported in older Android WebViews
      try {
        target.scrollIntoView(false);
      } catch {}
    }
  });
}

export function initMobileKeyboardAutoScroll(): () => void {
  if (isInitialized) return () => {};
  isInitialized = true;

  const clearTimers = () => {
    if (pendingScrollTimer1) clearTimeout(pendingScrollTimer1);
    if (pendingScrollTimer2) clearTimeout(pendingScrollTimer2);
    if (pendingScrollTimer3) clearTimeout(pendingScrollTimer3);
    pendingScrollTimer1 = null;
    pendingScrollTimer2 = null;
    pendingScrollTimer3 = null;
  };

  const scheduleScroll = (el: HTMLElement) => {
    clearTimers();
    lastFocusedElement = el;

    // Immediate slight delay (50ms) - for instant feedback when keyboard was already showing
    pendingScrollTimer1 = setTimeout(() => {
      if (document.activeElement === el) {
        scrollActiveElementIntoSafeView(el);
      }
    }, 50);

    // Mid animation delay (250ms) - when soft keyboard is partially extended on Android
    pendingScrollTimer2 = setTimeout(() => {
      if (document.activeElement === el) {
        scrollActiveElementIntoSafeView(el);
      }
    }, 250);

    // Final animation delay (450ms) - ensures keyboard is fully raised
    pendingScrollTimer3 = setTimeout(() => {
      if (document.activeElement === el) {
        scrollActiveElementIntoSafeView(el);
      }
    }, 450);
  };

  // 1. Focusin: User taps any input / textarea
  const handleFocusIn = (e: FocusEvent) => {
    const target = e.target as HTMLElement | null;
    if (isEditableElement(target)) {
      scheduleScroll(target);
    }
  };

  // 2. Focusout: User dismisses keyboard or blurs input
  const handleFocusOut = () => {
    clearTimers();
    lastFocusedElement = null;
  };

  // 3. Visual Viewport Resize: Fired when virtual keyboard expands / collapses on Android / iOS
  const handleViewportResize = () => {
    const active = document.activeElement as HTMLElement | null;
    if (isEditableElement(active)) {
      scrollActiveElementIntoSafeView(active);
    } else if (lastFocusedElement && isEditableElement(lastFocusedElement)) {
      scrollActiveElementIntoSafeView(lastFocusedElement);
    }
  };

  // 4. Window Resize: Fallback when layout viewport shrinks due to adjustResize
  const handleWindowResize = () => {
    const active = document.activeElement as HTMLElement | null;
    if (isEditableElement(active)) {
      scrollActiveElementIntoSafeView(active);
    }
  };

  document.addEventListener("focusin", handleFocusIn, { passive: true });
  document.addEventListener("focusout", handleFocusOut, { passive: true });
  window.addEventListener("resize", handleWindowResize, { passive: true });

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", handleViewportResize, { passive: true });
  }

  return () => {
    clearTimers();
    isInitialized = false;
    document.removeEventListener("focusin", handleFocusIn);
    document.removeEventListener("focusout", handleFocusOut);
    window.removeEventListener("resize", handleWindowResize);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener("resize", handleViewportResize);
    }
  };
}
