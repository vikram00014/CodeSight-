import { ExecutionSafetyLimits } from "@/src/types/execution";

export const DEFAULT_SAFETY_LIMITS: ExecutionSafetyLimits = {
  maxSteps: 10_000,
  maxExecutionTimeMs: 4_000,
  maxRecursionDepth: 200,
  maxStdoutSize: 20_000,
  infiniteLoopRepeatThreshold: 60,
};

export const DEFAULT_CHECKPOINT_INTERVAL = 25;
export const LARGE_TRACE_STEP_THRESHOLD = 10_000;
export const ANIMATION_DISABLE_THRESHOLD = 1_500;
