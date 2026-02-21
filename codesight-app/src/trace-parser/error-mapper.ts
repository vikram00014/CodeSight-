import {
  RuntimeError,
  RuntimeErrorCategory,
} from "@/src/types/execution";

const CATEGORY_MAP: Record<string, RuntimeErrorCategory> = {
  IndexError: "array-bounds",
  KeyError: "memory",
  MemoryError: "memory",
  RecursionError: "stack-overflow",
  TimeoutError: "timeout",
  InfiniteLoopError: "infinite-loop",
  SyntaxError: "syntax",
};

export function mapRuntimeErrorCategory(type: string): RuntimeErrorCategory {
  return CATEGORY_MAP[type] ?? "unknown";
}

export function normalizeRuntimeError(error?: Partial<RuntimeError>): RuntimeError | undefined {
  if (!error) {
    return undefined;
  }

  const type = error.type ?? "RuntimeError";
  return {
    type,
    category: error.category ?? mapRuntimeErrorCategory(type),
    message: error.message ?? "Unknown runtime failure",
    line: error.line ?? -1,
    relatedMemoryRef: error.relatedMemoryRef,
  };
}
