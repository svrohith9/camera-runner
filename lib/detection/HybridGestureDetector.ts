"use client";

import type { PoseKeypoint } from "../pose";

type HandsResult = {
  multiHandLandmarks?: Array<
    Array<{ x: number; y: number; z?: number; visibility?: number }>
  >;
  multiHandedness?: Array<{ label: string }>;
};

type PoseResult = {
  poseLandmarks?: Array<{ x: number; y: number; visibility?: number; presence?: number }>;
};

type DetectResult = {
  keypoints: PoseKeypoint[];
  maxScore: number;
};

const COCO_KEYPOINTS: Array<{ name: string; index: number }> = [
  { name: "nose", index: 0 },
  { name: "left_eye", index: 2 },
  { name: "right_eye", index: 5 },
  { name: "left_ear", index: 7 },
  { name: "right_ear", index: 8 },
  { name: "left_shoulder", index: 11 },
  { name: "right_shoulder", index: 12 },
  { name: "left_elbow", index: 13 },
  { name: "right_elbow", index: 14 },
  { name: "left_wrist", index: 15 },
  { name: "right_wrist", index: 16 },
  { name: "left_hip", index: 23 },
  { name: "right_hip", index: 24 },
  { name: "left_knee", index: 25 },
  { name: "right_knee", index: 26 },
  { name: "left_ankle", index: 27 },
  { name: "right_ankle", index: 28 },
];

export type DetectionMode = "accuracy" | "balanced" | "responsive";

const MODE_TUNING: Record<
  DetectionMode,
  { frameSkip: number; poseRefresh: number }
> = {
  accuracy: { frameSkip: 1, poseRefresh: 6 },
  balanced: { frameSkip: 2, poseRefresh: 10 },
  responsive: { frameSkip: 1, poseRefresh: 12 },
};

export class HybridGestureDetector {
  private handsDetector: any = null;
  private poseDetector: any = null;
  private lastResult: DetectResult | null = null;
  private lastPoseKeypoints: PoseKeypoint[] | null = null;
  private frameSkipCounter = 0;
  private frameSkipThreshold = MODE_TUNING.balanced.frameSkip;
  private poseRefreshInterval = MODE_TUNING.balanced.poseRefresh;
  private roiCanvas: HTMLCanvasElement | null = null;
  private roiContext: CanvasRenderingContext2D | null = null;
  private handsResults: HandsResult | null = null;
  private poseResults: PoseResult | null = null;

  async initialize(): Promise<void> {
    if (this.handsDetector && this.poseDetector) {
      return;
    }

    const mpHands = await import("@mediapipe/hands");
    const mpPose = await import("@mediapipe/pose");

    this.handsDetector = new mpHands.Hands({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    this.poseDetector = new mpPose.Pose({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });

    this.handsDetector.setOptions({
      maxNumHands: 2,
      modelComplexity: 0,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
      selfieMode: true,
    });

    this.poseDetector.setOptions({
      modelComplexity: 0,
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
      selfieMode: true,
    });

    this.handsDetector.onResults((results: HandsResult) => {
      this.handsResults = results;
    });

    this.poseDetector.onResults((results: PoseResult) => {
      this.poseResults = results;
    });
  }

  updateMode(mode: DetectionMode): void {
    const tuning = MODE_TUNING[mode] ?? MODE_TUNING.balanced;
    this.frameSkipThreshold = tuning.frameSkip;
    this.poseRefreshInterval = tuning.poseRefresh;
  }

  async detect(video: HTMLVideoElement): Promise<DetectResult> {
    if (
      this.frameSkipCounter++ % this.frameSkipThreshold !== 0 &&
      this.lastResult
    ) {
      return this.lastResult;
    }

    const roiCanvas = this.getROICanvas(video);
    await this.handsDetector?.send({ image: roiCanvas });
    const hands = this.handsResults;

    const shouldRefreshPose =
      this.frameSkipCounter % this.poseRefreshInterval === 0;

    if (hands?.multiHandLandmarks?.length && !shouldRefreshPose) {
      const keypoints = this.lastPoseKeypoints
        ? this.lastPoseKeypoints.map((point) => ({ ...point }))
        : this.buildEmptyKeypoints();
      const handsMapped = this.mapHandsToWrists(
        hands,
        roiCanvas.width,
        roiCanvas.height
      );
      for (const hand of handsMapped) {
        const index = COCO_KEYPOINTS.findIndex(
          (kp) => kp.name === `${hand.side}_wrist`
        );
        if (index >= 0) {
          keypoints[index] = {
            name: `${hand.side}_wrist`,
            x: hand.x,
            y: hand.y,
            score: hand.score,
          };
        }
      }
      const maxScore = keypoints.reduce(
        (max, point) => Math.max(max, point.score),
        0
      );
      this.lastResult = { keypoints, maxScore };
      return this.lastResult;
    }

    await this.poseDetector?.send({ image: roiCanvas });
    const pose = this.poseResults;
    const keypoints = this.buildPoseKeypoints(
      pose?.poseLandmarks ?? [],
      roiCanvas.width,
      roiCanvas.height
    );
    this.lastPoseKeypoints = keypoints;

    const maxScore = keypoints.reduce(
      (max, point) => Math.max(max, point.score),
      0
    );
    this.lastResult = { keypoints, maxScore };
    return this.lastResult;
  }

  private buildEmptyKeypoints(): PoseKeypoint[] {
    return COCO_KEYPOINTS.map((kp) => ({
      name: kp.name,
      x: 0,
      y: 0,
      score: 0,
    }));
  }

  private buildPoseKeypoints(
    landmarks: Array<{ x: number; y: number; visibility?: number; presence?: number }>,
    width: number,
    height: number
  ): PoseKeypoint[] {
    const keypoints = this.buildEmptyKeypoints();
    for (let i = 0; i < COCO_KEYPOINTS.length; i += 1) {
      const kp = COCO_KEYPOINTS[i];
      const landmark = landmarks[kp.index];
      if (!landmark) {
        continue;
      }
      keypoints[i] = {
        name: kp.name,
        x: landmark.x * width,
        y: landmark.y * height,
        score: landmark.visibility ?? landmark.presence ?? 0,
      };
    }
    return keypoints;
  }

  private mapHandsToWrists(
    hands: HandsResult,
    width: number,
    height: number
  ): Array<{ side: "left" | "right"; x: number; y: number; score: number }> {
    const output: Array<{ side: "left" | "right"; x: number; y: number; score: number }> =
      [];
    const landmarks = hands.multiHandLandmarks ?? [];
    const handedness = hands.multiHandedness ?? [];

    for (let i = 0; i < landmarks.length; i += 1) {
      const wrist = landmarks[i]?.[0];
      if (!wrist) {
        continue;
      }
      const side =
        handedness[i]?.label?.toLowerCase() === "right" ? "right" : "left";
      output.push({
        side,
        x: wrist.x * width,
        y: wrist.y * height,
        score: wrist.visibility ?? 0.9,
      });
    }

    return output;
  }

  private getROICanvas(video: HTMLVideoElement): HTMLCanvasElement {
    const width = video.videoWidth || 1;
    const height = Math.floor((video.videoHeight || 1) * 0.6);
    if (!this.roiCanvas) {
      this.roiCanvas = document.createElement("canvas");
      this.roiContext = this.roiCanvas.getContext("2d");
    }

    if (!this.roiCanvas || !this.roiContext) {
      return video as unknown as HTMLCanvasElement;
    }

    if (this.roiCanvas.width !== width || this.roiCanvas.height !== height) {
      this.roiCanvas.width = width;
      this.roiCanvas.height = height;
    }

    this.roiContext.drawImage(video, 0, 0, width, height, 0, 0, width, height);
    return this.roiCanvas;
  }
}
