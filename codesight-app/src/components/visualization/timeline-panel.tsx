"use client";

import { useMemo } from "react";

import { useCodeSightStore } from "@/src/store/codesight-store";

function buildVirtualStepWindow(currentStep: number, stepCount: number, windowSize = 200) {
  const start = Math.max(0, currentStep - Math.floor(windowSize / 2));
  const end = Math.min(stepCount, start + windowSize);
  const steps: number[] = [];

  for (let i = start; i < end; i += 1) {
    steps.push(i);
  }

  return { start, end, steps };
}

export function TimelinePanel() {
  const currentStep = useCodeSightStore((state) => state.currentStep);
  const stepCount = useCodeSightStore(
    (state) => state.metadata?.stepCount ?? state.snapshots.length,
  );
  const snapshots = useCodeSightStore((state) => state.snapshots);
  const setCurrentStep = useCodeSightStore((state) => state.setCurrentStep);
  const setCurrentStepSnapshot = useCodeSightStore(
    (state) => state.setCurrentStepSnapshot,
  );

  const windowedSteps = useMemo(
    () => buildVirtualStepWindow(currentStep, stepCount),
    [currentStep, stepCount],
  );

  if (stepCount === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 p-3 text-sm text-zinc-400">
        No execution steps yet.
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="mb-3 flex items-center justify-between text-xs text-zinc-400">
        <span>
          Step {currentStep + 1} / {stepCount}
        </span>
        <span>
          Virtualized: {windowedSteps.start + 1}-{windowedSteps.end}
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={Math.max(stepCount - 1, 0)}
        value={Math.min(currentStep, Math.max(stepCount - 1, 0))}
        onChange={(event) => {
          const nextStep = Number(event.target.value);
          setCurrentStep(nextStep);
          setCurrentStepSnapshot(nextStep);
        }}
        className="w-full"
      />

      <div className="mt-3 h-2 w-full overflow-hidden rounded bg-zinc-900">
        <div
          className="h-full bg-emerald-500"
          style={{ width: `${((currentStep + 1) / Math.max(stepCount, 1)) * 100}%` }}
        />
      </div>

      <div className="mt-3 flex max-h-24 flex-wrap gap-1 overflow-auto">
        {windowedSteps.steps.map((step) => {
          const active = step === currentStep;
          const snap = snapshots[step];
          const hover = snap
            ? `line ${snap.lineNumber} · vars Δ ${snap.changedVariables.length}`
            : `step ${step}`;

          return (
            <button
              key={step}
              type="button"
              title={hover}
              onClick={() => {
                setCurrentStep(step);
                setCurrentStepSnapshot(step);
              }}
              className={`rounded px-2 py-1 text-xs ${
                active
                  ? "bg-emerald-500 text-black"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              {step}
            </button>
          );
        })}
      </div>
    </section>
  );
}
