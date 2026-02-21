import { ExecutionSafetyLimits, RuntimeError } from "@/src/types/execution";
import { RawExecutionResult } from "@/src/types/raw-trace";

export type WorkerRequest =
  | { id: string; type: "INIT"; retry?: boolean }
  | {
      id: string;
      type: "RUN";
      payload: {
        code: string;
        safetyLimits: ExecutionSafetyLimits;
        deterministicMode?: boolean;
      };
    }
  | { id: string; type: "RESET" };

export interface WorkerResponse {
  id: string;
  ok: boolean;
  loading: boolean;
  ready: boolean;
  loaderRecovered?: boolean;
  result?: RawExecutionResult;
  error?: RuntimeError;
}
