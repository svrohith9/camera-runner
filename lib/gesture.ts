export type Gesture = "jump" | "idle" | "flap";

export type PoseThresholds = {
  idleThreshold: number;
  jumpThreshold: number;
};

export type GestureMode = "accuracy" | "balanced" | "responsive";

export type GestureTuning = {
  jumpWindowMs: number;
  flapVelocityThreshold: number;
  flapCycles: number;
  pumpHistorySize: number;
  pumpThreshold: number;
  pumpRange: number;
  jumpShoulderMargin: number;
  jumpFallbackThreshold: number;
};

export type GestureInput = {
  wristY: number;
  wristX: number;
  shoulderY: number;
  thresholds: PoseThresholds | null;
  hasPose: boolean;
  hasWrist: boolean;
  timestamp: number;
  tuning?: GestureTuning;
};

export type GestureState = {
  mode: "idle" | "raising" | "jump" | "flapping";
  lastTimestamp: number;
  lastAboveIdleTime: number;
  lastWristX: number;
  lastVelocitySign: number;
  flapCycles: number;
  lastFlapTime: number;
};

export type PumpState = {
  lastTimestamp: number;
  lastLeftY: number;
  lastRightY: number;
  velocityHistory: number[];
};

export type PumpInput = {
  leftWristY: number;
  rightWristY: number;
  hasPose: boolean;
  hasWrists: boolean;
  timestamp: number;
  tuning?: GestureTuning;
};

export type PumpResult = {
  state: PumpState;
  pumpActive: boolean;
  speedMultiplier: number;
  averageVelocity: number;
};

export const createGestureState = (timestamp: number): GestureState => ({
  mode: "idle",
  lastTimestamp: timestamp,
  lastAboveIdleTime: 0,
  lastWristX: 0,
  lastVelocitySign: 0,
  flapCycles: 0,
  lastFlapTime: 0,
});

export const createPumpState = (timestamp: number): PumpState => ({
  lastTimestamp: timestamp,
  lastLeftY: 0,
  lastRightY: 0,
  velocityHistory: [],
});

export const getGestureTuning = (mode: GestureMode): GestureTuning => {
  switch (mode) {
    case "accuracy":
      return {
        jumpWindowMs: 320,
        flapVelocityThreshold: 180,
        flapCycles: 3,
        pumpHistorySize: 5,
        pumpThreshold: 0.9,
        pumpRange: 1.3,
        jumpShoulderMargin: 0.08,
        jumpFallbackThreshold: 0.3,
      };
    case "responsive":
      return {
        jumpWindowMs: 380,
        flapVelocityThreshold: 120,
        flapCycles: 2,
        pumpHistorySize: 3,
        pumpThreshold: 0.6,
        pumpRange: 0.9,
        jumpShoulderMargin: 0.05,
        jumpFallbackThreshold: 0.38,
      };
    case "balanced":
    default:
      return {
        jumpWindowMs: 320,
        flapVelocityThreshold: 190,
        flapCycles: 3,
        pumpHistorySize: 5,
        pumpThreshold: 1.0,
        pumpRange: 1.4,
        jumpShoulderMargin: 0.08,
        jumpFallbackThreshold: 0.3,
      };
  }
};

export function updateGesture(
  prev: GestureState,
  input: GestureInput
): { state: GestureState; gesture: Gesture } {
  if (!input.hasPose || !input.hasWrist) {
    return { state: { ...prev, mode: "idle" }, gesture: "idle" };
  }

  const dt = Math.max(0.001, (input.timestamp - prev.lastTimestamp) / 1000);
  const velocityX = (input.wristX - prev.lastWristX) / dt;
  const velocitySign = Math.sign(velocityX);
  const idleThreshold = input.thresholds?.idleThreshold ?? input.shoulderY + 0.1;
  const jumpThreshold =
    input.thresholds?.jumpThreshold ?? input.shoulderY - 0.05;
  const tuning = input.tuning ?? getGestureTuning("balanced");

  let nextState: GestureState = {
    ...prev,
    lastTimestamp: input.timestamp,
    lastWristX: input.wristX,
  };

  let gesture: Gesture = "idle";

  if (input.wristY > idleThreshold) {
    nextState.lastAboveIdleTime = input.timestamp;
  }

  if (
    input.wristY <= jumpThreshold &&
    input.timestamp - nextState.lastAboveIdleTime < tuning.jumpWindowMs
  ) {
    nextState.mode = "jump";
    gesture = "jump";
    nextState.flapCycles = 0;
  } else if (
    Math.abs(velocityX) > tuning.flapVelocityThreshold &&
    input.wristY >= idleThreshold
  ) {
    if (velocitySign !== 0 && velocitySign !== nextState.lastVelocitySign) {
      nextState.flapCycles += 1;
      nextState.lastVelocitySign = velocitySign;
      nextState.lastFlapTime = input.timestamp;
    }

    if (nextState.flapCycles >= tuning.flapCycles) {
      nextState.mode = "flapping";
      gesture = "flap";
    }
  }

  if (input.timestamp - nextState.lastFlapTime > 1000) {
    nextState.flapCycles = 0;
  }

  if (gesture === "idle" && nextState.mode !== "idle") {
    nextState.mode = "idle";
  }

  return { state: nextState, gesture };
}

const MAX_SPEED_MULTIPLIER = 2.4;

export function updatePumpState(
  prev: PumpState,
  input: PumpInput
): PumpResult {
  if (!input.hasPose || !input.hasWrists) {
    return {
      state: { ...prev, lastTimestamp: input.timestamp, velocityHistory: [] },
      pumpActive: false,
      speedMultiplier: 1,
      averageVelocity: 0,
    };
  }

  const dt = Math.max(0.001, (input.timestamp - prev.lastTimestamp) / 1000);
  const velocityLeft = (input.leftWristY - prev.lastLeftY) / dt;
  const velocityRight = (input.rightWristY - prev.lastRightY) / dt;
  const avgAbsVelocity = (Math.abs(velocityLeft) + Math.abs(velocityRight)) / 2;

  const tuning = input.tuning ?? getGestureTuning("balanced");
  const nextHistory = [...prev.velocityHistory, avgAbsVelocity].slice(
    -tuning.pumpHistorySize
  );
  const averageVelocity =
    nextHistory.reduce((sum, value) => sum + value, 0) /
    Math.max(1, nextHistory.length);
  const normalized =
    Math.max(0, averageVelocity - tuning.pumpThreshold) / tuning.pumpRange;
  const speedMultiplier = Math.min(
    MAX_SPEED_MULTIPLIER,
    1 + normalized * (MAX_SPEED_MULTIPLIER - 1)
  );

  return {
    state: {
      lastTimestamp: input.timestamp,
      lastLeftY: input.leftWristY,
      lastRightY: input.rightWristY,
      velocityHistory: nextHistory,
    },
    pumpActive: averageVelocity > tuning.pumpThreshold,
    speedMultiplier,
    averageVelocity,
  };
}

export function getGestureConfidence(
  gesture: Gesture,
  velocityX: number,
  wristY: number,
  thresholds: PoseThresholds | null
): number {
  if (!thresholds) {
    return 0.2;
  }
  if (gesture === "jump") {
    return Math.min(1, Math.max(0, (thresholds.jumpThreshold - wristY + 0.1) * 4));
  }
  if (gesture === "flap") {
    return Math.min(1, Math.max(0, (Math.abs(velocityX) - 200) / 300));
  }
  return 0.1;
}
