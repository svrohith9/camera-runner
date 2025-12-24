import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl";
import * as poseDetection from "@tensorflow-models/pose-detection";

const ctx = self as DedicatedWorkerGlobalScope;

let detector: poseDetection.PoseDetector | null = null;
let isReady = false;
const KEYPOINT_NAMES = [
  "nose",
  "left_eye",
  "right_eye",
  "left_ear",
  "right_ear",
  "left_shoulder",
  "right_shoulder",
  "left_elbow",
  "right_elbow",
  "left_wrist",
  "right_wrist",
  "left_hip",
  "right_hip",
  "left_knee",
  "right_knee",
  "left_ankle",
  "right_ankle",
];

async function loadDetector(): Promise<poseDetection.PoseDetector> {
  if (detector) {
    return detector;
  }

  try {
    await tf.setBackend("webgl");
  } catch (error) {
    await tf.setBackend("cpu");
  }
  await tf.ready();

  const modelUrl = new URL("/models/movenet/model.json", ctx.location.origin).toString();

  detector = await poseDetection.createDetector(
    poseDetection.SupportedModels.MoveNet,
    {
      modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER,
      modelUrl,
      enableSmoothing: false,
    }
  );

  isReady = true;
  return detector;
}

ctx.onmessage = async (event: MessageEvent) => {
  const data = event.data as { type: string; imageData?: ImageData };

  if (data.type !== "frame" || !data.imageData) {
    return;
  }

  try {
    const activeDetector = await loadDetector();
    const poses = await activeDetector.estimatePoses(data.imageData, {
      flipHorizontal: true,
    });
    const keypoints = poses[0]?.keypoints ?? [];

    ctx.postMessage({
      type: "pose",
      keypoints: keypoints.map((point, index) => ({
        name: point.name ?? KEYPOINT_NAMES[index] ?? "",
        x: point.x,
        y: point.y,
        score: point.score ?? 0,
      })),
      timestamp: performance.now(),
      ready: isReady,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pose worker failed.";
    ctx.postMessage({ type: "error", message });
  }
};
