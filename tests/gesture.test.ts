import { describe, expect, it } from "vitest";
import { classifyGesture, type PoseThresholds } from "../lib/gesture";

describe("classifyGesture", () => {
  const thresholds: PoseThresholds = {
    idleThreshold: 0.7,
    jumpThreshold: 0.3,
  };

  it("returns idle when no pose", () => {
    const gesture = classifyGesture({
      wristY: 0.5,
      wristVelocityX: 0,
      shoulderY: 0,
      thresholds,
      hasPose: false,
      hasWrist: false,
    });
    expect(gesture).toBe("idle");
  });

  it("returns jump when wrist above jump threshold", () => {
    const gesture = classifyGesture({
      wristY: 0.2,
      wristVelocityX: 0,
      shoulderY: 0.5,
      thresholds,
      hasPose: true,
      hasWrist: true,
    });
    expect(gesture).toBe("jump");
  });

  it("returns flap when wrist low and moving fast", () => {
    const gesture = classifyGesture({
      wristY: 0.85,
      wristVelocityX: 240,
      shoulderY: 0.4,
      thresholds,
      hasPose: true,
      hasWrist: true,
    });
    expect(gesture).toBe("flap");
  });

  it("returns idle for slow wrist movement", () => {
    const gesture = classifyGesture({
      wristY: 0.8,
      wristVelocityX: 100,
      shoulderY: 0.4,
      thresholds,
      hasPose: true,
      hasWrist: true,
    });
    expect(gesture).toBe("idle");
  });
});
