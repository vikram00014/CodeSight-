"use client";

import { useCodeSightStore } from "@/src/store/codesight-store";

export class PlaybackEngine {
  private timerId: number | null = null;

  start() {
    this.stop();

    const tick = () => {
      const state = useCodeSightStore.getState();
      if (!state.isPlaying) {
        this.stop();
        return;
      }

      const stepCount = state.metadata?.stepCount ?? state.snapshots.length;
      const nextStep =
        state.direction === "forward"
          ? Math.min(state.currentStep + 1, Math.max(stepCount - 1, 0))
          : Math.max(state.currentStep - 1, 0);

      if (nextStep === state.currentStep) {
        state.pause();
        this.stop();
        return;
      }

      state.setCurrentStep(nextStep);
      state.setCurrentStepSnapshot(nextStep);

      const fps = 30 * state.speed;
      this.timerId = window.setTimeout(tick, 1000 / fps);
    };

    tick();
  }

  stop() {
    if (this.timerId !== null) {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }
  }
}

export const playbackEngine = new PlaybackEngine();
