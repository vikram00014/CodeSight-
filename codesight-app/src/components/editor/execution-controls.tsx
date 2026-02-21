"use client";

import { Play, Pause, SkipBack, SkipForward, RotateCcw } from "lucide-react";

interface ExecutionControlsProps {
  isRunning: boolean;
  isPlaying: boolean;
  onRun: () => void;
  onPlayPause: () => void;
  onStepBackward: () => void;
  onStepForward: () => void;
  onReset: () => void;
}

export function ExecutionControls({
  isRunning,
  isPlaying,
  onRun,
  onPlayPause,
  onStepBackward,
  onStepForward,
  onReset,
}: ExecutionControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-2">
      <button
        type="button"
        onClick={onRun}
        disabled={isRunning}
        className="rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-zinc-950 shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isRunning ? "Running..." : "Run"}
      </button>

      <button
        type="button"
        onClick={onPlayPause}
        className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-medium transition hover:border-zinc-500"
      >
        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        {isPlaying ? "Pause" : "Play"}
      </button>

      <button
        type="button"
        onClick={onStepBackward}
        className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-medium transition hover:border-zinc-500"
      >
        <SkipBack size={16} /> Prev
      </button>

      <button
        type="button"
        onClick={onStepForward}
        className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-medium transition hover:border-zinc-500"
      >
        <SkipForward size={16} /> Next
      </button>

      <button
        type="button"
        onClick={onReset}
        className="inline-flex items-center gap-2 rounded-xl border border-rose-800/70 bg-rose-950/20 px-3 py-2 text-sm font-medium text-rose-200 transition hover:border-rose-600"
      >
        <RotateCcw size={16} /> Reset
      </button>
    </div>
  );
}
