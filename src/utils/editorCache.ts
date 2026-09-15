import { EditorState } from "@codemirror/state";

export interface EditorCacheEntry {
  state: EditorState;
  scrollTop: number;
  scrollLeft: number;
}

// Module-level persistent cache across tab switches/unmounts
const editorCache = new Map<string, EditorCacheEntry>();

export function getEditorCache(path: string): EditorCacheEntry | undefined {
  return editorCache.get(path);
}

export function setEditorCache(path: string, entry: EditorCacheEntry): void {
  editorCache.set(path, entry);
}

export function clearEditorCache(path?: string): void {
  if (path) {
    editorCache.delete(path);
  } else {
    editorCache.clear();
  }
}
