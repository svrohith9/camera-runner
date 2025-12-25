import { describe, expect, it } from "vitest";
import {
  createGestureState,
  createPumpState,
  updateGesture,
  updatePumpState,
  type PoseThresholds,
} from "../lib/gesture";

describe("updateGesture", () => {
  const thresholds: PoseThresholds = {
    idleThreshold: 0.75,
    jumpThreshold: 0.35,
  };

  it("stays idle without pose", () => {
    const result = updateGesture(createGestureState(0), {
      wristY: 0.5,
      wristX: 0,
      shoulderY: 0.5,
      thresholds,
      hasPose: false,
      hasWrist: false,
      timestamp: 100,
    });
    expect(result.gesture).toBe("idle");
  });

  it("detects jump when wrist crosses threshold quickly", () => {
    const state = createGestureState(0);
    const mid = updateGesture(state, {
      wristY: 0.8,
      wristX: 0,
      shoulderY: 0.5,
      thresholds,
      hasPose: true,
      hasWrist: true,
      timestamp: 50,
    }).state;

    const result = updateGesture(mid, {
      wristY: 0.3,
      wristX: 0,
      shoulderY: 0.5,
      thresholds,
      hasPose: true,
      hasWrist: true,
      timestamp: 200,
    });

    expect(result.gesture).toBe("jump");
  });

  it("detects flap after oscillations", () => {
    let state = createGestureState(0);
    const timestamps = [100, 150, 200, 250, 300, 350];
    const xs = [0, 50, -50, 60, -60, 70];

    for (let i = 0; i < xs.length; i += 1) {
      const result = updateGesture(state, {
        wristY: 0.8,
        wristX: xs[i],
        shoulderY: 0.5,
        thresholds,
        hasPose: true,
        hasWrist: true,
        timestamp: timestamps[i],
      });
      state = result.state;
    }

    const final = updateGesture(state, {
      wristY: 0.8,
      wristX: -70,
      shoulderY: 0.5,
      thresholds,
      hasPose: true,
      hasWrist: true,
      timestamp: 400,
    });

    expect(final.gesture).toBe("flap");
  });
});

describe("updatePumpState", () => {
  it("resets when no pose is available", () => {
    const result = updatePumpState(createPumpState(0), {
      leftWristY: 0,
      rightWristY: 0,
      hasPose: false,
      hasWrists: false,
      timestamp: 100,
    });

    expect(result.pumpActive).toBe(false);
    expect(result.speedMultiplier).toBe(1);
  });

  it("activates pump when wrist velocity stays high", () => {
    let state = createPumpState(0);
    const frames = [
      { t: 100, y: 0.2 },
      { t: 200, y: 0.55 },
      { t: 300, y: 0.15 },
      { t: 400, y: 0.6 },
      { t: 500, y: 0.2 },
      { t: 600, y: 0.55 },
    ];

    let result = null as ReturnType<typeof updatePumpState> | null;
    for (const frame of frames) {
      result = updatePumpState(state, {
        leftWristY: frame.y,
        rightWristY: frame.y,
        hasPose: true,
        hasWrists: true,
        timestamp: frame.t,
      });
      state = result.state;
    }

    expect(result?.pumpActive).toBe(true);
    expect((result?.speedMultiplier ?? 1) > 1).toBe(true);
  });
});
