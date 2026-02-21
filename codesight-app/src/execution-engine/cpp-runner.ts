import { IRunner } from "@/src/execution-engine/runner-interface";
import {
  RunnerExecutionRequest,
  RunnerExecutionResponse,
  RunnerHealthStatus,
} from "@/src/execution-engine/types";

export class CppRunner implements IRunner {
  readonly language = "cpp" as const;

  async execute(request: RunnerExecutionRequest): Promise<RunnerExecutionResponse> {
    if (request.language !== "cpp") {
      throw new Error(`CppRunner cannot execute language: ${request.language}`);
    }

    return {
      rawTrace: [],
      stdout: [],
      error: {
        type: "CppRunnerUnavailable",
        category: "unknown",
        message:
          "C++ runner scaffold is prepared but local sandbox implementation is pending in next phase.",
        line: -1,
      },
      executionTimeMs: 0,
      workerExecutionTimeMs: 0,
      stopReason: "runtime-error",
      peakStackDepth: 0,
      totalObjectsCreated: 0,
      maxHeapSize: 0,
      wasTruncated: false,
      loaderRecovered: false,
    };
  }

  health(): RunnerHealthStatus {
    return {
      ready: false,
      loading: false,
      lastError: {
        type: "CppRunnerUnavailable",
        category: "unknown",
        message:
          "C++ local sandbox adapter is not yet wired. Interface is ready for integration.",
        line: -1,
      },
    };
  }

  async reset(): Promise<void> {
    return Promise.resolve();
  }
}
