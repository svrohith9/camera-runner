import { create } from "zustand";
import type { PoseKeypoint } from "./pose";
import type { PoseThresholds } from "./gesture";

type GameSlice = {
  score: number;
  combo: number;
  highScore: number;
  setScore: (score: number) => void;
  setCombo: (combo: number) => void;
  setHighScore: (score: number) => void;
  resetScore: () => void;
};

type PoseSlice = {
  keypoints: PoseKeypoint[];
  thresholds: PoseThresholds | null;
  setKeypoints: (keypoints: PoseKeypoint[]) => void;
  setThresholds: (thresholds: PoseThresholds | null) => void;
};

export const useGameStore = create<GameSlice & PoseSlice>((set) => ({
  score: 0,
  combo: 1,
  highScore: 0,
  keypoints: [],
  thresholds: null,
  setScore: (score) => set({ score }),
  setCombo: (combo) => set({ combo }),
  setHighScore: (highScore) => set({ highScore }),
  resetScore: () => set({ score: 0, combo: 1 }),
  setKeypoints: (keypoints) => set({ keypoints }),
  setThresholds: (thresholds) => set({ thresholds }),
}));
