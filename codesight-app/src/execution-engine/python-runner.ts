"use client";

import { IRunner } from "@/src/execution-engine/runner-interface";
import {
  RunnerExecutionRequest,
  RunnerExecutionResponse,
  RunnerHealthStatus,
} from "@/src/execution-engine/types";
import { PyodideWorkerClient } from "@/src/execution-engine/pyodide-worker-client";

export class PythonRunner implements IRunner {
  readonly language = "python" as const;

  private readonly workerClient = PyodideWorkerClient.getInstance();

  async execute(request: RunnerExecutionRequest): Promise<RunnerExecutionResponse> {
    if (request.language !== "python") {
      throw new Error(`PythonRunner cannot execute language: ${request.language}`);
    }

    const { result, loaderRecovered } = await this.workerClient.run(
      request.code,
      request.safetyLimits,
      request.deterministicMode,
    );

    return {
      ...result,
      loaderRecovered,
    };
  }

  health(): RunnerHealthStatus {
    return this.workerClient.health();
  }

  async reset(): Promise<void> {
    await this.workerClient.reset();
  }
}
