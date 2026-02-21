"use client";

import { useMemo, useState } from "react";

import { useCodeSightStore } from "@/src/store/codesight-store";

export function VariableWatchPanel() {
  const snapshot = useCodeSightStore((state) => state.currentSnapshot);
  const [showInternal, setShowInternal] = useState(false);

  const changed = useMemo(
    () => new Set(snapshot?.changedVariables ?? []),
    [snapshot?.changedVariables],
  );

  const variables = Object.values(snapshot?.variables ?? {});
  const internalVariables = Object.values(snapshot?.internalVariables ?? {});

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100">Variable Watch</h3>
        <label className="inline-flex items-center gap-1 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={showInternal}
            onChange={(event) => setShowInternal(event.target.checked)}
          />
          show internals ({internalVariables.length})
        </label>
      </div>

      <div className="max-h-64 space-y-1 overflow-auto text-xs">
        {variables.length === 0 ? (
          <p className="text-zinc-400">No variables in scope</p>
        ) : (
          variables.map((variable) => {
            const isChanged = changed.has(variable.name);
            return (
              <div
                key={variable.name}
                className={`rounded px-2 py-1 ${
                  isChanged ? "bg-amber-500/20 text-amber-200" : "bg-zinc-900 text-zinc-300"
                }`}
              >
                <div className="font-medium">
                  {variable.name} <span className="text-zinc-500">({variable.scope})</span>
                </div>
                <div className="text-zinc-400">{variable.valuePreview}</div>
              </div>
            );
          })
        )}

        {showInternal && internalVariables.length > 0 ? (
          <div className="mt-2 space-y-1 border-t border-zinc-800 pt-2">
            {internalVariables.map((variable) => (
              <div key={`internal-${variable.name}`} className="rounded bg-zinc-900/60 px-2 py-1">
                <div className="font-medium text-zinc-400">
                  {variable.name} <span className="text-zinc-600">({variable.scope})</span>
                </div>
                <div className="text-zinc-500">{variable.valuePreview}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
