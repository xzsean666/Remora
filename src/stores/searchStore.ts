import { create } from "zustand";
import {
  searchInFiles,
  type SearchResult,
  formatErrorMessage,
} from "../utils/tauriBridge";

interface SearchState {
  query: string;
  isCaseSensitive: boolean;
  isWholeWord: boolean;
  isRegex: boolean;
  includePattern: string;
  excludePattern: string;
  showDetails: boolean;

  searching: boolean;
  results: SearchResult | null;
  error: string | null;
  collapsedFiles: Record<string, boolean>;

  setQuery: (query: string) => void;
  toggleCaseSensitive: () => void;
  toggleWholeWord: () => void;
  toggleRegex: () => void;
  setIncludePattern: (pat: string) => void;
  setExcludePattern: (pat: string) => void;
  setShowDetails: (show: boolean) => void;
  toggleShowDetails: () => void;

  toggleFileCollapse: (filePath: string) => void;
  collapseAll: () => void;
  expandAll: () => void;
  clearSearch: () => void;

  executeSearch: (serverId: string, rootPath: string) => Promise<void>;
}

export const useSearchStore = create<SearchState>((set, get) => ({
  query: "",
  isCaseSensitive: false,
  isWholeWord: false,
  isRegex: false,
  includePattern: "",
  excludePattern: "",
  showDetails: false,

  searching: false,
  results: null,
  error: null,
  collapsedFiles: {},

  setQuery: (query: string) => set({ query }),
  toggleCaseSensitive: () => set((s) => ({ isCaseSensitive: !s.isCaseSensitive })),
  toggleWholeWord: () => set((s) => ({ isWholeWord: !s.isWholeWord })),
  toggleRegex: () => set((s) => ({ isRegex: !s.isRegex })),
  setIncludePattern: (includePattern: string) => set({ includePattern }),
  setExcludePattern: (excludePattern: string) => set({ excludePattern }),
  setShowDetails: (showDetails: boolean) => set({ showDetails }),
  toggleShowDetails: () => set((s) => ({ showDetails: !s.showDetails })),

  toggleFileCollapse: (filePath: string) => {
    set((s) => ({
      collapsedFiles: {
        ...s.collapsedFiles,
        [filePath]: !s.collapsedFiles[filePath],
      },
    }));
  },

  collapseAll: () => {
    const { results } = get();
    if (!results) return;
    const collapsed: Record<string, boolean> = {};
    for (const file of results.files) {
      collapsed[file.path] = true;
    }
    set({ collapsedFiles: collapsed });
  },

  expandAll: () => {
    set({ collapsedFiles: {} });
  },

  clearSearch: () => {
    set({
      query: "",
      results: null,
      error: null,
      collapsedFiles: {},
      searching: false,
    });
  },

  executeSearch: async (serverId: string, rootPath: string) => {
    const { query, isCaseSensitive, isWholeWord, isRegex, includePattern, excludePattern } = get();
    const trimmed = query.trim();
    if (!trimmed) {
      set({ results: null, error: null, searching: false });
      return;
    }

    set({ searching: true, error: null });
    try {
      const res = await searchInFiles({
        serverId,
        rootPath,
        query: trimmed,
        caseSensitive: isCaseSensitive,
        wholeWord: isWholeWord,
        isRegex,
        includePattern: includePattern.trim() || undefined,
        excludePattern: excludePattern.trim() || undefined,
        maxResults: 1000,
      });
      set({
        results: res,
        searching: false,
        collapsedFiles: {},
      });
    } catch (err: any) {
      set({
        error: formatErrorMessage(err),
        searching: false,
      });
    }
  },
}));
