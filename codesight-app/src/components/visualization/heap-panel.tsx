"use client";

import { useMemo, useState } from "react";

import { useCodeSightStore } from "@/src/store/codesight-store";
import { HeapObject } from "@/src/types/execution";

function virtualizeHeapIds(ids: number[], currentStep: number, size = 120) {
  if (ids.length <= size) {
    return ids;
  }

  const center = Math.min(ids.length - 1, Math.max(0, currentStep % ids.length));
  const start = Math.max(0, center - Math.floor(size / 2));
  const end = Math.min(ids.length, start + size);
  return ids.slice(start, end);
}

export function HeapPanel() {
  const snapshot = useCodeSightStore((state) => state.currentSnapshot);
  const compressedTrace = useCodeSightStore((state) => state.compressedTrace);
  const currentStep = useCodeSightStore((state) => state.currentStep);
  const [showInternal, setShowInternal] = useState(false);

  const heap = useMemo<HeapObject[]>(() => {
    if (!snapshot || !compressedTrace) {
      return [];
    }

    return snapshot.heapRefIds
      .map((objectId) => compressedTrace.heapObjectsById[objectId])
      .filter((item): item is HeapObject => Boolean(item));
  }, [snapshot, compressedTrace]);

  const visibleHeap = useMemo(
    () => heap.filter((item) => (showInternal ? true : item.classification !== "internal")),
    [heap, showInternal],
  );

  const objectIds = useMemo(() => visibleHeap.map((item) => item.objectId), [visibleHeap]);
  const virtualizedIds = useMemo(
    () => virtualizeHeapIds(objectIds, currentStep),
    [objectIds, currentStep],
  );
  const changedSet = useMemo(
    () => new Set(snapshot?.changedHeapObjectIds ?? []),
    [snapshot?.changedHeapObjectIds],
  );

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100">Memory Graph (Heap)</h3>
        <label className="inline-flex items-center gap-1 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={showInternal}
            onChange={(event) => setShowInternal(event.target.checked)}
          />
          show internals
        </label>
      </div>
      <div className="mb-2 text-xs text-zinc-400">
        Showing {virtualizedIds.length} / {visibleHeap.length} objects
      </div>
      <div className="max-h-64 space-y-1 overflow-auto text-xs">
        {visibleHeap.length === 0 ? (
          <p className="text-zinc-400">No tracked heap objects</p>
        ) : (
          visibleHeap
            .filter((obj) => virtualizedIds.includes(obj.objectId))
            .map((obj) => (
              <div
                key={obj.objectId}
                className={`rounded border p-2 ${
                  changedSet.has(obj.objectId)
                    ? "border-amber-500/60 bg-amber-950/20"
                    : "border-zinc-700"
                }`}
              >
                <div className="font-semibold text-cyan-200">
                  #{obj.objectId} · {obj.type} · {obj.classification}
                </div>
                <div className="text-zinc-400">{obj.repr}</div>
                {obj.fieldRefs ? (
                  <div className="mt-1 text-[11px] text-zinc-500">
                    fields: {Object.keys(obj.fieldRefs).join(", ") || "none"}
                  </div>
                ) : null}
                <div className="mt-1 text-[11px] text-zinc-500">
                  refs: {obj.references.join(", ") || "none"}
                </div>
              </div>
            ))
        )}
      </div>
    </section>
  );
}
