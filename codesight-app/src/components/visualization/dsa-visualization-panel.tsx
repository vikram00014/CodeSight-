"use client";

import { useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  Edge,
  MiniMap,
  Node,
  Panel,
} from "reactflow";

import { useCodeSightStore } from "@/src/store/codesight-store";
import { useStructureSelection } from "@/src/store/selectors";
import { StructureType } from "@/src/types/execution";

const structureOptions: StructureType[] = [
  "unknown",
  "array",
  "linked-list",
  "stack",
  "queue",
  "tree",
  "graph",
];

function parseArrayValues(valuePreview: string): string[] {
  const trimmed = valuePreview.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    return [];
  }

  const raw = trimmed.slice(1, -1);
  if (!raw) {
    return [];
  }

  return raw.split(",").map((item) => item.trim()).slice(0, 200);
}

function toNumeric(values: string[]) {
  const numeric = values.map((value) => Number(value));
  return numeric.every((value) => Number.isFinite(value)) ? numeric : undefined;
}

export function DSAVisualizationPanel() {
  const snapshot = useCodeSightStore((state) => state.currentSnapshot);
  const selectedStructureOverride = useCodeSightStore(
    (state) => state.selectedStructureOverride,
  );
  const setStructureOverride = useCodeSightStore((state) => state.setStructureOverride);

  const selectedStructure = useStructureSelection();

  const nodesAndEdges = useMemo(() => {
    const graph = snapshot?.pointerGraph;
    if (!graph) {
      return { nodes: [] as Node[], edges: [] as Edge[] };
    }

    const limitedNodes = graph.nodes.slice(0, 120);
    const nodes: Node[] = limitedNodes.map((id, index) => ({
      id,
      data: { label: id.replace("var:", "").replace("heap:", "#") },
      position: {
        x: (index % 8) * 150,
        y: Math.floor(index / 8) * 70,
      },
      draggable: false,
    }));

    const nodeSet = new Set(nodes.map((node) => node.id));
    const edges: Edge[] = graph.edges
      .slice(0, 240)
      .filter((edge) => nodeSet.has(edge.from) && nodeSet.has(edge.to))
      .map((edge, index) => ({
        id: `${edge.from}-${edge.to}-${index}`,
        source: edge.from,
        target: edge.to,
        label: edge.label,
        animated: false,
      }));

    return { nodes, edges };
  }, [snapshot?.pointerGraph]);

  const arrayEntries = useMemo(() => {
    const variables = Object.values(snapshot?.variables ?? {});
    const preferredArrayName = snapshot?.detectedStructures.find(
      (tag) => tag.structureType === "array",
    )?.variableName;

    if (preferredArrayName) {
      const preferred = variables.find((variable) => variable.name === preferredArrayName);
      if (preferred) {
        const values = parseArrayValues(preferred.valuePreview);
        if (values.length > 0) {
          return { name: preferred.name, values };
        }
      }
    }

    for (const variable of variables) {
      const values = parseArrayValues(variable.valuePreview);
      if (values.length > 0) {
        return { name: variable.name, values };
      }
    }

    return undefined;
  }, [snapshot?.detectedStructures, snapshot?.variables]);

  const arrayOperations = useMemo(
    () =>
      (snapshot?.arrayOperations ?? []).filter(
        (operation) => operation.variableName === arrayEntries?.name,
      ),
    [snapshot?.arrayOperations, arrayEntries?.name],
  );

  const activeIndices = useMemo(() => {
    const indices = new Set<number>();
    for (const operation of arrayOperations) {
      indices.add(operation.i);
      if (typeof operation.j === "number") {
        indices.add(operation.j);
      }
    }
    return indices;
  }, [arrayOperations]);

  const changedIndices = useMemo(
    () => new Set(snapshot?.changedArrayIndices[arrayEntries?.name ?? ""] ?? []),
    [snapshot?.changedArrayIndices, arrayEntries?.name],
  );

  const swapPair = useMemo(() => {
    const latestSwap = [...arrayOperations].reverse().find((operation) => operation.type === "swap");
    if (!latestSwap || typeof latestSwap.j !== "number") {
      return new Set<number>();
    }

    return new Set<number>([latestSwap.i, latestSwap.j]);
  }, [arrayOperations]);

  const latestCompare = useMemo(
    () => [...arrayOperations].reverse().find((operation) => operation.type === "compare"),
    [arrayOperations],
  );

  const comparePair = useMemo(() => {
    if (!latestCompare || typeof latestCompare.j !== "number") {
      return new Set<number>();
    }

    return new Set<number>([latestCompare.i, latestCompare.j]);
  }, [latestCompare]);

  const numericArray = useMemo(() => toNumeric(arrayEntries?.values ?? []), [arrayEntries?.values]);
  const maxAbsValue = useMemo(() => {
    if (!numericArray || numericArray.length === 0) {
      return 1;
    }

    return Math.max(...numericArray.map((value) => Math.abs(value)), 1);
  }, [numericArray]);

  const shouldRenderArrayMode = Boolean(
    arrayEntries &&
      (selectedStructure === "array" ||
        (selectedStructureOverride === undefined && selectedStructure === "unknown")),
  );

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100">DSA Visualization</h3>
        <select
          className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
          value={selectedStructureOverride ?? ""}
          onChange={(event) => {
            const value = event.target.value as StructureType | "";
            setStructureOverride(value === "" ? undefined : value);
          }}
        >
          <option value="">Auto ({selectedStructure})</option>
          {structureOptions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      {shouldRenderArrayMode && arrayEntries ? (
        <div>
          <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
            <span>Array source: {arrayEntries.name}</span>
            <span>ops this step: {arrayOperations.length}</span>
          </div>

          {arrayOperations.length > 0 ? (
            <div className="mb-2 flex flex-wrap gap-1 text-[11px]">
              {arrayOperations.slice(-4).map((operation, index) => (
                <span
                  key={`${operation.type}-${operation.i}-${operation.j ?? "-"}-${index}`}
                  className="rounded border border-zinc-700 bg-zinc-900/70 px-2 py-0.5 text-zinc-300"
                >
                  {operation.type}({operation.i}
                  {typeof operation.j === "number" ? `, ${operation.j}` : ""})
                </span>
              ))}
            </div>
          ) : null}

          <div className="mb-2 flex flex-wrap gap-3 text-[11px] text-zinc-400">
            <span className="text-sky-300">■ active index</span>
            <span className="text-amber-300">■ changed value</span>
            <span className="text-rose-300">■ latest swap pair</span>
          </div>

          {numericArray ? (
            <div className="max-h-64 overflow-auto rounded-lg border border-zinc-800 bg-zinc-900/30 p-2">
              <div className="flex min-w-max items-end gap-2">
                {numericArray.map((value, index) => {
                  const barHeight = Math.max((Math.abs(value) / maxAbsValue) * 120, 8);
                  return (
                    <div key={`${arrayEntries.name}-bar-${index}`} className="w-12 text-center">
                      <div
                        className={`mx-auto flex w-10 items-end justify-center rounded-t-md border text-[10px] text-zinc-100 transition-all duration-300 ${
                          swapPair.has(index)
                            ? "animate-pulse border-rose-400/90 bg-rose-500/60"
                            : comparePair.has(index)
                              ? "border-cyan-400/90 bg-cyan-500/60"
                              : changedIndices.has(index)
                                ? "border-amber-400/90 bg-amber-500/60"
                                : activeIndices.has(index)
                                  ? "border-sky-400/80 bg-sky-500/50"
                                  : "border-zinc-600 bg-zinc-700/60"
                        }`}
                        style={{ height: `${barHeight}px` }}
                        title={`index ${index} = ${value}`}
                      >
                        {value}
                      </div>
                      <div className="mt-1 text-[10px] text-zinc-400">[{index}]</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex max-h-48 flex-wrap gap-2 overflow-auto">
              {arrayEntries.values.map((value, index) => (
                <div
                  key={`${arrayEntries.name}-${index}`}
                  className={`w-14 overflow-hidden rounded-lg border text-center text-xs transition-colors ${
                    swapPair.has(index)
                      ? "animate-pulse border-rose-500/80 bg-rose-950/30"
                      : comparePair.has(index)
                        ? "border-cyan-500/70 bg-cyan-950/30"
                        : changedIndices.has(index)
                          ? "border-amber-500/70 bg-amber-950/20"
                          : activeIndices.has(index)
                            ? "border-sky-500/70 bg-sky-950/20"
                            : "border-zinc-700 bg-zinc-900/50"
                  }`}
                >
                  <div className="border-b border-zinc-700/70 px-1 py-1 text-[10px] text-zinc-400">
                    [{index}]
                  </div>
                  <div className="px-1 py-2 text-zinc-100">{value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {nodesAndEdges.nodes.length === 0 ? (
            <div className="rounded border border-zinc-800 bg-zinc-900/30 p-4 text-xs text-zinc-400">
              No pointer graph available for this step.
            </div>
          ) : (
            <div className="h-56 overflow-hidden rounded border border-zinc-800">
              <ReactFlow nodes={nodesAndEdges.nodes} edges={nodesAndEdges.edges} fitView>
                <MiniMap pannable zoomable />
                <Controls />
                <Background />
                <Panel position="top-left" className="rounded bg-zinc-900/80 px-2 py-1 text-xs">
                  {nodesAndEdges.nodes.length} nodes · {nodesAndEdges.edges.length} edges
                </Panel>
              </ReactFlow>
            </div>
          )}
        </>
      )}
    </section>
  );
}
