/// <reference lib="webworker" />

import type { ExecutionSafetyLimits, RuntimeError } from "@/src/types/execution";
import type { RawExecutionResult } from "@/src/types/raw-trace";
import type { WorkerRequest, WorkerResponse } from "@/src/workers/contracts";

declare const self: DedicatedWorkerGlobalScope;

type PyodideLike = {
  runPythonAsync: (code: string) => Promise<unknown>;
};

let pyodideInstance: PyodideLike | null = null;
let initPromise: Promise<PyodideLike> | null = null;
let loading = false;
let pyodideLoader: ((config: { indexURL: string }) => Promise<PyodideLike>) | null = null;

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;

  try {
    if (request.type === "INIT") {
      const beforeReady = Boolean(pyodideInstance);
      await initializePyodide(Boolean(request.retry));
      postResponse({
        id: request.id,
        ok: true,
        ready: true,
        loading,
        loaderRecovered: request.retry && !beforeReady,
      });
      return;
    }

    if (request.type === "RESET") {
      await initializePyodide(false);
      await pyodideInstance?.runPythonAsync("import gc\ngc.collect()\n");
      postResponse({ id: request.id, ok: true, ready: true, loading: false });
      return;
    }

    await initializePyodide(false);

    const runResult = await runPythonWithTracing(
      request.payload.code,
      request.payload.safetyLimits,
      request.payload.deterministicMode,
    );

    postResponse({
      id: request.id,
      ok: true,
      ready: true,
      loading: false,
      result: runResult,
      loaderRecovered: false,
    });
  } catch (error) {
    const runtimeError = toWorkerError(error);
    postResponse({
      id: request.id,
      ok: false,
      ready: Boolean(pyodideInstance),
      loading,
      error: runtimeError,
    });
  }
};

function postResponse(response: WorkerResponse) {
  self.postMessage(response);
}

async function initializePyodide(retry: boolean): Promise<PyodideLike> {
  if (pyodideInstance && !retry) {
    return pyodideInstance;
  }

  if (initPromise && !retry) {
    return initPromise;
  }

  initPromise = (async () => {
    loading = true;
    try {
      const loadPyodide = await resolvePyodideLoader();
      pyodideInstance = await loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/",
      });
      return pyodideInstance;
    } catch (error) {
      pyodideInstance = null;
      throw error;
    } finally {
      loading = false;
      initPromise = null;
    }
  })();

  return initPromise;
}

async function resolvePyodideLoader() {
  if (pyodideLoader) {
    return pyodideLoader;
  }

  const moduleUrl = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.mjs";
  const pyodideModule = (await import(/* webpackIgnore: true */ moduleUrl)) as {
    loadPyodide: (config: { indexURL: string }) => Promise<PyodideLike>;
  };

  pyodideLoader = pyodideModule.loadPyodide;
  return pyodideLoader;
}

async function runPythonWithTracing(
  code: string,
  limits: ExecutionSafetyLimits,
  deterministicMode?: boolean,
): Promise<RawExecutionResult> {
  if (!pyodideInstance) {
    throw new Error("Pyodide instance is not initialized");
  }

  const script = buildInstrumentedScript(code, limits, deterministicMode);
  const output = await pyodideInstance.runPythonAsync(script);

  if (typeof output !== "string") {
    throw new Error("Invalid trace payload from Python runtime");
  }

  return JSON.parse(output) as RawExecutionResult;
}

function buildInstrumentedScript(
  code: string,
  limits: ExecutionSafetyLimits,
  deterministicMode?: boolean,
): string {
  const escapedCode = JSON.stringify(code);

  return `
import sys
import gc
import json
import time
import traceback
import types
import random

user_code = ${escapedCode}
MAX_STEPS = ${limits.maxSteps}
MAX_TIME = ${limits.maxExecutionTimeMs}
MAX_RECURSION_DEPTH = ${limits.maxRecursionDepth}
MAX_STDOUT_SIZE = ${limits.maxStdoutSize}
REPEAT_LIMIT = ${limits.infiniteLoopRepeatThreshold}
DETERMINISTIC_MODE = ${deterministicMode ? "True" : "False"}
USER_FILENAME = "<codesight-user>"
INTERNAL_MODULE_PREFIXES = (
  "builtins",
  "importlib",
  "types",
  "_frozen_importlib",
  "pyodide",
)
INTERNAL_NAMES = {
  "sys", "gc", "json", "time", "traceback", "types", "random"
}

state = {
  "steps": 0,
  "trace": [],
  "stdout": [],
  "start": time.perf_counter(),
  "line_signatures": {},
  "truncated": False,
  "stop_reason": "completed",
  "peak_stack_depth": 0,
  "created_object_ids": set(),
  "max_heap_size": 0,
  "last_array_state": {},
}

class InfiniteLoopError(Exception):
  pass

class StdoutLimitError(Exception):
  pass

class StepLimitError(Exception):
  pass

class CaptureStdout:
  def write(self, text):
    if not text:
      return
    state["stdout"].append(str(text))
    joined = "".join(state["stdout"])
    if len(joined) > MAX_STDOUT_SIZE:
      state["stop_reason"] = "stdout-limit-hit"
      raise StdoutLimitError("Stdout size limit exceeded")

  def flush(self):
    return

def is_primitive(value):
  return isinstance(value, (int, float, bool, str, bytes, type(None)))

def is_internal_name(name):
  return name.startswith("__") or name in INTERNAL_NAMES

def is_internal_value(value):
  try:
    module_name = type(value).__module__
  except Exception:
    return False

  if not module_name:
    return False

  return any(module_name.startswith(prefix) for prefix in INTERNAL_MODULE_PREFIXES)

def safe_repr(value, max_len=120):
  try:
    return repr(value)[:max_len]
  except Exception:
    return f"<{type(value).__name__}>"

def safe_object_id(value):
  try:
    return id(value)
  except Exception:
    return None

def classify_heap_object(value):
  if is_primitive(value):
    return "primitive"
  if isinstance(value, types.ModuleType):
    return "module"
  if callable(value):
    return "function"
  if is_internal_value(value):
    return "internal"
  return "userObject"

def collect_field_refs(value):
  refs = {}

  try:
    if hasattr(value, "__dict__") and isinstance(value.__dict__, dict):
      for key, field_value in list(value.__dict__.items())[:16]:
        refs[str(key)] = safe_object_id(field_value)
  except Exception:
    pass

  if isinstance(value, dict):
    for key, field_value in list(value.items())[:16]:
      refs[f"key:{safe_repr(key, 24)}"] = safe_object_id(field_value)

  for key in ("next", "left", "right", "prev", "head", "tail"):
    if hasattr(value, key):
      try:
        refs[key] = safe_object_id(getattr(value, key))
      except Exception:
        refs[key] = None

  return refs if refs else None

def value_to_variable(name, value, scope="local"):
  object_id = None if is_primitive(value) else safe_object_id(value)
  type_name = type(value).__name__
  preview = safe_repr(value, 120)

  return {
    "name": name,
    "type": type_name,
    "scope": scope,
    "valuePreview": preview[:120],
    "objectId": object_id,
    "isInternal": is_internal_name(name) or is_internal_value(value),
  }

def collect_stack(frame):
  frames = []
  depth = 0
  current = frame

  while current is not None:
    depth += 1
    if depth > MAX_RECURSION_DEPTH:
      state["stop_reason"] = "runtime-error"
      raise RecursionError("Maximum recursion depth reached by safety limit")

    filename = current.f_code.co_filename
    is_user_frame = filename == USER_FILENAME

    locals_serialized = []
    for name, value in current.f_locals.items():
      if name.startswith("__codesight"):
        continue
      variable = value_to_variable(name, value, "local")
      if not is_user_frame:
        variable["isInternal"] = True
      locals_serialized.append(variable)

    frames.append({
      "frameId": f"{current.f_code.co_name}:{id(current)}",
      "functionName": current.f_code.co_name,
      "filename": filename,
      "isUserFrame": is_user_frame,
      "lineNumber": current.f_lineno,
      "locals": locals_serialized,
    })
    current = current.f_back

  state["peak_stack_depth"] = max(state["peak_stack_depth"], depth)

  return frames

def collect_heap():
  heap = []
  for obj in gc.get_objects()[:500]:
    try:
      object_id = id(obj)
      state["created_object_ids"].add(object_id)

      refs = []
      for ref in gc.get_referents(obj)[:8]:
        try:
          refs.append(id(ref))
        except Exception:
          pass

      field_refs = collect_field_refs(obj)
      module_name = None
      try:
        module_name = type(obj).__module__
      except Exception:
        module_name = None

      entry = {
        "objectId": object_id,
        "type": type(obj).__name__,
        "repr": safe_repr(obj, 120),
        "moduleName": module_name,
        "classification": classify_heap_object(obj),
        "references": refs,
      }

      if field_refs:
        entry["fieldRefs"] = field_refs

      if isinstance(obj, list):
        try:
          entry["isListOfPrimitives"] = all(is_primitive(item) for item in obj[:32])
        except Exception:
          entry["isListOfPrimitives"] = False

      if isinstance(obj, dict):
        try:
          entry["isDictOfPrimitives"] = all(
            is_primitive(k) and is_primitive(v)
            for k, v in list(obj.items())[:32]
          )
        except Exception:
          entry["isDictOfPrimitives"] = False

      heap.append(entry)
    except Exception:
      continue

  state["max_heap_size"] = max(state["max_heap_size"], len(heap))
  return heap

def infer_globals(frame):
  user_variables = []
  internal_variables = []

  for name, value in frame.f_globals.items():
    if name.startswith("__"):
      continue
    if name in frame.f_locals:
      continue

    variable = value_to_variable(name, value, "global")
    if variable["isInternal"]:
      internal_variables.append(variable)
    else:
      user_variables.append(variable)

  return user_variables, internal_variables

def parse_primitive_list(preview):
  text = str(preview).strip()
  if not text.startswith("[") or not text.endswith("]"):
    return None

  body = text[1:-1].strip()
  if not body:
    return []

  if "[" in body or "{" in body or "(" in body:
    return None

  return [item.strip() for item in body.split(",")]

def infer_array_operations(user_variables):
  operations = []
  current_arrays = {}

  for variable in user_variables:
    if variable.get("type") != "list":
      continue

    parsed = parse_primitive_list(variable.get("valuePreview", ""))
    if parsed is None:
      continue

    name = variable["name"]
    current_arrays[name] = parsed
    previous = state["last_array_state"].get(name)
    if previous is None:
      continue

    max_len = max(len(previous), len(parsed))
    changed_indices = []
    for index in range(max_len):
      prev_value = previous[index] if index < len(previous) else None
      next_value = parsed[index] if index < len(parsed) else None
      if prev_value != next_value:
        changed_indices.append(index)

    if len(changed_indices) == 2:
      operations.append({
        "type": "compare",
        "variableName": name,
        "i": changed_indices[0],
        "j": changed_indices[1],
      })
      operations.append({
        "type": "swap",
        "variableName": name,
        "i": changed_indices[0],
        "j": changed_indices[1],
      })
    else:
      for index in changed_indices:
        value = parsed[index] if index < len(parsed) else ""
        operations.append({
          "type": "overwrite",
          "variableName": name,
          "i": index,
          "value": value,
        })

  state["last_array_state"] = current_arrays
  return operations

def signature_from_variables(line_number, variables):
  segments = []
  for variable in variables[:32]:
    segments.append(f"{variable['name']}={variable['valuePreview']}")
  return f"{line_number}|" + "|".join(sorted(segments))

def map_error_category(error_type):
  mapping = {
    "IndexError": "array-bounds",
    "KeyError": "memory",
    "MemoryError": "memory",
    "RecursionError": "stack-overflow",
    "TimeoutError": "timeout",
    "InfiniteLoopError": "infinite-loop",
    "StepLimitError": "infinite-loop",
    "StdoutLimitError": "memory",
    "SyntaxError": "syntax",
  }
  return mapping.get(error_type, "unknown")

def trace_fn(frame, event, arg):
  if frame.f_code.co_filename != USER_FILENAME:
    return trace_fn

  if event not in ("line", "call", "return"):
    return trace_fn

  elapsed_ms = (time.perf_counter() - state["start"]) * 1000
  if elapsed_ms > MAX_TIME:
    state["stop_reason"] = "time-limit-hit"
    raise TimeoutError("Execution time limit reached")

  state["steps"] += 1
  if state["steps"] > MAX_STEPS:
    state["truncated"] = True
    state["stop_reason"] = "step-limit-hit"
    raise StepLimitError("Maximum step limit reached")

  stack_frames = collect_stack(frame)
  global_user_variables, global_internal_variables = infer_globals(frame)

  top_locals = stack_frames[0]["locals"] if stack_frames else []
  local_user_variables = [v for v in top_locals if not v.get("isInternal")]
  local_internal_variables = [v for v in top_locals if v.get("isInternal")]

  combined_user_variables = []
  combined_user_variables.extend(global_user_variables)
  combined_user_variables.extend(local_user_variables)

  combined_internal_variables = []
  combined_internal_variables.extend(global_internal_variables)
  combined_internal_variables.extend(local_internal_variables)

  signature = signature_from_variables(frame.f_lineno, combined_user_variables)
  state["line_signatures"][signature] = state["line_signatures"].get(signature, 0) + 1
  if state["line_signatures"][signature] > REPEAT_LIMIT:
    state["stop_reason"] = "infinite-loop-detected"
    raise InfiniteLoopError("Potential infinite loop detected by repeated state heuristic")

  array_operations = infer_array_operations(combined_user_variables)

  snapshot = {
    "step": state["steps"] - 1,
    "lineNumber": frame.f_lineno,
    "functionName": frame.f_code.co_name,
    "event": event,
    "variables": combined_user_variables,
    "internalVariables": combined_internal_variables,
    "stackFrames": stack_frames,
    "heap": collect_heap(),
    "arrayOperations": array_operations,
    "stdout": list(state["stdout"]),
    "error": None,
  }

  state["trace"].append(snapshot)
  return trace_fn

runtime_error = None
captured_stdout = CaptureStdout()
original_stdout = sys.stdout

if DETERMINISTIC_MODE:
  random.seed(0)

try:
  compiled = compile(user_code, USER_FILENAME, "exec")
  sys.stdout = captured_stdout
  sys.settrace(trace_fn)
  exec(compiled, {})
except Exception as exc:
  tb = traceback.extract_tb(exc.__traceback__)
  line = tb[-1].lineno if tb else -1

  if state["stop_reason"] == "completed":
    if isinstance(exc, TimeoutError):
      state["stop_reason"] = "time-limit-hit"
    elif isinstance(exc, StepLimitError):
      state["stop_reason"] = "step-limit-hit"
    elif isinstance(exc, InfiniteLoopError):
      state["stop_reason"] = "infinite-loop-detected"
    elif isinstance(exc, StdoutLimitError):
      state["stop_reason"] = "stdout-limit-hit"
    else:
      state["stop_reason"] = "runtime-error"

  runtime_error = {
    "type": type(exc).__name__,
    "category": map_error_category(type(exc).__name__),
    "message": str(exc),
    "line": line,
    "relatedMemoryRef": None,
  }
finally:
  sys.settrace(None)
  sys.stdout = original_stdout

execution_time_ms = int((time.perf_counter() - state["start"]) * 1000)
line_signature_events = sum(state["line_signatures"].values())
overhead_ratio = 0.08 if line_signature_events > 0 else 0.0
tracing_overhead_ms = int(execution_time_ms * overhead_ratio)
user_code_time_ms = max(0, execution_time_ms - tracing_overhead_ms)

result = {
  "rawTrace": state["trace"],
  "stdout": state["stdout"],
  "error": runtime_error,
  "executionTimeMs": execution_time_ms,
  "workerExecutionTimeMs": execution_time_ms,
  "userCodeTimeMs": user_code_time_ms,
  "tracingOverheadMs": tracing_overhead_ms,
  "stopReason": state["stop_reason"],
  "peakStackDepth": state["peak_stack_depth"],
  "totalObjectsCreated": len(state["created_object_ids"]),
  "maxHeapSize": state["max_heap_size"],
  "wasTruncated": state["truncated"],
}

json.dumps(result)
`;
}

function toWorkerError(error: unknown): RuntimeError {
  if (typeof error === "object" && error && "message" in error) {
    return {
      type: "WorkerError",
      category: "unknown",
      message: String((error as { message?: unknown }).message ?? "Worker failure"),
      line: -1,
    };
  }

  return {
    type: "WorkerError",
    category: "unknown",
    message: "Unknown worker failure",
    line: -1,
  };
}
