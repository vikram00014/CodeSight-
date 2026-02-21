"use client";

import * as d3 from "d3";
import { useEffect, useMemo, useRef } from "react";

import { useCodeSightStore } from "@/src/store/codesight-store";

export function ComplexityPanel() {
  const snapshots = useCodeSightStore((state) => state.snapshots);
  const operationsSvgRef = useRef<SVGSVGElement | null>(null);
  const snapshotSizeSvgRef = useRef<SVGSVGElement | null>(null);
  const heapGrowthSvgRef = useRef<SVGSVGElement | null>(null);

  const operationSeries = useMemo(() => {
    const stride = snapshots.length > 1000 ? Math.ceil(snapshots.length / 1000) : 1;
    return snapshots
      .filter((_, idx) => idx % stride === 0)
      .map((snapshot) => ({
        step: snapshot.step,
        comparisons: snapshot.operationCounters.comparisons,
        assignments: snapshot.operationCounters.assignments,
        swaps: snapshot.operationCounters.swaps,
      }));
  }, [snapshots]);

  const memorySeries = useMemo(() => {
    const stride = snapshots.length > 1000 ? Math.ceil(snapshots.length / 1000) : 1;
    return snapshots
      .filter((_, idx) => idx % stride === 0)
      .map((snapshot) => ({
        step: snapshot.step,
        snapshotBytes: snapshot.memoryUsageEstimateBytes,
        heapObjects: snapshot.heapRefIds.length,
      }));
  }, [snapshots]);

  useEffect(() => {
    if (!operationsSvgRef.current) {
      return;
    }

    const width = 460;
    const height = 180;
    const margin = { top: 16, right: 20, bottom: 24, left: 32 };

    const svg = d3.select(operationsSvgRef.current);
    svg.selectAll("*").remove();

    if (operationSeries.length === 0) {
      svg
        .append("text")
        .attr("x", 12)
        .attr("y", 22)
        .attr("fill", "#9ca3af")
        .attr("font-size", 12)
        .text("Run code to generate complexity data");
      return;
    }

    const x = d3
      .scaleLinear()
      .domain([0, d3.max(operationSeries, (d) => d.step) ?? 1])
      .range([margin.left, width - margin.right]);

    const maxY =
      d3.max(operationSeries, (d) => Math.max(d.comparisons, d.assignments, d.swaps)) ?? 1;

    const y = d3
      .scaleLinear()
      .domain([0, Math.max(maxY, 1)])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const line = (key: "comparisons" | "assignments" | "swaps") =>
      d3
        .line<(typeof operationSeries)[number]>()
        .x((d) => x(d.step))
        .y((d) => y(d[key]));

    svg
      .append("path")
      .datum(operationSeries)
      .attr("fill", "none")
      .attr("stroke", "#34d399")
      .attr("stroke-width", 1.6)
      .attr("d", line("comparisons"));

    svg
      .append("path")
      .datum(operationSeries)
      .attr("fill", "none")
      .attr("stroke", "#60a5fa")
      .attr("stroke-width", 1.4)
      .attr("d", line("assignments"));

    svg
      .append("path")
      .datum(operationSeries)
      .attr("fill", "none")
      .attr("stroke", "#f59e0b")
      .attr("stroke-width", 1.4)
      .attr("d", line("swaps"));

    svg
      .append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(6).tickSizeOuter(0))
      .selectAll("text")
      .attr("fill", "#9ca3af")
      .attr("font-size", 10);

    svg
      .append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(5).tickSizeOuter(0))
      .selectAll("text")
      .attr("fill", "#9ca3af")
      .attr("font-size", 10);
  }, [operationSeries]);

  useEffect(() => {
    if (!snapshotSizeSvgRef.current) {
      return;
    }

    const width = 460;
    const height = 120;
    const margin = { top: 12, right: 20, bottom: 24, left: 40 };

    const svg = d3.select(snapshotSizeSvgRef.current);
    svg.selectAll("*").remove();

    if (memorySeries.length === 0) {
      return;
    }

    const x = d3
      .scaleLinear()
      .domain([0, d3.max(memorySeries, (d) => d.step) ?? 1])
      .range([margin.left, width - margin.right]);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(memorySeries, (d) => d.snapshotBytes) ?? 1])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const line = d3
      .line<(typeof memorySeries)[number]>()
      .x((d) => x(d.step))
      .y((d) => y(d.snapshotBytes));

    svg
      .append("path")
      .datum(memorySeries)
      .attr("fill", "none")
      .attr("stroke", "#c084fc")
      .attr("stroke-width", 1.5)
      .attr("d", line);

    svg
      .append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(5).tickSizeOuter(0))
      .selectAll("text")
      .attr("fill", "#9ca3af")
      .attr("font-size", 9);

    svg
      .append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(4).tickSizeOuter(0))
      .selectAll("text")
      .attr("fill", "#9ca3af")
      .attr("font-size", 9);
  }, [memorySeries]);

  useEffect(() => {
    if (!heapGrowthSvgRef.current) {
      return;
    }

    const width = 460;
    const height = 120;
    const margin = { top: 12, right: 20, bottom: 24, left: 32 };

    const svg = d3.select(heapGrowthSvgRef.current);
    svg.selectAll("*").remove();

    if (memorySeries.length === 0) {
      return;
    }

    const x = d3
      .scaleLinear()
      .domain([0, d3.max(memorySeries, (d) => d.step) ?? 1])
      .range([margin.left, width - margin.right]);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(memorySeries, (d) => d.heapObjects) ?? 1])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const line = d3
      .line<(typeof memorySeries)[number]>()
      .x((d) => x(d.step))
      .y((d) => y(d.heapObjects));

    svg
      .append("path")
      .datum(memorySeries)
      .attr("fill", "none")
      .attr("stroke", "#22d3ee")
      .attr("stroke-width", 1.5)
      .attr("d", line);

    svg
      .append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(5).tickSizeOuter(0))
      .selectAll("text")
      .attr("fill", "#9ca3af")
      .attr("font-size", 9);

    svg
      .append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(4).tickSizeOuter(0))
      .selectAll("text")
      .attr("fill", "#9ca3af")
      .attr("font-size", 9);
  }, [memorySeries]);

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <h3 className="mb-2 text-sm font-semibold text-zinc-100">Complexity & Operations</h3>
      <div className="mb-2 flex gap-4 text-[11px] text-zinc-400">
        <span className="text-emerald-300">■ comparisons</span>
        <span className="text-sky-300">■ assignments</span>
        <span className="text-amber-300">■ swaps</span>
      </div>

      <svg ref={operationsSvgRef} viewBox="0 0 460 180" className="w-full" />

      <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/30 p-2">
        <div className="mb-1 text-xs text-zinc-300">Snapshot Size per Step</div>
        <div className="mb-2 text-[11px] text-zinc-500">
          <span className="text-violet-300">■ snapshot bytes (estimated)</span>
        </div>
        <svg ref={snapshotSizeSvgRef} viewBox="0 0 460 120" className="w-full" />
      </div>

      <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/30 p-2">
        <div className="mb-1 text-xs text-zinc-300">Heap Growth Timeline</div>
        <div className="mb-2 text-[11px] text-zinc-500">
          <span className="text-cyan-300">■ heap objects tracked</span>
        </div>
        <svg ref={heapGrowthSvgRef} viewBox="0 0 460 120" className="w-full" />
      </div>
    </section>
  );
}
