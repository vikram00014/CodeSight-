"use client";

import dynamic from "next/dynamic";
import type * as Monaco from "monaco-editor";
import { useEffect, useMemo, useRef } from "react";

import { SupportedLanguage } from "@/src/types/execution";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

interface CodeEditorProps {
  code: string;
  language: SupportedLanguage;
  onChange: (value: string) => void;
  currentLine?: number;
  errorLine?: number;
  readOnly?: boolean;
}

export function CodeEditor({
  code,
  language,
  onChange,
  currentLine,
  errorLine,
  readOnly = false,
}: CodeEditorProps) {
  const editorRef = useRef<{
    editor: Monaco.editor.IStandaloneCodeEditor;
    monaco: typeof Monaco;
  } | null>(null);

  const decorationRef = useRef<Monaco.editor.IEditorDecorationsCollection | null>(null);

  const decorations = useMemo(
    () => ({
      currentLine,
      errorLine,
    }),
    [currentLine, errorLine],
  );

  const monacoLanguage = language === "cpp" ? "cpp" : "python";

  useEffect(() => {
    if (!editorRef.current) {
      return;
    }

    decorationRef.current?.clear();

    const { monaco, editor } = editorRef.current;
    const appliedDecorations: Monaco.editor.IModelDeltaDecoration[] = [];

    if (decorations.currentLine && decorations.currentLine > 0) {
      appliedDecorations.push({
        range: new monaco.Range(decorations.currentLine, 1, decorations.currentLine, 1),
        options: {
          isWholeLine: true,
          className: "codesight-current-line",
        },
      });
    }

    if (decorations.errorLine && decorations.errorLine > 0) {
      appliedDecorations.push({
        range: new monaco.Range(decorations.errorLine, 1, decorations.errorLine, 1),
        options: {
          isWholeLine: true,
          className: "codesight-error-line",
        },
      });
    }

    decorationRef.current = editor.createDecorationsCollection(appliedDecorations);
  }, [decorations]);

  useEffect(() => {
    if (!editorRef.current || !currentLine || currentLine <= 0) {
      return;
    }

    editorRef.current.editor.revealLineInCenter(currentLine);
  }, [currentLine]);

  return (
    <div className="h-[440px] overflow-hidden rounded-2xl border border-zinc-700/70 bg-zinc-950/80 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
      <MonacoEditor
        key={monacoLanguage}
        height="100%"
        language={monacoLanguage}
        theme="vs-dark"
        value={code}
        onChange={(value) => onChange(value ?? "")}
        options={{
          minimap: { enabled: true, scale: 1 },
          fontSize: 15,
          lineHeight: 24,
          readOnly,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          smoothScrolling: true,
          roundedSelection: true,
          cursorBlinking: "smooth",
          padding: { top: 14, bottom: 14 },
        }}
        onMount={(editor, monaco) => {
          editorRef.current = {
            editor,
            monaco,
          };
        }}
      />
    </div>
  );
}
