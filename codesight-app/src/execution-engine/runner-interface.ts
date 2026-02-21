import {
  RunnerExecutionRequest,
  RunnerExecutionResponse,
  RunnerHealthStatus,
} from "@/src/execution-engine/types";
import { SupportedLanguage } from "@/src/types/execution";

export interface IRunner {
  readonly language: SupportedLanguage;
  execute(request: RunnerExecutionRequest): Promise<RunnerExecutionResponse>;
  health(): RunnerHealthStatus;
  reset(): Promise<void>;
}
