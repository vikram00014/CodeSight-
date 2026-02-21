"use client";

import { useState } from "react";
import { motion } from "framer-motion";

import { useCodeSightStore } from "@/src/store/codesight-store";

export function StackPanel() {
  const snapshot = useCodeSightStore((state) => state.currentSnapshot);
  const animationsEnabled = useCodeSightStore((state) => state.animationsEnabled);
  const [showInternal, setShowInternal] = useState(false);

  const frames = snapshot?.stackFrames ?? [];
  const internalFrames = snapshot?.internalStackFrames ?? [];

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100">Call Stack</h3>
        <label className="inline-flex items-center gap-1 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={showInternal}
            onChange={(event) => setShowInternal(event.target.checked)}
          />
          show internals ({internalFrames.length})
        </label>
      </div>

      <div className="max-h-64 space-y-2 overflow-auto">
        {frames.length === 0 ? (
          <p className="text-xs text-zinc-400">No active frames</p>
        ) : (
          frames.map((frame) => (
            <motion.div
              key={frame.frameId}
              initial={animationsEnabled ? { opacity: 0, y: -8 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
              className="rounded-lg border border-zinc-700 p-2"
            >
              <div className="text-xs font-semibold text-emerald-300">
                {frame.functionName} (line {frame.lineNumber})
              </div>
              <div className="text-[11px] text-zinc-500">{frame.filename}</div>
              <div className="mt-1 space-y-1 text-xs text-zinc-300">
                {frame.locals.map((localVar) => (
                  <div key={`${frame.frameId}-${localVar.name}`}>
                    {localVar.name}: {localVar.valuePreview}
                  </div>
                ))}
              </div>
            </motion.div>
          ))
        )}

        {showInternal && internalFrames.length > 0 ? (
          <div className="mt-2 space-y-2 border-t border-zinc-800 pt-2">
            {internalFrames.map((frame) => (
              <div key={frame.frameId} className="rounded border border-zinc-800 p-2 text-xs">
                <div className="font-semibold text-zinc-400">
                  {frame.functionName} (line {frame.lineNumber})
                </div>
                <div className="text-[11px] text-zinc-500">{frame.filename}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
