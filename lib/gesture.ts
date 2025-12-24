export type Gesture = "jump" | "idle" | "flap";

export type PoseThresholds = {
  idleThreshold: number;
  jumpThreshold: number;
};

export type GestureInput = {
  wristY: number;
  wristVelocityX: number;
  shoulderY: number;
  thresholds: PoseThresholds;
  hasPose: boolean;
  hasWrist: boolean;
};

export function classifyGesture(input: GestureInput): Gesture {
  if (!input.hasPose || !input.hasWrist) {
    return "idle";
  }

  const idle = input.thresholds.idleThreshold;
  const jump = Math.min(
    input.thresholds.jumpThreshold,
    input.thresholds.idleThreshold - 0.05
  );
  const hasThresholds = idle > 0 && jump > 0;

  if (hasThresholds) {
    if (input.wristY <= jump) {
      return "jump";
    }

    if (input.wristY >= idle && input.wristVelocityX > 200) {
      return "flap";
    }
  } else if (input.shoulderY > 0) {
    if (input.wristY <= input.shoulderY - 0.05) {
      return "jump";
    }

    if (input.wristY >= input.shoulderY + 0.1 && input.wristVelocityX > 180) {
      return "flap";
    }
  }

  return "idle";
}
