import { useMemo } from "react";

import { useCodeSightStore } from "@/src/store/codesight-store";

export function useExecutionSummary() {
  return useCodeSightStore((state) => ({
    status: state.status,
    language: state.language,
    stepCount: state.metadata?.stepCount ?? state.snapshots.length,
    executionTimeMs: state.metadata?.executionTimeMs ?? 0,
    currentStep: state.currentStep,
  }));
}

export function useCurrentSnapshot() {
  return useCodeSightStore((state) => state.currentSnapshot);
}

export function usePlaybackControls() {
  return useCodeSightStore((state) => ({
    isPlaying: state.isPlaying,
    speed: state.speed,
    direction: state.direction,
    currentStep: state.currentStep,
    setCurrentStep: state.setCurrentStep,
    play: state.play,
    pause: state.pause,
    setSpeed: state.setSpeed,
    setDirection: state.setDirection,
  }));
}

export function useStructureSelection() {
  const selectedOverride = useCodeSightStore(
    (state) => state.selectedStructureOverride,
  );
  const snapshot = useCurrentSnapshot();

  return useMemo(() => {
    const auto = snapshot?.detectedStructures[0]?.structureType ?? "unknown";
    return selectedOverride ?? auto;
  }, [selectedOverride, snapshot?.detectedStructures]);
}
