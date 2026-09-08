import React, { useEffect, useRef } from "react";
import { EditorState, Extension } from "@codemirror/state";
import { EditorView, lineNumbers, highlightActiveLineGutter, highlightActiveLine, drawSelection, dropCursor, keymap } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { foldGutter, foldKeymap, bracketMatching, syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { oneDark } from "@codemirror/theme-one-dark";
import { useEditorStore, EditorTab } from "../../stores/editorStore";

interface CodeEditorProps {
  tab: EditorTab;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ tab }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const { updateContent, saveActiveFile } = useEditorStore();

  // Cache editor states per file path so undo/redo history and cursor positions persist
  const statesRef = useRef<Map<string, EditorState>>(new Map());

  // Store latest callbacks in refs to avoid recreating extensions
  const updateContentRef = useRef(updateContent);
  updateContentRef.current = updateContent;
  const saveActiveFileRef = useRef(saveActiveFile);
  saveActiveFileRef.current = saveActiveFile;

  const currentTabRef = useRef(tab);
  currentTabRef.current = tab;

  useEffect(() => {
    if (!containerRef.current) return;

    const createExtensions = (): Extension[] => [
      lineNumbers(),
      highlightActiveLineGutter(),
      foldGutter(),
      history(),
      drawSelection(),
      dropCursor(),
      bracketMatching(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      oneDark,
      EditorView.theme({
        "&": {
          height: "100%",
          backgroundColor: "#1e1e1e",
          fontSize: "13px",
          fontFamily: 'Consolas, Monaco, "Courier New", monospace',
        },
        ".cm-scroller": {
          overflow: "auto",
          lineHeight: "1.5",
        },
        ".cm-gutters": {
          backgroundColor: "#1e1e1e",
          color: "#858585",
          border: "none",
          borderRight: "1px solid rgba(255, 255, 255, 0.07)",
        },
        ".cm-activeLine": {
          backgroundColor: "rgba(255, 255, 255, 0.04)",
        },
        ".cm-activeLineGutter": {
          backgroundColor: "rgba(255, 255, 255, 0.08)",
          color: "#c6c6c6",
        },
      }),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...searchKeymap,
        {
          key: "Mod-s",
          run: () => {
            saveActiveFileRef.current();
            return true;
          },
        },
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const newDoc = update.state.doc.toString();
          updateContentRef.current(currentTabRef.current.path, newDoc);
        }
      }),
    ];

    const state =
      statesRef.current.get(tab.path) ||
      EditorState.create({
        doc: tab.content,
        extensions: createExtensions(),
      });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      statesRef.current.set(tab.path, view.state);
      view.destroy();
      viewRef.current = null;
    };
  }, [tab.path]);

  // Synchronize document if tab content was updated externally (e.g. reload on conflict)
  useEffect(() => {
    const view = viewRef.current;
    if (view) {
      const currentDoc = view.state.doc.toString();
      if (currentDoc !== tab.content) {
        view.dispatch({
          changes: { from: 0, to: currentDoc.length, insert: tab.content },
        });
      }
    }
  }, [tab.content]);

  return <div ref={containerRef} className="w-full h-full overflow-hidden" />;
};
