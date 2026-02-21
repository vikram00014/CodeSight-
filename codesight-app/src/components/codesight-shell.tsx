"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

import { ANIMATION_DISABLE_THRESHOLD } from "@/src/config/defaults";
import { CodeEditor } from "@/src/components/editor/code-editor";
import { ExecutionControls } from "@/src/components/editor/execution-controls";
import { ComplexityPanel } from "@/src/components/visualization/complexity-panel";
import { DebugPanel } from "@/src/components/visualization/debug-panel";
import { DSAVisualizationPanel } from "@/src/components/visualization/dsa-visualization-panel";
import { ErrorAutopsyPanel } from "@/src/components/visualization/error-autopsy-panel";
import { HeapPanel } from "@/src/components/visualization/heap-panel";
import { StackPanel } from "@/src/components/visualization/stack-panel";
import { TimelinePanel } from "@/src/components/visualization/timeline-panel";
import { VariableWatchPanel } from "@/src/components/visualization/variable-watch-panel";
import { executePipeline } from "@/src/execution-engine/execute-pipeline";
import { playbackEngine } from "@/src/playback/playback-engine";
import { useCodeSightStore } from "@/src/store/codesight-store";
import { ExecutionSnapshot } from "@/src/types/execution";
import {
  decodeTraceFromUrl,
  encodeTraceToUrl,
  exportTraceGzip,
  importTraceData,
} from "@/src/utils/trace-share";

const DEMO_PRESETS: Record<string, string> = {
  bubbleSort: `def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n-i-1):
            if arr[j] > arr[j+1]:
                arr[j], arr[j+1] = arr[j+1], arr[j]
    return arr

nums = [5, 1, 4, 2, 8]
print(bubble_sort(nums))
`,
  binarySearch: `def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        if arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1

nums = [1, 3, 5, 7, 9, 11, 15]
print(binary_search(nums, 9))
`,
  recursionFactorial: `def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)

print(factorial(6))
`,
  infiniteLoop: `count = 0
while True:
    count += 1
`,
  indexOutOfBounds: `arr = [10, 20, 30]
print(arr[3])
`,
};

function stopReasonLabel(reason?: string) {
  switch (reason) {
    case "completed":
      return "Completed normally";
    case "step-limit-hit":
      return "Stopped: max step limit hit";
    case "time-limit-hit":
      return "Stopped: execution time limit hit";
    case "infinite-loop-detected":
      return "Stopped: potential infinite loop detected";
    case "stdout-limit-hit":
      return "Stopped: stdout limit exceeded";
    case "runtime-error":
      return "Stopped: runtime error";
    default:
      return "Not executed yet";
  }
}

function firstArrayValuesFromSnapshot(snapshot?: ExecutionSnapshot) {
  if (!snapshot) {
    return undefined;
  }

  const values = Object.values(snapshot.variables);
  for (const variable of values) {
    if (variable.type !== "list") {
      continue;
    }

    const preview = variable.valuePreview.trim();
    if (!preview.startsWith("[") || !preview.endsWith("]")) {
      continue;
    }

    const body = preview.slice(1, -1).trim();
    if (!body) {
      return [];
    }

    if (body.includes("[") || body.includes("{") || body.includes("(")) {
      continue;
    }

    return body.split(",").map((item) => item.trim());
  }

  return undefined;
}

function normalizeComparableValue(value: string) {
  const trimmed = value.trim();
  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

const DETERMINISTIC_TEST_CODE = `def sum_n(n):
    if n == 0:
        return 0
    return n + sum_n(n-1)

print(sum_n(5))
`;

export function CodeSightShell() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<keyof typeof DEMO_PRESETS>("bubbleSort");
  const [showArchitecture, setShowArchitecture] = useState(false);
  const [testStatus, setTestStatus] = useState<string>("");
  const [deterministicPassed, setDeterministicPassed] = useState<boolean | null>(null);

  const code = useCodeSightStore((state) => state.code);
  const language = useCodeSightStore((state) => state.language);
  const status = useCodeSightStore((state) => state.status);
  const isPlaying = useCodeSightStore((state) => state.isPlaying);
  const speed = useCodeSightStore((state) => state.speed);
  const direction = useCodeSightStore((state) => state.direction);
  const currentStep = useCodeSightStore((state) => state.currentStep);
  const currentSnapshot = useCodeSightStore((state) => state.currentSnapshot);
  const runtimeError = useCodeSightStore((state) => state.runtimeError);
  const metadata = useCodeSightStore((state) => state.metadata);
  const lastRunRecap = useCodeSightStore((state) => state.lastRunRecap);
  const snapshots = useCodeSightStore((state) => state.snapshots);
  const compressedTrace = useCodeSightStore((state) => state.compressedTrace);
  const loaderState = useCodeSightStore((state) => state.loaderState);
  const safetyLimits = useCodeSightStore((state) => state.safetyLimits);
  const deterministicMode = useCodeSightStore((state) => state.deterministicMode);
  const animationsEnabled = useCodeSightStore((state) => state.animationsEnabled);

  const setCode = useCodeSightStore((state) => state.setCode);
  const setLanguage = useCodeSightStore((state) => state.setLanguage);
  const setExecutionStatus = useCodeSightStore((state) => state.setExecutionStatus);
  const setExecutionResult = useCodeSightStore((state) => state.setExecutionResult);
  const setRuntimeError = useCodeSightStore((state) => state.setRuntimeError);
  const setLoaderState = useCodeSightStore((state) => state.setLoaderState);
  const resetExecutionData = useCodeSightStore((state) => state.resetExecutionData);
  const setCurrentStepSnapshot = useCodeSightStore((state) => state.setCurrentStepSnapshot);
  const setCurrentStep = useCodeSightStore((state) => state.setCurrentStep);
  const play = useCodeSightStore((state) => state.play);
  const pause = useCodeSightStore((state) => state.pause);
  const setSpeed = useCodeSightStore((state) => state.setSpeed);
  const setDirection = useCodeSightStore((state) => state.setDirection);
  const resetPlayback = useCodeSightStore((state) => state.resetPlayback);
  const resetVisualization = useCodeSightStore((state) => state.resetVisualization);
  const setAnimationsEnabled = useCodeSightStore((state) => state.setAnimationsEnabled);
  const setSafetyLimits = useCodeSightStore((state) => state.setSafetyLimits);
  const setDeterministicMode = useCodeSightStore((state) => state.setDeterministicMode);

  const totalSteps = useMemo(
    () => metadata?.stepCount ?? snapshots.length,
    [metadata?.stepCount, snapshots.length],
  );

  const executionContextLine = useMemo(() => {
    if (!currentSnapshot) {
      return "Run code and step through to see a human-readable execution narrative.";
    }

    const variables = Object.values(currentSnapshot.variables);
    const iValue = variables.find((variable) => variable.name === "i")?.valuePreview;
    const jValue = variables.find((variable) => variable.name === "j")?.valuePreview;
    const latestOperation = [...currentSnapshot.arrayOperations].reverse()[0];

    const parts = [`${currentSnapshot.functionName} → line ${currentSnapshot.lineNumber}`];

    if (iValue !== undefined) {
      parts.push(`i = ${iValue}`);
    }

    if (jValue !== undefined) {
      parts.push(`j = ${jValue}`);
    }

    if (latestOperation?.type === "compare" && typeof latestOperation.j === "number") {
      const arrayValues = firstArrayValuesFromSnapshot(currentSnapshot);
      const leftValue = normalizeComparableValue(arrayValues?.[latestOperation.i] ?? "?");
      const rightValue = normalizeComparableValue(arrayValues?.[latestOperation.j] ?? "?");
      parts.push(
        `comparing ${leftValue} & ${rightValue}`,
      );
    } else if (latestOperation?.type === "swap" && typeof latestOperation.j === "number") {
      const arrayValues = firstArrayValuesFromSnapshot(currentSnapshot);
      const leftValue = normalizeComparableValue(arrayValues?.[latestOperation.i] ?? "?");
      const rightValue = normalizeComparableValue(arrayValues?.[latestOperation.j] ?? "?");
      parts.push(
        `swapping ${leftValue} ↔ ${rightValue}`,
      );
    } else if (latestOperation?.type === "overwrite") {
      parts.push(`writing ${latestOperation.variableName}[${latestOperation.i}] = ${latestOperation.value ?? "?"}`);
    }

    return parts.join(" → ");
  }, [currentSnapshot]);

  const learningInsight = useMemo(() => {
    if (!lastRunRecap) {
      return undefined;
    }

    const trendText =
      lastRunRecap.timeComplexityTrend === "unknown"
        ? "insufficient data for Big-O estimation"
        : `${lastRunRecap.timeComplexityTrend} growth trend`;

    return `Insight: This run performed ${lastRunRecap.comparisons} comparisons and ${lastRunRecap.swaps} swaps → ${trendText}.`;
  }, [lastRunRecap]);

  const overheadBreakdown = useMemo(() => {
    if (!lastRunRecap) {
      return undefined;
    }

    const total = Math.max(lastRunRecap.userCodeTimeMs + lastRunRecap.tracingOverheadMs, 1);
    const userPercent = Math.round((lastRunRecap.userCodeTimeMs / total) * 100);
    const tracePercent = Math.max(0, 100 - userPercent);

    return `User code: ${userPercent}% · Tracing overhead: ${tracePercent}%`;
  }, [lastRunRecap]);

  useEffect(() => {
    if (isPlaying) {
      playbackEngine.start();
      return;
    }

    playbackEngine.stop();
  }, [isPlaying]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const token = new URLSearchParams(window.location.search).get("trace");
    if (!token) {
      return;
    }

    try {
      const bundle = decodeTraceFromUrl(token);
      if (!bundle) {
        return;
      }

      setExecutionResult({
        snapshots: bundle.snapshots,
        compressedTrace: bundle.compressedTrace,
        metadata: bundle.metadata,
        runtimeError: bundle.snapshots[bundle.snapshots.length - 1]?.error,
      });
      setCurrentStep(0);
      setCurrentStepSnapshot(0);
      setAnimationsEnabled(bundle.metadata.stepCount < ANIMATION_DISABLE_THRESHOLD);
    } catch {
      console.error("Unable to decode shared trace URL.");
    }
  }, [setAnimationsEnabled, setCurrentStep, setCurrentStepSnapshot, setExecutionResult]);

  async function runCode(inputCode = code, deterministic = deterministicMode) {
    if (status === "running") {
      return;
    }

    pause();
    playbackEngine.stop();
    resetExecutionData();
    resetPlayback();
    setExecutionStatus("running");
    setRuntimeError(undefined);
    setLoaderState({ loading: true });

    try {
      const result = await executePipeline({
        code: inputCode,
        language,
        safetyLimits,
        deterministicMode: deterministic,
      });

      setExecutionResult({
        snapshots: result.snapshots,
        compressedTrace: result.compressedTrace,
        metadata: result.metadata,
        runtimeError: result.runtimeError,
      });

      setCurrentStep(0);
      setCurrentStepSnapshot(0);
      setLoaderState({
        loading: false,
        ready: true,
        recovered: Boolean(result.loaderRecovered),
      });

      setAnimationsEnabled(result.metadata.stepCount < ANIMATION_DISABLE_THRESHOLD);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Execution failed";
      setRuntimeError({
        type: "PipelineError",
        category: "unknown",
        message,
        line: -1,
      });
      setLoaderState({ loading: false });
      setExecutionStatus("error");
    }
  }

  function loadPreset(preset: keyof typeof DEMO_PRESETS) {
    const sample = DEMO_PRESETS[preset];
    setSelectedPreset(preset);
    setCode(sample);
    resetPlayback();
    setDeterministicPassed(null);
    setTestStatus(`Loaded preset: ${preset}`);
  }

  function stepForward() {
    const next = Math.min(currentStep + 1, Math.max(totalSteps - 1, 0));
    setCurrentStep(next);
    setCurrentStepSnapshot(next);
  }

  function stepBackward() {
    const next = Math.max(currentStep - 1, 0);
    setCurrentStep(next);
    setCurrentStepSnapshot(next);
  }

  function resetAll() {
    pause();
    playbackEngine.stop();
    resetExecutionData();
    resetPlayback();
    resetVisualization();
    setDeterministicPassed(null);
    setTestStatus("");
  }

  function handlePlayPause() {
    if (totalSteps === 0) {
      return;
    }

    if (isPlaying) {
      pause();
      playbackEngine.stop();
      return;
    }

    play();
  }

  async function runDeterministicValidation() {
    setCode(DETERMINISTIC_TEST_CODE);
    setTestStatus("Running deterministic test...");

    await runCode(DETERMINISTIC_TEST_CODE, true);
    const postRunState = useCodeSightStore.getState();
    const valid =
      (postRunState.metadata?.stepCount ?? 0) > 0 &&
      (postRunState.snapshots[0]?.lineNumber ?? -1) > 0 &&
      postRunState.metadata?.stopReason === "completed";

    setDeterministicPassed(valid);

    setTestStatus(valid ? "Deterministic test passed." : "Deterministic test failed.");
  }

  async function exportTrace() {
    if (!metadata || !compressedTrace) {
      return;
    }

    const gzBytes = await exportTraceGzip({ snapshots, compressedTrace, metadata });
    const blobBytes = new Uint8Array(gzBytes.byteLength);
    blobBytes.set(gzBytes);
    const blob = new Blob([blobBytes], { type: "application/gzip" });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "codesight-trace.codesight.gz";
    anchor.click();

    URL.revokeObjectURL(url);
  }

  async function importTrace(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const buffer = await file.arrayBuffer();
    const bundle = await importTraceData(buffer);

    setExecutionResult({
      snapshots: bundle.snapshots,
      compressedTrace: bundle.compressedTrace,
      metadata: bundle.metadata,
      runtimeError: bundle.snapshots[bundle.snapshots.length - 1]?.error,
    });
    setCurrentStep(0);
    setCurrentStepSnapshot(0);
    setAnimationsEnabled(bundle.metadata.stepCount < ANIMATION_DISABLE_THRESHOLD);
    setTestStatus("Trace imported successfully.");

    event.target.value = "";
  }

  async function copyShareLink() {
    if (!metadata || !compressedTrace) {
      return;
    }

    const token = encodeTraceToUrl({ snapshots, compressedTrace, metadata });
    const url = new URL(window.location.href);
    url.searchParams.set("trace", token);
    await navigator.clipboard.writeText(url.toString());
    setTestStatus("Shareable trace link copied to clipboard.");
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1600px] space-y-5 px-4 py-5 text-zinc-100 md:px-6">
      <header className="rounded-2xl border border-zinc-700/70 bg-zinc-950/70 p-5 shadow-[0_12px_36px_rgba(0,0,0,0.32)] backdrop-blur">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-50">CodeSight ⭐</h1>
        <p className="mt-1 text-sm text-zinc-300">
          Local interactive execution visualizer with reverse debugging and DSA insights.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="text-xs">
            Language
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value as "python" | "cpp")}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5"
            >
              <option value="python">Python (Pyodide)</option>
              <option value="cpp">C++ (scaffold)</option>
            </select>
          </label>

          <label className="text-xs">
            Max Steps
            <input
              type="number"
              value={safetyLimits.maxSteps}
              onChange={(event) =>
                setSafetyLimits({ maxSteps: Math.max(1, Number(event.target.value) || 1) })
              }
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5"
            />
          </label>

          <label className="text-xs">
            Execution Time Limit
            <input
              type="number"
              value={safetyLimits.maxExecutionTimeMs}
              onChange={(event) =>
                setSafetyLimits({
                  maxExecutionTimeMs: Math.max(1, Number(event.target.value) || 1),
                })
              }
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5"
            />
          </label>

          <label className="text-xs">
            Recursion Depth
            <input
              type="number"
              value={safetyLimits.maxRecursionDepth}
              onChange={(event) =>
                setSafetyLimits({
                  maxRecursionDepth: Math.max(1, Number(event.target.value) || 1),
                })
              }
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5"
            />
          </label>

          <label className="text-xs">
            Playback Speed
            <select
              value={speed}
              onChange={(event) => setSpeed(Number(event.target.value))}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5"
            >
              <option value={0.15}>Step</option>
              <option value={0.5}>Slow</option>
              <option value={1}>Normal</option>
              <option value={2}>Fast</option>
              <option value={4}>Instant</option>
            </select>
          </label>

          <label className="text-xs">
            Direction
            <select
              value={direction}
              onChange={(event) => setDirection(event.target.value as "forward" | "backward")}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5"
            >
              <option value="forward">Forward</option>
              <option value="backward">Backward</option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-300">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={deterministicMode}
              onChange={(event) => setDeterministicMode(event.target.checked)}
            />
            Deterministic mode
          </label>

          <span className="rounded border border-zinc-700 px-2 py-1">
            status: <b>{status}</b>
          </span>
          <span className="rounded border border-zinc-700 px-2 py-1">
            loader: {loaderState.loading ? "loading" : loaderState.ready ? "ready" : "idle"}
          </span>
          {loaderState.recovered ? (
            <span className="rounded border border-amber-700 bg-amber-900/40 px-2 py-1 text-amber-200">
              recovered from loader failure
            </span>
          ) : null}
          <span className="rounded border border-zinc-700 px-2 py-1">
            animations: {animationsEnabled ? "on" : "auto-disabled"}
          </span>
          <span className="rounded border border-zinc-700 px-2 py-1">
            why stopped: {stopReasonLabel(metadata?.stopReason)}
          </span>
          {deterministicPassed !== null ? (
            <span
              className={`rounded border px-2 py-1 ${
                deterministicPassed
                  ? "border-emerald-700 bg-emerald-900/30 text-emerald-200"
                  : "border-rose-700 bg-rose-900/30 text-rose-200"
              }`}
            >
              deterministic: {deterministicPassed ? "PASS" : "FAIL"}
            </span>
          ) : null}
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 text-xs">
            <div className="mb-1 font-semibold text-zinc-200">Execution Summary</div>
            <div className="grid grid-cols-2 gap-2 text-zinc-400">
              <span>steps: {metadata?.stepCount ?? 0}</span>
              <span>time: {metadata?.executionTimeMs ?? 0} ms</span>
              <span>peak stack: {metadata?.peakStackDepth ?? 0}</span>
              <span>max heap: {metadata?.maxHeapSize ?? 0}</span>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 text-xs">
            <div className="mb-1 font-semibold text-zinc-200">Demo Presets</div>
            <div className="flex gap-2">
              <select
                value={selectedPreset}
                onChange={(event) => loadPreset(event.target.value as keyof typeof DEMO_PRESETS)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1"
              >
                <option value="bubbleSort">Bubble Sort</option>
                <option value="binarySearch">Binary Search</option>
                <option value="recursionFactorial">Recursion Factorial</option>
                <option value="infiniteLoop">Infinite Loop Demo</option>
                <option value="indexOutOfBounds">Index out of bounds demo</option>
              </select>
              <button
                type="button"
                onClick={() => runCode(DEMO_PRESETS[selectedPreset])}
                disabled={status === "running"}
                className="rounded-lg border border-zinc-700 px-2.5 py-1 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Run
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 text-xs">
            <div className="mb-1 font-semibold text-zinc-200">Last Run Quick Recap</div>
            {lastRunRecap ? (
              <div className="grid grid-cols-2 gap-2 text-zinc-400">
                <span>steps: {lastRunRecap.stepCount}</span>
                <span>time: {lastRunRecap.executionTimeMs} ms</span>
                <span>input size (n): {lastRunRecap.inputSize}</span>
                <span>user code: {lastRunRecap.userCodeTimeMs} ms</span>
                <span>stop: {lastRunRecap.stopReason}</span>
                <span>peak stack: {lastRunRecap.peakStackDepth}</span>
                <span>max heap: {lastRunRecap.maxHeapSize}</span>
                <span>
                  at: {new Date(lastRunRecap.completedAtIso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span>tracing: {lastRunRecap.tracingOverheadMs} ms</span>
                {overheadBreakdown ? (
                  <span className="col-span-2 text-cyan-300">{overheadBreakdown}</span>
                ) : null}
                {learningInsight ? (
                  <span className="col-span-2 text-emerald-300">{learningInsight}</span>
                ) : null}
                {lastRunRecap.errorMessage ? (
                  <span className="col-span-2 truncate text-rose-300">
                    error: {lastRunRecap.errorMessage}
                  </span>
                ) : null}
              </div>
            ) : (
              <div className="text-zinc-500">Run code once to pin recap here.</div>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportTrace}
            className="rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-1.5 text-xs"
          >
            Export Trace (gzip)
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-1.5 text-xs"
          >
            Import Trace (json/gzip)
          </button>
          <button
            type="button"
            onClick={copyShareLink}
            className="rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-1.5 text-xs"
          >
            Copy Share Link
          </button>
          <button
            type="button"
            onClick={runDeterministicValidation}
            className="rounded-lg border border-emerald-700 bg-emerald-900/20 px-3 py-1.5 text-xs text-emerald-200"
          >
            Run Deterministic Test
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,application/gzip,.gz,.json"
            className="hidden"
            onChange={importTrace}
          />
          <button
            type="button"
            onClick={() => setShowArchitecture((value) => !value)}
            className="rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-1.5 text-xs"
          >
            {showArchitecture ? "Hide" : "Show"} Architecture
          </button>
          {testStatus ? <span className="text-xs text-zinc-400">{testStatus}</span> : null}
        </div>

        {showArchitecture ? (
          <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/30 p-3 text-xs text-zinc-400">
            pipeline: worker raw trace → normalizeTrace() → ExecutionSnapshot[] → compression + hydration
            → playback engine → panels (stack, variables, Memory Graph, DSA, complexity).
          </div>
        ) : null}
      </header>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 shadow-[0_8px_30px_rgba(0,0,0,0.26)]">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-300">
            <span className="font-semibold text-zinc-100">Execution Context:</span> {executionContextLine}
          </div>

          <CodeEditor
            code={code}
            language={language}
            onChange={setCode}
            currentLine={currentSnapshot?.lineNumber}
            errorLine={runtimeError?.line}
            readOnly={isPlaying || status === "running"}
          />

          <ExecutionControls
            isRunning={status === "running"}
            isPlaying={isPlaying}
            onRun={() => runCode()}
            onPlayPause={handlePlayPause}
            onStepBackward={stepBackward}
            onStepForward={stepForward}
            onReset={resetAll}
          />

          <TimelinePanel />
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
          <StackPanel />
          <VariableWatchPanel />
          <HeapPanel />
          <ErrorAutopsyPanel />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <DSAVisualizationPanel />
        <ComplexityPanel />
      </section>

      <DebugPanel />
    </main>
  );
}
