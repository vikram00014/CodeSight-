"use client";

import { ExecutionSafetyLimits, RuntimeError } from "@/src/types/execution";
import { RawExecutionResult } from "@/src/types/raw-trace";
import { WorkerRequest, WorkerResponse } from "@/src/workers/contracts";

interface PendingRequest {
  resolve: (value: WorkerResponse) => void;
  reject: (reason?: unknown) => void;
  timeoutId: number;
}

export interface PyodideWorkerHealth {
  ready: boolean;
  loading: boolean;
  lastError?: RuntimeError;
}

export class PyodideWorkerClient {
  private static instance: PyodideWorkerClient | null = null;

  static getInstance(): PyodideWorkerClient {
    if (!PyodideWorkerClient.instance) {
      PyodideWorkerClient.instance = new PyodideWorkerClient();
    }

    return PyodideWorkerClient.instance;
  }

  private readonly worker: Worker;
  private readonly pending = new Map<string, PendingRequest>();
  private ready = false;
  private loading = false;
  private lastError: RuntimeError | undefined;

  private constructor() {
    this.worker = new Worker(
      new URL("../workers/pyodide.worker.ts", import.meta.url),
      { type: "module" },
    );

    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      this.ready = response.ready;
      this.loading = response.loading;
      this.lastError = response.error;

      const pending = this.pending.get(response.id);
      if (!pending) {
        return;
      }

      clearTimeout(pending.timeoutId);
      this.pending.delete(response.id);
      pending.resolve(response);
    };

    this.worker.onerror = (event) => {
      this.loading = false;
      this.lastError = {
        type: "WorkerError",
        category: "unknown",
        message: event.message,
        line: -1,
      };
    };
  }

  async initialize(retry = false): Promise<WorkerResponse> {
    this.loading = true;
    const response = await this.request({
      id: crypto.randomUUID(),
      type: "INIT",
      retry,
    });

    if (!response.ok) {
      throw new Error(response.error?.message ?? "Failed to initialize Pyodide worker");
    }

    return response;
  }

  async run(
    code: string,
    safetyLimits: ExecutionSafetyLimits,
    deterministicMode?: boolean,
  ): Promise<{ result: RawExecutionResult; loaderRecovered: boolean }> {
    if (!this.ready) {
      await this.initialize(false);
    }

    const response = await this.request({
      id: crypto.randomUUID(),
      type: "RUN",
      payload: { code, safetyLimits, deterministicMode },
    });

    if (response.ok && response.result) {
      return {
        result: response.result,
        loaderRecovered: Boolean(response.loaderRecovered),
      };
    }

    const shouldRetry = !response.ok;
    if (shouldRetry) {
      await this.initialize(true);
      const retryResponse = await this.request({
        id: crypto.randomUUID(),
        type: "RUN",
        payload: { code, safetyLimits, deterministicMode },
      });

      if (retryResponse.ok && retryResponse.result) {
        return {
          result: retryResponse.result,
          loaderRecovered: true,
        };
      }

      throw new Error(retryResponse.error?.message ?? "Python execution failed after recovery");
    }

    throw new Error(response.error?.message ?? "Python execution failed");
  }

  async reset(): Promise<void> {
    await this.request({ id: crypto.randomUUID(), type: "RESET" });
  }

  health(): PyodideWorkerHealth {
    return {
      ready: this.ready,
      loading: this.loading,
      lastError: this.lastError,
    };
  }

  private request(payload: WorkerRequest, timeoutMs = 45_000): Promise<WorkerResponse> {
    return new Promise<WorkerResponse>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        this.pending.delete(payload.id);
        reject(new Error(`Worker request timed out: ${payload.type}`));
      }, timeoutMs);

      this.pending.set(payload.id, { resolve, reject, timeoutId });
      this.worker.postMessage(payload);
    });
  }
}
