import { StateCreator } from "zustand";

import { StructureType } from "@/src/types/execution";

export interface VisualizationSlice {
  selectedStructureOverride?: StructureType;
  animationsEnabled: boolean;
  showDebugPanel: boolean;
  setStructureOverride: (structure?: StructureType) => void;
  setAnimationsEnabled: (enabled: boolean) => void;
  toggleDebugPanel: () => void;
  resetVisualization: () => void;
}

export const createVisualizationSlice: StateCreator<
  VisualizationSlice,
  [],
  [],
  VisualizationSlice
> = (set) => ({
  selectedStructureOverride: undefined,
  animationsEnabled: true,
  showDebugPanel: true,

  setStructureOverride: (selectedStructureOverride) => set({ selectedStructureOverride }),
  setAnimationsEnabled: (animationsEnabled) => set({ animationsEnabled }),
  toggleDebugPanel: () =>
    set((state) => ({
      showDebugPanel: !state.showDebugPanel,
    })),
  resetVisualization: () =>
    set({
      selectedStructureOverride: undefined,
      animationsEnabled: true,
    }),
});
