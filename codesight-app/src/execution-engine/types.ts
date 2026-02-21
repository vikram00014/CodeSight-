import {
  ExecutionSafetyLimits,
  RuntimeError,
  SupportedLanguage,
} from "@/src/types/execution";
import { RawExecutionResult } from "@/src/types/raw-trace";

export interface RunnerExecutionRequest {
  code: string;
  language: SupportedLanguage;
  safetyLimits: ExecutionSafetyLimits;
  deterministicMode?: boolean;
}

export interface RunnerExecutionResponse extends RawExecutionResult {
  loaderRecovered?: boolean;
}

export interface RunnerHealthStatus {
  ready: boolean;
  loading: boolean;
  lastError?: RuntimeError;
}
