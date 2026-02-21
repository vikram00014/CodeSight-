import { StateCreator } from "zustand";

import { hydrateSnapshot } from "@/src/trace-parser/trace-normalizer";
import {
  CompressedTrace,
  ExecutionSnapshot,
  RuntimeError,
  SupportedLanguage,
  TraceMetadata,
} from "@/src/types/execution";

export interface LastRunRecap {
  language: SupportedLanguage;
  stepCount: number;
  inputSize: number;
  executionTimeMs: number;
  userCodeTimeMs: number;
  tracingOverheadMs: number;
  stopReason: TraceMetadata["stopReason"];
  peakStackDepth: number;
  maxHeapSize: number;
  comparisons: number;
  assignments: number;
  swaps: number;
  timeComplexityTrend: TraceMetadata["timeComplexityTrend"];
  completedAtIso: string;
  errorMessage?: string;
}

function parsePrimitiveList(valuePreview: string): string[] | undefined {
  const trimmed = valuePreview.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    return undefined;
  }

  const body = trimmed.slice(1, -1).trim();
  if (!body) {
    return [];
  }

  if (body.includes("[") || body.includes("{") || body.includes("(")) {
    return undefined;
  }

  return body.split(",").map((item) => item.trim());
}

function inferInputSize(snapshot?: ExecutionSnapshot): number {
  if (!snapshot) {
    return 0;
  }

  const variables = Object.values(snapshot.variables);
  for (const variable of variables) {
    if (variable.type !== "list") {
      continue;
    }

    const parsed = parsePrimitiveList(variable.valuePreview);
    if (parsed) {
      return parsed.length;
    }
  }

  return 0;
}

export interface ExecutionDataSlice {
  language: SupportedLanguage;
  code: string;
  snapshots: ReadonlyArray<ExecutionSnapshot>;
  compressedTrace?: CompressedTrace;
  metadata?: TraceMetadata;
  lastRunRecap?: LastRunRecap;
  status: "idle" | "running" | "completed" | "error";
  currentSnapshot?: ExecutionSnapshot;
  runtimeError?: RuntimeError;
  loaderState: {
    loading: boolean;
    ready: boolean;
    recovered: boolean;
  };
  setCode: (code: string) => void;
  setLanguage: (language: SupportedLanguage) => void;
  setExecutionStatus: (status: ExecutionDataSlice["status"]) => void;
  setLoaderState: (loaderState: Partial<ExecutionDataSlice["loaderState"]>) => void;
  setRuntimeError: (runtimeError?: RuntimeError) => void;
  setExecutionResult: (payload: {
    snapshots: ReadonlyArray<ExecutionSnapshot>;
    compressedTrace: CompressedTrace;
    metadata: TraceMetadata;
    runtimeError?: RuntimeError;
  }) => void;
  setCurrentStepSnapshot: (step: number) => void;
  resetExecutionData: () => void;
}

const DEFAULT_CODE = `def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n-i-1):
            if arr[j] > arr[j+1]:
                arr[j], arr[j+1] = arr[j+1], arr[j]
    return arr

nums = [5, 1, 4, 2, 8]
print(bubble_sort(nums))
`;

const DEFAULT_CPP_CODE = `#include <iostream>
#include <vector>
using namespace std;

int main() {
    vector<int> nums = {5, 1, 4, 2, 8};
    for (int n : nums) {
        cout << n << " ";
    }
    cout << endl;
    return 0;
}
`;

function defaultCodeFor(language: SupportedLanguage) {
  return language === "cpp" ? DEFAULT_CPP_CODE : DEFAULT_CODE;
}

export const createExecutionDataSlice: StateCreator<
  ExecutionDataSlice,
  [],
  [],
  ExecutionDataSlice
> = (set, get) => ({
  language: "python",
  code: DEFAULT_CODE,
  snapshots: [],
  compressedTrace: undefined,
  metadata: undefined,
  lastRunRecap: undefined,
  status: "idle",
  currentSnapshot: undefined,
  runtimeError: undefined,
  loaderState: {
    loading: false,
    ready: false,
    recovered: false,
  },

  setCode: (code) => set({ code }),
  setLanguage: (language) =>
    set({
      language,
      code: defaultCodeFor(language),
    }),
  setExecutionStatus: (status) => set({ status }),
  setLoaderState: (loaderState) =>
    set((state) => ({
      loaderState: {
        ...state.loaderState,
        ...loaderState,
      },
    })),

  setRuntimeError: (runtimeError) => set({ runtimeError, status: runtimeError ? "error" : "idle" }),

  setExecutionResult: ({ snapshots, compressedTrace, metadata, runtimeError }) => {
    const lastSnapshot = snapshots[snapshots.length - 1];
    const firstSnapshot = snapshots[0];

    set({
      snapshots,
      compressedTrace,
      metadata,
      lastRunRecap: {
        language: metadata.language,
        stepCount: metadata.stepCount,
        inputSize: inferInputSize(firstSnapshot),
        executionTimeMs: metadata.executionTimeMs,
        userCodeTimeMs: metadata.userCodeTimeMs,
        tracingOverheadMs: metadata.tracingOverheadMs,
        stopReason: metadata.stopReason,
        peakStackDepth: metadata.peakStackDepth,
        maxHeapSize: metadata.maxHeapSize,
        comparisons: lastSnapshot?.operationCounters.comparisons ?? 0,
        assignments: lastSnapshot?.operationCounters.assignments ?? 0,
        swaps: lastSnapshot?.operationCounters.swaps ?? 0,
        timeComplexityTrend: metadata.timeComplexityTrend,
        completedAtIso: new Date().toISOString(),
        errorMessage: runtimeError?.message,
      },
      runtimeError,
      status: runtimeError ? "error" : "completed",
      currentSnapshot: snapshots[0],
    });
  },

  setCurrentStepSnapshot: (step) => {
    const { compressedTrace, snapshots } = get();
    if (!compressedTrace) {
      set({ currentSnapshot: snapshots[step] });
      return;
    }

    const hydrated = hydrateSnapshot(compressedTrace, step);
    if (hydrated) {
      set({ currentSnapshot: hydrated });
    }
  },

  resetExecutionData: () =>
    set({
      snapshots: [],
      compressedTrace: undefined,
      metadata: undefined,
      status: "idle",
      currentSnapshot: undefined,
      runtimeError: undefined,
      loaderState: {
        loading: false,
        ready: get().loaderState.ready,
        recovered: false,
      },
    }),
});
