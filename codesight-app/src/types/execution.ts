export type SupportedLanguage = "python" | "cpp";

export type RuntimeErrorCategory =
  | "array-bounds"
  | "stack-overflow"
  | "infinite-loop"
  | "timeout"
  | "memory"
  | "syntax"
  | "unknown";

export type ExecutionStopReason =
  | "completed"
  | "step-limit-hit"
  | "time-limit-hit"
  | "infinite-loop-detected"
  | "stdout-limit-hit"
  | "runtime-error";

export type StructureType =
  | "array"
  | "linked-list"
  | "stack"
  | "queue"
  | "tree"
  | "graph"
  | "unknown";

export interface ExecutionSafetyLimits {
  maxSteps: number;
  maxExecutionTimeMs: number;
  maxRecursionDepth: number;
  maxStdoutSize: number;
  infiniteLoopRepeatThreshold: number;
}

export interface VariableState {
  name: string;
  type: string;
  scope: "local" | "global";
  valuePreview: string;
  objectId?: number;
  isInternal?: boolean;
}

export interface StackFrame {
  frameId: string;
  functionName: string;
  filename: string;
  isUserFrame: boolean;
  lineNumber: number;
  locals: VariableState[];
}

export type HeapObjectClassification =
  | "primitive"
  | "userObject"
  | "function"
  | "module"
  | "internal";

export interface HeapObject {
  objectId: number;
  type: string;
  repr: string;
  moduleName?: string;
  classification: HeapObjectClassification;
  fieldRefs?: Record<string, number | null>;
  isListOfPrimitives?: boolean;
  isDictOfPrimitives?: boolean;
  references: number[];
}

export interface PointerEdge {
  from: string;
  to: string;
  label?: string;
}

export interface PointerGraph {
  nodes: string[];
  edges: PointerEdge[];
}

export interface RuntimeError {
  type: string;
  category: RuntimeErrorCategory;
  message: string;
  line: number;
  relatedMemoryRef?: number;
}

export interface OperationCounters {
  comparisons: number;
  assignments: number;
  swaps: number;
}

export interface ArrayOperationEvent {
  type: "compare" | "swap" | "overwrite";
  variableName: string;
  i: number;
  j?: number;
  value?: string;
}

export interface DSAStructureTag {
  structureType: StructureType;
  variableName: string;
  confidence: number;
}

export interface ExecutionSnapshot {
  step: number;
  lineNumber: number;
  functionName: string;
  variables: Record<string, VariableState>;
  stackFrames: StackFrame[];
  internalStackFrames: StackFrame[];
  internalVariables: Record<string, VariableState>;
  heapRefIds: number[];
  changedHeapObjectIds: number[];
  changedArrayIndices: Record<string, number[]>;
  arrayOperations: ArrayOperationEvent[];
  stdout: string[];
  error?: RuntimeError;
  changedVariables: string[];
  pointerGraph: PointerGraph;
  detectedStructures: DSAStructureTag[];
  operationCounters: OperationCounters;
  memoryUsageEstimateBytes: number;
}

export interface SnapshotDiff {
  lineNumber?: number;
  functionName?: string;
  variables?: Record<string, VariableState>;
  removedVariables?: string[];
  stackFrames?: StackFrame[];
  internalStackFrames?: StackFrame[];
  internalVariables?: Record<string, VariableState>;
  removedInternalVariables?: string[];
  heapRefIds?: number[];
  changedHeapObjectIds?: number[];
  changedArrayIndices?: Record<string, number[]>;
  arrayOperations?: ArrayOperationEvent[];
  stdout?: string[];
  error?: RuntimeError;
  changedVariables?: string[];
  pointerGraph?: PointerGraph;
  detectedStructures?: DSAStructureTag[];
  operationCounters?: OperationCounters;
  memoryUsageEstimateBytes?: number;
}

export interface CompressedTrace {
  totalSteps: number;
  checkpointInterval: number;
  heapObjectsById: Record<number, HeapObject>;
  checkpoints: Record<number, ExecutionSnapshot>;
  diffs: Record<number, SnapshotDiff>;
}

export interface TraceMetadata {
  language: SupportedLanguage;
  executionTimeMs: number;
  workerExecutionTimeMs: number;
  userCodeTimeMs: number;
  tracingOverheadMs: number;
  uiRenderTimeMs?: number;
  averageFrameRenderMs?: number;
  stepCount: number;
  snapshotBytes: number;
  wasTruncated: boolean;
  stopReason: ExecutionStopReason;
  peakStackDepth: number;
  totalObjectsCreated: number;
  maxHeapSize: number;
  timeComplexityTrend: "linear" | "quadratic" | "logarithmic" | "unknown";
}
