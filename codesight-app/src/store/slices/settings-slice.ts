import { StateCreator } from "zustand";

import { DEFAULT_SAFETY_LIMITS } from "@/src/config/defaults";
import { ExecutionSafetyLimits } from "@/src/types/execution";

export interface SettingsSlice {
  safetyLimits: ExecutionSafetyLimits;
  deterministicMode: boolean;
  setSafetyLimits: (limits: Partial<ExecutionSafetyLimits>) => void;
  setDeterministicMode: (enabled: boolean) => void;
  resetSettings: () => void;
}

export const createSettingsSlice: StateCreator<
  SettingsSlice,
  [],
  [],
  SettingsSlice
> = (set) => ({
  safetyLimits: DEFAULT_SAFETY_LIMITS,
  deterministicMode: false,

  setSafetyLimits: (limits) =>
    set((state) => ({
      safetyLimits: {
        ...state.safetyLimits,
        ...limits,
      },
    })),

  setDeterministicMode: (deterministicMode) => set({ deterministicMode }),

  resetSettings: () =>
    set({
      safetyLimits: DEFAULT_SAFETY_LIMITS,
      deterministicMode: false,
    }),
});
