export type PoseKeypoint = {
  name: string;
  x: number;
  y: number;
  score: number;
};

export type PoseFrame = {
  keypoints: PoseKeypoint[];
  timestamp: number;
};

export const EMA_ALPHA = 0.3;

export function smoothKeypoints(
  previous: PoseKeypoint[] | null,
  next: PoseKeypoint[],
  alpha: number = EMA_ALPHA
): PoseKeypoint[] {
  if (!previous || previous.length === 0) {
    return next;
  }

  return next.map((point) => {
    const match = previous.find((prev) => prev.name === point.name);
    if (!match) {
      return point;
    }

    return {
      ...point,
      x: match.x * alpha + point.x * (1 - alpha),
      y: match.y * alpha + point.y * (1 - alpha),
      score: point.score,
    };
  });
}

export function getWristKeypoint(keypoints: PoseKeypoint[]): PoseKeypoint | null {
  const left = keypoints.find((point) => point.name === "left_wrist");
  const right = keypoints.find((point) => point.name === "right_wrist");

  if (left && right) {
    return left.score >= right.score ? left : right;
  }

  return left ?? right ?? null;
}

export function getShoulderKeypoint(
  keypoints: PoseKeypoint[]
): PoseKeypoint | null {
  const left = keypoints.find((point) => point.name === "left_shoulder");
  const right = keypoints.find((point) => point.name === "right_shoulder");

  if (left && right) {
    return left.score >= right.score ? left : right;
  }

  return left ?? right ?? null;
}

export function normalizeY(y: number, height: number): number {
  if (height <= 0) {
    return 0;
  }

  return Math.min(1, Math.max(0, y / height));
}
