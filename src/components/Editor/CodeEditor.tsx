import React, { useEffect, useRef } from "react";
import { Compartment, EditorState, Extension } from "@codemirror/state";
import { EditorView, lineNumbers, highlightActiveLineGutter, highlightActiveLine, drawSelection, dropCursor, keymap } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { foldGutter, foldKeymap, bracketMatching, syntaxHighlighting, defaultHighlightStyle, LanguageDescription } from "@codemirror/language";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { oneDark } from "@codemirror/theme-one-dark";
import { languages } from "@codemirror/language-data";
import { useEditorStore, EditorTab } from "../../stores/editorStore";
import { getEditorCache, setEditorCache } from "../../utils/editorCache";

interface CodeEditorProps {
  tab: EditorTab;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ tab }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const langCompartment = useRef(new Compartment());
  const { updateContent, saveActiveFile } = useEditorStore();

  // Store latest callbacks in refs to avoid recreating extensions
  const updateContentRef = useRef(updateContent);
  updateContentRef.current = updateContent;
  const saveActiveFileRef = useRef(saveActiveFile);
  saveActiveFileRef.current = saveActiveFile;

  const currentTabRef = useRef(tab);
  currentTabRef.current = tab;

  useEffect(() => {
    if (!containerRef.current) return;

    let isMounted = true;
    const langDesc = LanguageDescription.matchFilename(languages, tab.path);

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
      langCompartment.current.of(langDesc?.support ? [langDesc.support] : []),
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

    const cached = getEditorCache(tab.path);
    let state: EditorState;
    if (cached && cached.state.doc.toString() === tab.content) {
      state = cached.state;
    } else {
      state = EditorState.create({
        doc: tab.content,
        extensions: createExtensions(),
      });
    }

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    if (tab.targetPosition) {
      const pos = tab.targetPosition;
      const lineNum = Math.max(1, Math.min(pos.line, state.doc.lines));
      const lineObj = state.doc.line(lineNum);
      const ch = Math.max(0, (pos.ch ?? 1) - 1);
      const offset = Math.min(lineObj.from + ch, lineObj.to);
      requestAnimationFrame(() => {
        if (isMounted && viewRef.current) {
          viewRef.current.dispatch({
            selection: { anchor: offset, head: offset },
            scrollIntoView: true,
          });
          viewRef.current.focus();
        }
      });
    } else if (cached) {
      requestAnimationFrame(() => {
        if (isMounted && viewRef.current?.scrollDOM) {
          viewRef.current.scrollDOM.scrollTop = cached.scrollTop;
          viewRef.current.scrollDOM.scrollLeft = cached.scrollLeft;
        }
      });
    }

    if (langDesc && !langDesc.support) {
      langDesc.load().then((support) => {
        if (isMounted && viewRef.current) {
          viewRef.current.dispatch({
            effects: langCompartment.current.reconfigure(support),
          });
        }
      }).catch((err) => {
        console.warn("Failed to load syntax parser for", tab.path, err);
      });
    }

    return () => {
      isMounted = false;
      if (viewRef.current) {
        setEditorCache(tab.path, {
          state: viewRef.current.state,
          scrollTop: viewRef.current.scrollDOM.scrollTop,
          scrollLeft: viewRef.current.scrollDOM.scrollLeft,
        });
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, [tab.path]);

  // Handle updates to targetPosition while the same tab is already mounted
  useEffect(() => {
    const pos = tab.targetPosition;
    const view = viewRef.current;
    if (!pos || !view) return;

    const doc = view.state.doc;
    const lineNum = Math.max(1, Math.min(pos.line, doc.lines));
    const lineObj = doc.line(lineNum);
    const ch = Math.max(0, (pos.ch ?? 1) - 1);
    const offset = Math.min(lineObj.from + ch, lineObj.to);

    requestAnimationFrame(() => {
      if (viewRef.current) {
        viewRef.current.dispatch({
          selection: { anchor: offset, head: offset },
          scrollIntoView: true,
        });
        viewRef.current.focus();
      }
    });
  }, [tab.targetPosition?.line, tab.targetPosition?.ch]);

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

