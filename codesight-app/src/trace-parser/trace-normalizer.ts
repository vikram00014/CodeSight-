import {
  ArrayOperationEvent,
  CompressedTrace,
  DSAStructureTag,
  ExecutionSnapshot,
  HeapObject,
  OperationCounters,
  SnapshotDiff,
  VariableState,
} from "@/src/types/execution";
import { RawExecutionResult } from "@/src/types/raw-trace";
import { normalizeRuntimeError } from "@/src/trace-parser/error-mapper";
import { deepClone } from "@/src/utils/immutability";

interface NormalizeTraceOptions {
  checkpointInterval: number;
}

export interface NormalizedTraceResult {
  snapshots: ExecutionSnapshot[];
  heapObjectsById: Record<number, HeapObject>;
}

export function normalizeTrace(rawResult: RawExecutionResult): NormalizedTraceResult {
  const heapObjectsById = collectHeapMap(rawResult);

  let previousVariables: Record<string, VariableState> = {};
  let previousInternalVariables: Record<string, VariableState> = {};
  let previousHeapRefIds: number[] = [];
  let previousArrayState: Record<string, string[]> = {};
  let runningCounters: OperationCounters = {
    comparisons: 0,
    assignments: 0,
    swaps: 0,
  };

  const snapshots = rawResult.rawTrace.map((snapshot) => {
    const userVariables = snapshot.variables.filter((variable) => !variable.isInternal);
    const internalVariables = snapshot.internalVariables ?? snapshot.variables.filter((variable) => variable.isInternal);

    const variablesRecord = toVariableRecord(userVariables);
    const internalVariablesRecord = toVariableRecord(internalVariables);

    const changedVariables = getChangedVariables(previousVariables, variablesRecord);
    previousVariables = variablesRecord;

    const userStackFrames = snapshot.stackFrames.filter((frame) => frame.isUserFrame);
    const internalStackFrames = snapshot.stackFrames.filter((frame) => !frame.isUserFrame);

    const heapRefIds = snapshot.heap.map((obj) => obj.objectId);
    const changedHeapObjectIds = getChangedHeapObjectIds(previousHeapRefIds, heapRefIds);
    previousHeapRefIds = heapRefIds;

    const arrayState = extractPrimitiveArrayState(variablesRecord);
    const changedArrayIndices = detectChangedArrayIndices(previousArrayState, arrayState);
    previousArrayState = arrayState;

    const arrayOperations =
      snapshot.arrayOperations && snapshot.arrayOperations.length > 0
        ? snapshot.arrayOperations
        : inferArrayOperationsFromChanges(changedArrayIndices);

    const stepCounters = inferStepCounters(snapshot.lineNumber, changedVariables, arrayOperations);
    runningCounters = {
      comparisons: runningCounters.comparisons + stepCounters.comparisons,
      assignments: runningCounters.assignments + stepCounters.assignments,
      swaps: runningCounters.swaps + stepCounters.swaps,
    };

    const normalizedError = normalizeRuntimeError(snapshot.error ?? rawResult.error);

    const normalizedSnapshot: ExecutionSnapshot = {
      step: snapshot.step,
      lineNumber: snapshot.lineNumber,
      functionName:
        snapshot.functionName ||
        userStackFrames[0]?.functionName ||
        internalStackFrames[0]?.functionName ||
        "<module>",
      variables: variablesRecord,
      stackFrames: userStackFrames.map((frame) => ({
        ...frame,
        locals: deepClone(frame.locals),
      })),
      internalStackFrames: internalStackFrames.map((frame) => ({
        ...frame,
        locals: deepClone(frame.locals),
      })),
      internalVariables: internalVariablesRecord,
      heapRefIds,
      changedHeapObjectIds,
      changedArrayIndices,
      arrayOperations,
      stdout: deepClone(snapshot.stdout),
      error: normalizedError,
      changedVariables,
      pointerGraph: buildPointerGraph(variablesRecord, heapRefIds, heapObjectsById),
      detectedStructures: detectStructures(variablesRecord, heapRefIds, heapObjectsById),
      operationCounters: runningCounters,
      memoryUsageEstimateBytes: estimateMemory(variablesRecord, heapRefIds, heapObjectsById),
    };

    previousInternalVariables = internalVariablesRecord;
    void previousInternalVariables;

    return normalizedSnapshot;
  });

  return {
    snapshots,
    heapObjectsById,
  };
}

export function compressSnapshots(
  snapshots: ExecutionSnapshot[],
  heapObjectsById: Record<number, HeapObject>,
  options: NormalizeTraceOptions,
): CompressedTrace {
  const checkpoints: Record<number, ExecutionSnapshot> = {};
  const diffs: Record<number, SnapshotDiff> = {};

  snapshots.forEach((snapshot, index) => {
    if (index % options.checkpointInterval === 0) {
      checkpoints[index] = deepClone(snapshot);
      return;
    }

    const previous = snapshots[index - 1];
    diffs[index] = createDiff(previous, snapshot);
  });

  return {
    totalSteps: snapshots.length,
    checkpointInterval: options.checkpointInterval,
    heapObjectsById,
    checkpoints,
    diffs,
  };
}

export function hydrateSnapshot(
  compressed: CompressedTrace,
  targetStep: number,
): ExecutionSnapshot | undefined {
  if (targetStep < 0 || targetStep >= compressed.totalSteps) {
    return undefined;
  }

  const checkpointStep =
    Math.floor(targetStep / compressed.checkpointInterval) * compressed.checkpointInterval;
  const checkpoint = compressed.checkpoints[checkpointStep];

  if (!checkpoint) {
    return undefined;
  }

  let hydrated = deepClone(checkpoint);
  for (let step = checkpointStep + 1; step <= targetStep; step += 1) {
    const diff = compressed.diffs[step];
    if (!diff) {
      continue;
    }

    hydrated = applyDiff(hydrated, diff, step);
  }

  return hydrated;
}

function applyDiff(base: ExecutionSnapshot, diff: SnapshotDiff, step: number): ExecutionSnapshot {
  const nextVariables = { ...base.variables, ...(diff.variables ?? {}) };
  for (const removed of diff.removedVariables ?? []) {
    delete nextVariables[removed];
  }

  const nextInternalVariables = {
    ...base.internalVariables,
    ...(diff.internalVariables ?? {}),
  };
  for (const removed of diff.removedInternalVariables ?? []) {
    delete nextInternalVariables[removed];
  }

  return {
    ...base,
    step,
    lineNumber: diff.lineNumber ?? base.lineNumber,
    functionName: diff.functionName ?? base.functionName,
    variables: nextVariables,
    stackFrames: diff.stackFrames ? deepClone(diff.stackFrames) : base.stackFrames,
    internalStackFrames: diff.internalStackFrames
      ? deepClone(diff.internalStackFrames)
      : base.internalStackFrames,
    internalVariables: nextInternalVariables,
    heapRefIds: diff.heapRefIds ? deepClone(diff.heapRefIds) : base.heapRefIds,
    changedHeapObjectIds: diff.changedHeapObjectIds
      ? deepClone(diff.changedHeapObjectIds)
      : base.changedHeapObjectIds,
    changedArrayIndices: diff.changedArrayIndices
      ? deepClone(diff.changedArrayIndices)
      : base.changedArrayIndices,
    arrayOperations: diff.arrayOperations ? deepClone(diff.arrayOperations) : base.arrayOperations,
    stdout: diff.stdout ? deepClone(diff.stdout) : base.stdout,
    error: diff.error ?? base.error,
    changedVariables: diff.changedVariables ?? base.changedVariables,
    pointerGraph: diff.pointerGraph ?? base.pointerGraph,
    detectedStructures: diff.detectedStructures ?? base.detectedStructures,
    operationCounters: diff.operationCounters ?? base.operationCounters,
    memoryUsageEstimateBytes:
      diff.memoryUsageEstimateBytes ?? base.memoryUsageEstimateBytes,
  };
}

function createDiff(previous: ExecutionSnapshot, current: ExecutionSnapshot): SnapshotDiff {
  const updatedVariables: Record<string, VariableState> = {};
  const removedVariables: string[] = [];

  for (const [name, variable] of Object.entries(current.variables)) {
    const previousVar = previous.variables[name];
    if (
      !previousVar ||
      previousVar.valuePreview !== variable.valuePreview ||
      previousVar.objectId !== variable.objectId
    ) {
      updatedVariables[name] = variable;
    }
  }

  for (const prevName of Object.keys(previous.variables)) {
    if (!current.variables[prevName]) {
      removedVariables.push(prevName);
    }
  }

  const updatedInternalVariables: Record<string, VariableState> = {};
  const removedInternalVariables: string[] = [];

  for (const [name, variable] of Object.entries(current.internalVariables)) {
    const previousVar = previous.internalVariables[name];
    if (
      !previousVar ||
      previousVar.valuePreview !== variable.valuePreview ||
      previousVar.objectId !== variable.objectId
    ) {
      updatedInternalVariables[name] = variable;
    }
  }

  for (const prevName of Object.keys(previous.internalVariables)) {
    if (!current.internalVariables[prevName]) {
      removedInternalVariables.push(prevName);
    }
  }

  return {
    lineNumber: current.lineNumber,
    functionName: current.functionName,
    variables: Object.keys(updatedVariables).length > 0 ? updatedVariables : undefined,
    removedVariables: removedVariables.length > 0 ? removedVariables : undefined,
    stackFrames: current.stackFrames,
    internalStackFrames: current.internalStackFrames,
    internalVariables:
      Object.keys(updatedInternalVariables).length > 0
        ? updatedInternalVariables
        : undefined,
    removedInternalVariables:
      removedInternalVariables.length > 0 ? removedInternalVariables : undefined,
    heapRefIds: current.heapRefIds,
    changedHeapObjectIds: current.changedHeapObjectIds,
    changedArrayIndices: current.changedArrayIndices,
    arrayOperations: current.arrayOperations,
    stdout: current.stdout,
    error: current.error,
    changedVariables: current.changedVariables,
    pointerGraph: current.pointerGraph,
    detectedStructures: current.detectedStructures,
    operationCounters: current.operationCounters,
    memoryUsageEstimateBytes: current.memoryUsageEstimateBytes,
  };
}

function toVariableRecord(variables: VariableState[]): Record<string, VariableState> {
  return variables.reduce<Record<string, VariableState>>((acc, variable) => {
    acc[variable.name] = variable;
    return acc;
  }, {});
}

function collectHeapMap(rawResult: RawExecutionResult): Record<number, HeapObject> {
  const heapMap: Record<number, HeapObject> = {};

  for (const snapshot of rawResult.rawTrace) {
    for (const object of snapshot.heap) {
      heapMap[object.objectId] = {
        ...object,
        references: [...object.references],
      };
    }
  }

  return heapMap;
}

function getChangedVariables(
  previous: Record<string, VariableState>,
  current: Record<string, VariableState>,
): string[] {
  const changed = new Set<string>();

  for (const [name, variable] of Object.entries(current)) {
    const prev = previous[name];
    if (!prev || prev.valuePreview !== variable.valuePreview || prev.objectId !== variable.objectId) {
      changed.add(name);
    }
  }

  for (const name of Object.keys(previous)) {
    if (!current[name]) {
      changed.add(name);
    }
  }

  return Array.from(changed);
}

function getChangedHeapObjectIds(previous: number[], current: number[]): number[] {
  const prevSet = new Set(previous);
  const currSet = new Set(current);
  const changed = new Set<number>();

  for (const objectId of current) {
    if (!prevSet.has(objectId)) {
      changed.add(objectId);
    }
  }

  for (const objectId of previous) {
    if (!currSet.has(objectId)) {
      changed.add(objectId);
    }
  }

  return Array.from(changed);
}

function extractPrimitiveArrayState(
  variables: Record<string, VariableState>,
): Record<string, string[]> {
  const arrays: Record<string, string[]> = {};

  for (const variable of Object.values(variables)) {
    if (variable.type !== "list") {
      continue;
    }

    const parsed = parsePrimitiveList(variable.valuePreview);
    if (!parsed) {
      continue;
    }

    arrays[variable.name] = parsed;
  }

  return arrays;
}

function detectChangedArrayIndices(
  previous: Record<string, string[]>,
  current: Record<string, string[]>,
): Record<string, number[]> {
  const changed: Record<string, number[]> = {};

  for (const [name, currentValues] of Object.entries(current)) {
    const previousValues = previous[name];
    if (!previousValues) {
      continue;
    }

    const max = Math.max(previousValues.length, currentValues.length);
    const changedIndices: number[] = [];
    for (let i = 0; i < max; i += 1) {
      if (previousValues[i] !== currentValues[i]) {
        changedIndices.push(i);
      }
    }

    if (changedIndices.length > 0) {
      changed[name] = changedIndices;
    }
  }

  return changed;
}

function inferArrayOperationsFromChanges(
  changedArrayIndices: Record<string, number[]>,
): ArrayOperationEvent[] {
  const events: ArrayOperationEvent[] = [];

  for (const [variableName, indices] of Object.entries(changedArrayIndices)) {
    if (indices.length === 2) {
      events.push({
        type: "swap",
        variableName,
        i: indices[0],
        j: indices[1],
      });
      continue;
    }

    for (const index of indices) {
      events.push({
        type: "overwrite",
        variableName,
        i: index,
      });
    }
  }

  return events;
}

function inferStepCounters(
  lineNumber: number,
  changedVariables: string[],
  arrayOperations: ArrayOperationEvent[],
): OperationCounters {
  let comparisons = 0;
  let assignments = changedVariables.length;
  let swaps = 0;

  for (const event of arrayOperations) {
    if (event.type === "compare") {
      comparisons += 1;
    }
    if (event.type === "overwrite") {
      assignments += 1;
    }
    if (event.type === "swap") {
      swaps += 1;
      assignments += 2;
    }
  }

  if (arrayOperations.length === 0 && lineNumber > 0) {
    comparisons += 1;
  }

  return {
    comparisons,
    assignments,
    swaps,
  };
}

function buildPointerGraph(
  variables: Record<string, VariableState>,
  heapRefIds: number[],
  heapObjectsById: Record<number, HeapObject>,
) {
  const nodes = new Set<string>();
  const edges: { from: string; to: string; label?: string }[] = [];

  for (const variable of Object.values(variables)) {
    nodes.add(`var:${variable.name}`);
    if (variable.objectId !== undefined) {
      nodes.add(`heap:${variable.objectId}`);
      edges.push({
        from: `var:${variable.name}`,
        to: `heap:${variable.objectId}`,
      });
    }
  }

  for (const objectId of heapRefIds) {
    const object = heapObjectsById[objectId];
    if (!object) {
      continue;
    }

    nodes.add(`heap:${object.objectId}`);
    for (const reference of object.references) {
      nodes.add(`heap:${reference}`);
      edges.push({
        from: `heap:${object.objectId}`,
        to: `heap:${reference}`,
      });
    }
  }

  return {
    nodes: Array.from(nodes),
    edges,
  };
}

function detectStructures(
  variables: Record<string, VariableState>,
  heapRefIds: number[],
  heapObjectsById: Record<number, HeapObject>,
): DSAStructureTag[] {
  const tags: DSAStructureTag[] = [];

  for (const variable of Object.values(variables)) {
    if (variable.type === "list") {
      const parsed = parsePrimitiveList(variable.valuePreview);
      if (parsed) {
        tags.push({ structureType: "array", variableName: variable.name, confidence: 0.95 });
      }
    }
  }

  for (const objectId of heapRefIds) {
    const object = heapObjectsById[objectId];
    if (!object?.fieldRefs) {
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(object.fieldRefs, "next")) {
      tags.push({ structureType: "linked-list", variableName: String(objectId), confidence: 0.85 });
    }

    if (
      Object.prototype.hasOwnProperty.call(object.fieldRefs, "left") &&
      Object.prototype.hasOwnProperty.call(object.fieldRefs, "right")
    ) {
      tags.push({ structureType: "tree", variableName: String(objectId), confidence: 0.9 });
    }
  }

  return dedupeTags(tags);
}

function dedupeTags(tags: DSAStructureTag[]): DSAStructureTag[] {
  const seen = new Set<string>();
  const result: DSAStructureTag[] = [];

  for (const tag of tags) {
    const key = `${tag.structureType}:${tag.variableName}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(tag);
  }

  return result;
}

function estimateMemory(
  variables: Record<string, VariableState>,
  heapRefIds: number[],
  heapObjectsById: Record<number, HeapObject>,
): number {
  const variableBytes = Object.values(variables).reduce(
    (acc, variable) => acc + variable.valuePreview.length * 2,
    0,
  );
  const heapBytes = heapRefIds.reduce((acc, objectId) => {
    const object = heapObjectsById[objectId];
    if (!object) {
      return acc;
    }

    return acc + object.repr.length * 2 + object.references.length * 8;
  }, 0);

  return variableBytes + heapBytes;
}

function parsePrimitiveList(valuePreview: string): string[] | undefined {
  const trimmed = valuePreview.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    return undefined;
  }

  const body = trimmed.slice(1, -1).trim();
  if (!body) {
    return [];
  }

  if (body.includes("[") || body.includes("{") || body.includes("(")) {
    return undefined;
  }

  return body.split(",").map((item) => item.trim());
}
