import { DEFAULT_CHECKPOINT_INTERVAL } from "@/src/config/defaults";
import { getRunner } from "@/src/execution-engine/runner-registry";
import { RunnerExecutionRequest } from "@/src/execution-engine/types";
import {
  compressSnapshots,
  normalizeTrace,
} from "@/src/trace-parser/trace-normalizer";
import {
  CompressedTrace,
  ExecutionSnapshot,
  RuntimeError,
  TraceMetadata,
} from "@/src/types/execution";

export interface ExecutePipelineResult {
  snapshots: ExecutionSnapshot[];
  compressedTrace: CompressedTrace;
  metadata: TraceMetadata;
  runtimeError?: RuntimeError;
  loaderRecovered?: boolean;
}

export async function executePipeline(
  request: RunnerExecutionRequest,
): Promise<ExecutePipelineResult> {
  const runner = getRunner(request.language);
  const rawResponse = await runner.execute(request);

  const { snapshots, heapObjectsById } = normalizeTrace(rawResponse);
  const compressedTrace = compressSnapshots(snapshots, heapObjectsById, {
    checkpointInterval: DEFAULT_CHECKPOINT_INTERVAL,
  });

  const timeComplexityTrend = inferTimeComplexityTrend();

  const metadata: TraceMetadata = {
    language: request.language,
    executionTimeMs: rawResponse.executionTimeMs,
    workerExecutionTimeMs: rawResponse.workerExecutionTimeMs ?? rawResponse.executionTimeMs,
    userCodeTimeMs:
      rawResponse.userCodeTimeMs ??
      Math.max(
        0,
        (rawResponse.workerExecutionTimeMs ?? rawResponse.executionTimeMs) -
          (rawResponse.tracingOverheadMs ?? 0),
      ),
    tracingOverheadMs:
      rawResponse.tracingOverheadMs ??
      Math.max(
        0,
        (rawResponse.workerExecutionTimeMs ?? rawResponse.executionTimeMs) -
          (rawResponse.userCodeTimeMs ?? rawResponse.executionTimeMs),
      ),
    stepCount: snapshots.length,
    snapshotBytes: JSON.stringify(compressedTrace).length,
    wasTruncated: rawResponse.wasTruncated,
    stopReason: rawResponse.stopReason,
    peakStackDepth: rawResponse.peakStackDepth,
    totalObjectsCreated: rawResponse.totalObjectsCreated,
    maxHeapSize: rawResponse.maxHeapSize,
    timeComplexityTrend,
  };

  return {
    snapshots,
    compressedTrace,
    metadata,
    runtimeError: snapshots[snapshots.length - 1]?.error ?? rawResponse.error,
    loaderRecovered: rawResponse.loaderRecovered,
  };
}

function inferTimeComplexityTrend(): TraceMetadata["timeComplexityTrend"] {
  // Big-O should not be inferred from a single trace execution.
  // Observed growth can be estimated only from multiple runs across varying input sizes.
  return "unknown";
}
