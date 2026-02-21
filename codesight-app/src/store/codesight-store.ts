import { create } from "zustand";

import {
  createExecutionDataSlice,
  ExecutionDataSlice,
} from "@/src/store/slices/execution-data-slice";
import { createPlaybackSlice, PlaybackSlice } from "@/src/store/slices/playback-slice";
import {
  createSettingsSlice,
  SettingsSlice,
} from "@/src/store/slices/settings-slice";
import {
  createVisualizationSlice,
  VisualizationSlice,
} from "@/src/store/slices/visualization-slice";

export type CodeSightStore = ExecutionDataSlice &
  PlaybackSlice &
  VisualizationSlice &
  SettingsSlice;

export const useCodeSightStore = create<CodeSightStore>()((...args) => ({
  ...createExecutionDataSlice(...args),
  ...createPlaybackSlice(...args),
  ...createVisualizationSlice(...args),
  ...createSettingsSlice(...args),
}));
