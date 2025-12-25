import { create } from "zustand";
import { persist } from "zustand/middleware";

export type GameState = {
  score: number;
  combo: number;
  highScore: number;
  lives: number;
  speedMultiplier: number;
  preferKeyboard: boolean;
  setScore: (score: number) => void;
  setCombo: (combo: number) => void;
  setHighScore: (score: number) => void;
  resetScore: () => void;
  setLives: (lives: number) => void;
  resetLives: () => void;
  setSpeedMultiplier: (multiplier: number) => void;
  setPreferKeyboard: (value: boolean) => void;
};

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      score: 0,
      combo: 1,
      highScore: 0,
      lives: 3,
      speedMultiplier: 1,
      preferKeyboard: false,
      setScore: (score) => set({ score }),
      setCombo: (combo) => set({ combo }),
      setHighScore: (highScore) => set({ highScore }),
      resetScore: () => set({ score: 0, combo: 1 }),
      setLives: (lives) => set({ lives }),
      resetLives: () => set({ lives: 3 }),
      setSpeedMultiplier: (speedMultiplier) => set({ speedMultiplier }),
      setPreferKeyboard: (preferKeyboard) => set({ preferKeyboard }),
    }),
    {
      name: "camera-runner-game",
      partialize: (state) => ({
        highScore: state.highScore,
        preferKeyboard: state.preferKeyboard,
      }),
    }
  )
);
