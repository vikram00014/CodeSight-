"use client";

import { useCodeSightStore } from "@/src/store/codesight-store";

export function DebugPanel() {
  const showDebugPanel = useCodeSightStore((state) => state.showDebugPanel);
  const toggleDebugPanel = useCodeSightStore((state) => state.toggleDebugPanel);
  const metadata = useCodeSightStore((state) => state.metadata);

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100">Debug Stats</h3>
        <button
          type="button"
          onClick={toggleDebugPanel}
          className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300"
        >
          {showDebugPanel ? "Hide" : "Show"}
        </button>
      </div>

      {showDebugPanel ? (
        <div className="space-y-1 text-xs text-zinc-300">
          <p>Step count: {metadata?.stepCount ?? 0}</p>
          <p>Execution time: {metadata?.executionTimeMs ?? 0} ms</p>
          <p>Worker time: {metadata?.workerExecutionTimeMs ?? 0} ms</p>
          <p>Snapshot size: {metadata?.snapshotBytes ?? 0} bytes</p>
          <p>Trace truncated: {metadata?.wasTruncated ? "yes" : "no"}</p>
          <p>Stop reason: {metadata?.stopReason ?? "n/a"}</p>
          <p>Peak stack depth: {metadata?.peakStackDepth ?? 0}</p>
          <p>Total objects created: {metadata?.totalObjectsCreated ?? 0}</p>
          <p>Max heap size: {metadata?.maxHeapSize ?? 0}</p>
          <p>Complexity trend: {metadata?.timeComplexityTrend ?? "unknown"}</p>
        </div>
      ) : (
        <p className="text-xs text-zinc-500">Debug panel hidden.</p>
      )}
    </section>
  );
}
