import { StateCreator } from "zustand";

export type PlaybackDirection = "forward" | "backward";

export interface PlaybackSlice {
  currentStep: number;
  isPlaying: boolean;
  speed: number;
  direction: PlaybackDirection;
  setCurrentStep: (step: number) => void;
  play: () => void;
  pause: () => void;
  setSpeed: (speed: number) => void;
  setDirection: (direction: PlaybackDirection) => void;
  resetPlayback: () => void;
}

export const createPlaybackSlice: StateCreator<
  PlaybackSlice,
  [],
  [],
  PlaybackSlice
> = (set) => ({
  currentStep: 0,
  isPlaying: false,
  speed: 1,
  direction: "forward",

  setCurrentStep: (currentStep) => set({ currentStep }),
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  setSpeed: (speed) => set({ speed }),
  setDirection: (direction) => set({ direction }),
  resetPlayback: () =>
    set({
      currentStep: 0,
      isPlaying: false,
      speed: 1,
      direction: "forward",
    }),
});
