"use client";

import { useCodeSightStore } from "@/src/store/codesight-store";

function categoryHint(category?: string) {
  switch (category) {
    case "array-bounds":
      return "Index went outside valid bounds. Check loop conditions and index arithmetic.";
    case "stack-overflow":
      return "Recursion depth exceeded safe limit. Ensure base condition is reachable.";
    case "infinite-loop":
      return "Execution repeated equivalent state too many times. Validate update conditions.";
    case "timeout":
      return "Execution exceeded time budget. Reduce complexity or input size.";
    case "memory":
      return "Memory-related failure detected. Inspect object references and growth.";
    default:
      return "Unhandled runtime category. Inspect stack/variables near failing line.";
  }
}

export function ErrorAutopsyPanel() {
  const runtimeError = useCodeSightStore((state) => state.runtimeError);

  if (!runtimeError) {
    return (
      <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
        <h3 className="mb-2 text-sm font-semibold text-zinc-100">Runtime Error Autopsy</h3>
        <p className="text-xs text-zinc-400">No runtime error captured.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-rose-700/60 bg-rose-950/20 p-4">
      <h3 className="mb-2 text-sm font-semibold text-rose-200">Runtime Error Autopsy</h3>
      <div className="space-y-1 text-xs text-rose-100">
        <p>
          <span className="font-semibold">Type:</span> {runtimeError.type}
        </p>
        <p>
          <span className="font-semibold">Line:</span> {runtimeError.line}
        </p>
        <p>
          <span className="font-semibold">Message:</span> {runtimeError.message}
        </p>
        <p>
          <span className="font-semibold">Category:</span> {runtimeError.category}
        </p>
        {runtimeError.relatedMemoryRef !== undefined ? (
          <p>
            <span className="font-semibold">Related memory ref:</span>{" "}
            {runtimeError.relatedMemoryRef}
          </p>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-rose-200/80">{categoryHint(runtimeError.category)}</p>
    </section>
  );
}
