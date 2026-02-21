import {
  ArrayOperationEvent,
  ExecutionStopReason,
  HeapObject,
  RuntimeError,
  VariableState,
} from "@/src/types/execution";

export type TraceEventType = "line" | "call" | "return";

export interface RawStackFrame {
  frameId: string;
  functionName: string;
  filename: string;
  isUserFrame: boolean;
  lineNumber: number;
  locals: VariableState[];
}

export interface RawTraceSnapshot {
  step: number;
  lineNumber: number;
  functionName: string;
  event: TraceEventType;
  variables: VariableState[];
  stackFrames: RawStackFrame[];
  internalVariables?: VariableState[];
  heap: HeapObject[];
  arrayOperations?: ArrayOperationEvent[];
  stdout: string[];
  error?: RuntimeError;
}

export interface RawExecutionResult {
  rawTrace: RawTraceSnapshot[];
  stdout: string[];
  error?: RuntimeError;
  executionTimeMs: number;
  workerExecutionTimeMs?: number;
  userCodeTimeMs?: number;
  tracingOverheadMs?: number;
  stopReason: ExecutionStopReason;
  peakStackDepth: number;
  totalObjectsCreated: number;
  maxHeapSize: number;
  wasTruncated: boolean;
}
