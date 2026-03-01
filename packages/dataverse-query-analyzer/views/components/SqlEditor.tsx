import React, { useRef, useEffect, useCallback } from "react";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { sql, MSSQL } from "@codemirror/lang-sql";
import { autocompletion } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { HighlightStyle, syntaxHighlighting, indentOnInput, bracketMatching } from "@codemirror/language";
import { tags } from "@lezer/highlight";

interface SqlEditorProps {
  value: string;
  schema: Record<string, string[]>;
  onChange: (value: string) => void;
  onExecute: () => void;
  disabled?: boolean;
}

const vsCodeTheme = EditorView.theme({
  "&": {
    backgroundColor: "var(--vscode-editor-background)",
    color: "var(--vscode-editor-foreground)",
    fontFamily: "var(--vscode-editor-font-family, monospace)",
    fontSize: "var(--vscode-editor-font-size, 13px)",
    height: "100%",
  },
  ".cm-content": {
    caretColor: "var(--vscode-editorCursor-foreground)",
    padding: "8px 0",
  },
  ".cm-cursor": {
    borderLeftColor: "var(--vscode-editorCursor-foreground)",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "var(--vscode-editor-selectionBackground)",
  },
  ".cm-gutters": {
    backgroundColor: "var(--vscode-editorGutter-background, var(--vscode-editor-background))",
    color: "var(--vscode-editorLineNumber-foreground)",
    border: "none",
    minWidth: "40px",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--vscode-editor-lineHighlightBackground, transparent)",
    color: "var(--vscode-editorLineNumber-activeForeground)",
  },
  ".cm-activeLine": {
    backgroundColor: "var(--vscode-editor-lineHighlightBackground, transparent)",
  },
  ".cm-matchingBracket": {
    backgroundColor: "var(--vscode-editorBracketMatch-background, rgba(0,100,200,0.3))",
    outline: "1px solid var(--vscode-editorBracketMatch-border, transparent)",
  },
  ".cm-tooltip": {
    backgroundColor: "var(--vscode-editorSuggestWidget-background)",
    color: "var(--vscode-editorSuggestWidget-foreground)",
    border: "1px solid var(--vscode-editorSuggestWidget-border)",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "var(--vscode-editorSuggestWidget-selectedBackground)",
    color: "var(--vscode-editorSuggestWidget-selectedForeground)",
  },
  ".cm-tooltip-autocomplete ul li": {
    padding: "2px 8px",
  },
  ".cm-panels": {
    backgroundColor: "var(--vscode-editor-background)",
    color: "var(--vscode-editor-foreground)",
  },
  ".cm-searchMatch": {
    backgroundColor: "var(--vscode-editor-findMatchHighlightBackground, rgba(255,200,0,0.3))",
  },
  ".cm-searchMatch-selected": {
    backgroundColor: "var(--vscode-editor-findMatchBackground, rgba(255,200,0,0.6))",
  },
});

const vsCodeHighlightStyle = HighlightStyle.define([
  { tag: [tags.keyword, tags.operatorKeyword, tags.null, tags.bool], color: "var(--vscode-debugTokenExpression-keyword, #569cd6)" },
  { tag: tags.string, color: "var(--vscode-debugTokenExpression-string, #ce9178)" },
  { tag: tags.number, color: "var(--vscode-debugTokenExpression-number, #b5cea8)" },
  { tag: tags.comment, color: "var(--vscode-descriptionForeground, #6a9955)", fontStyle: "italic" },
]);

const schemaCompartment = new Compartment();
const readOnlyCompartment = new Compartment();

export default function SqlEditor({
  value,
  schema,
  onChange,
  onExecute,
  disabled,
}: SqlEditorProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onExecuteRef = useRef(onExecute);

  onChangeRef.current = onChange;
  onExecuteRef.current = onExecute;

  // Build the SQL schema for CodeMirror
  const buildSqlExtension = useCallback(
    (s: Record<string, string[]>) =>
      sql({
        dialect: MSSQL,
        schema: s,
        upperCaseKeywords: true,
      }),
    []
  );

  // Initialize CodeMirror
  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const executeKeymap = keymap.of([
      {
        key: "Ctrl-Enter",
        mac: "Cmd-Enter",
        run: () => {
          onExecuteRef.current();
          return true;
        },
      },
    ]);

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChangeRef.current(update.state.doc.toString());
      }
    });

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        bracketMatching(),
        indentOnInput(),
        syntaxHighlighting(vsCodeHighlightStyle),
        history(),
        highlightSelectionMatches(),
        autocompletion({ activateOnTyping: true }),
        schemaCompartment.of(buildSqlExtension(schema)),
        readOnlyCompartment.of(EditorState.readOnly.of(!!disabled)),
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
        executeKeymap,
        updateListener,
        vsCodeTheme,
        EditorView.lineWrapping,
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update schema when it changes
  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: schemaCompartment.reconfigure(buildSqlExtension(schema)),
      });
    }
  }, [schema, buildSqlExtension]);

  // Update readOnly when disabled changes
  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: readOnlyCompartment.reconfigure(EditorState.readOnly.of(!!disabled)),
      });
    }
  }, [disabled]);

  // Update value from outside (e.g., loading a saved query)
  useEffect(() => {
    const view = viewRef.current;
    if (view && view.state.doc.toString() !== value) {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: value,
        },
      });
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      className="sql-editor"
      style={{ height: "100%", overflow: "hidden" }}
    />
  );
}
