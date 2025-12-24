import { z } from "zod";
import type { PoseThresholds } from "./gesture";

const thresholdsSchema = z.object({
  idleThreshold: z.number().min(0).max(1),
  jumpThreshold: z.number().min(0).max(1),
});

const highScoreSchema = z.number().min(0);

const THRESHOLDS_KEY = "camera-runner-thresholds";
const HIGH_SCORE_KEY = "camera-runner-highscore";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function loadThresholds(): PoseThresholds | null {
  if (!isBrowser()) {
    return null;
  }

  const raw = window.localStorage.getItem(THRESHOLDS_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = thresholdsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch (error) {
    console.error("[GameError]", error);
    return null;
  }
}

export function saveThresholds(thresholds: PoseThresholds): void {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(THRESHOLDS_KEY, JSON.stringify(thresholds));
}

export function clearThresholds(): void {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(THRESHOLDS_KEY);
}

export function loadHighScore(): number {
  if (!isBrowser()) {
    return 0;
  }

  const raw = window.localStorage.getItem(HIGH_SCORE_KEY);
  if (!raw) {
    return 0;
  }

  try {
    const parsed = highScoreSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : 0;
  } catch (error) {
    console.error("[GameError]", error);
    return 0;
  }
}

export function saveHighScore(score: number): void {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(HIGH_SCORE_KEY, JSON.stringify(score));
}
