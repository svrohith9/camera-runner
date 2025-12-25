"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PoseKeypoint } from "../lib/pose";
import {
  getShoulderKeypoint,
  getWristKeypoint,
  normalizeY,
  smoothKeypoints,
} from "../lib/pose";
import { KalmanFilter1D } from "../lib/kalmanFilter1D";
import { usePoseStore } from "../store/poseStore";
import { useDiagnosticStore } from "../store/diagnosticStore";
import { useCamera } from "./useCamera";
import { useMounted } from "./useMounted";
import { usePoseDebugger } from "./usePoseDebugger";
import { drawSkeleton } from "../lib/renderUtils";
import {
  createPumpState,
  getGestureTuning,
  updatePumpState,
} from "../lib/gesture";
import type { DetectionMode } from "../lib/detection/HybridGestureDetector";
import { HybridGestureDetector } from "../lib/detection/HybridGestureDetector";

type UsePoseOptions = {
  enabled?: boolean;
  onError?: (message: string) => void;
};

type PoseResult = {
  keypoints: PoseKeypoint[];
  hasPose: boolean;
  hasWrist: boolean;
  wristScore: number;
  shoulderNormalizedY: number;
  isModelReady: boolean;
  cameraStatus: "idle" | "ready" | "denied" | "loading";
  fps: number;
  wrist: PoseKeypoint | null;
  wristFiltered: { x: number; y: number } | null;
  wristFilteredNormalizedY: number;
  wristNormalizedY: number;
  videoRef: React.RefObject<HTMLVideoElement>;
  previewVideoRef: React.RefObject<HTMLVideoElement>;
  previewCanvasRef: React.RefObject<HTMLCanvasElement>;
  pumpActive: boolean;
  jumpActive: boolean;
  pumpSpeedMultiplier: number;
};

const DEBUG_MODE = process.env.NEXT_PUBLIC_DEBUG_MODE === "true";

export function usePose(options: UsePoseOptions = {}): PoseResult {
  const { enabled = true, onError } = options;
  const isE2E = useMemo(() => process.env.NEXT_PUBLIC_E2E === "1", []);
  const { status: cameraStatus, stream, getCameraStream } = useCamera();
  const mountedRef = useMounted();

  const setKeypoints = usePoseStore((state) => state.setKeypoints);
  const setPoseStale = usePoseStore((state) => state.setPoseStale);
  const lastPoseTimestamp = usePoseStore((state) => state.lastPoseTimestamp);
  const cameraEnabled = usePoseStore((state) => state.useCamera);
  const gestureMode = usePoseStore((state) => state.gestureMode);
  const setCameraStatus = useDiagnosticStore((state) => state.setCameraStatus);
  const setFpsDiagnostic = useDiagnosticStore((state) => state.setFps);

  const [keypoints, setLocalKeypoints] = useState<PoseKeypoint[]>([]);
  const [hasPose, setHasPose] = useState(false);
  const [fps, setFps] = useState(0);
  const [isModelReady, setIsModelReady] = useState(false);
  const [pumpActive, setPumpActive] = useState(false);
  const [jumpActive, setJumpActive] = useState(false);
  const [pumpSpeedMultiplier, setPumpSpeedMultiplier] = useState(1);

  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const keypointsRef = useRef<PoseKeypoint[]>([]);
  const lastSmoothedRef = useRef<PoseKeypoint[] | null>(null);
  const detectorRef = useRef<HybridGestureDetector | null>(null);
  const lastDetectionRef = useRef(0);
  const frameIntervalRef = useRef(16);
  const frameCounterRef = useRef(0);
  const lastFpsUpdateRef = useRef(0);
  const inFlightRef = useRef(false);
  const lastErrorRef = useRef<string | null>(null);
  const kalmanXRef = useRef<KalmanFilter1D | null>(null);
  const kalmanYRef = useRef<KalmanFilter1D | null>(null);
  const preflightStartedRef = useRef(false);
  const pumpStateRef = useRef(createPumpState(0));
  const lastJumpTimeRef = useRef(0);

  const isEnabled = enabled && cameraEnabled;

  const reportError = useCallback(
    (message: string) => {
      if (lastErrorRef.current === message) {
        return;
      }
      lastErrorRef.current = message;
      console.error("[GameError]", message);
      onError?.(message);
    },
    [onError]
  );

  useEffect(() => {
    if (!isEnabled || isE2E) {
      return;
    }
    if (preflightStartedRef.current) {
      return;
    }
    preflightStartedRef.current = true;

    void getCameraStream();
  }, [getCameraStream, isE2E, isEnabled]);

  useEffect(() => {
    if (!isEnabled || isE2E) {
      return;
    }
    if (cameraStatus === "idle" && !stream) {
      void getCameraStream();
    }
  }, [cameraStatus, getCameraStream, isE2E, isEnabled, stream]);

  useEffect(() => {
    if (!stream || !videoRef.current) {
      return;
    }

    videoRef.current.srcObject = stream;
    void videoRef.current.play().catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      reportError(error instanceof Error ? error.message : "Video play failed.");
    });
  }, [reportError, stream]);

  useEffect(() => {
    if (!isEnabled) {
      return;
    }
    setCameraStatus(cameraStatus);
  }, [cameraStatus, isEnabled, setCameraStatus]);

  useEffect(() => {
    if (!isEnabled || isE2E) {
      return;
    }

    let cancelled = false;
    if (!detectorRef.current) {
      detectorRef.current = new HybridGestureDetector();
    }

    detectorRef.current.updateMode(gestureMode as DetectionMode);
    detectorRef.current
      .initialize()
      .then(() => {
        if (!mountedRef.current || cancelled) {
          return;
        }
        setIsModelReady(true);
      })
      .catch((error) => {
        reportError(error instanceof Error ? error.message : "Detector init failed.");
      });

    return () => {
      cancelled = true;
    };
  }, [gestureMode, isE2E, isEnabled, mountedRef, reportError]);

  useEffect(() => {
    if (!isEnabled || isE2E) {
      return;
    }

    let raf = 0;
    const loop = async (time: number) => {
      const detector = detectorRef.current;
      const video = videoRef.current;
      if (!detector || !video || video.readyState < 2) {
        raf = requestAnimationFrame(loop);
        return;
      }

      if (
        inFlightRef.current ||
        time - lastDetectionRef.current < frameIntervalRef.current
      ) {
        raf = requestAnimationFrame(loop);
        return;
      }

      inFlightRef.current = true;
      lastDetectionRef.current = time;

      try {
        const result = await detector.detect(video);
        if (!mountedRef.current) {
          return;
        }
        const smoothed = smoothKeypoints(
          lastSmoothedRef.current,
          result.keypoints
        );
        lastSmoothedRef.current = smoothed;
        setKeypoints(smoothed, time);
        setLocalKeypoints(smoothed);
        setHasPose(result.maxScore > 0.1);
      } catch (error) {
        reportError(error instanceof Error ? error.message : "Pose detection failed.");
      } finally {
        inFlightRef.current = false;
      }

      frameCounterRef.current += 1;
      if (time - lastFpsUpdateRef.current > 1000) {
        const nextFps = Math.round(
          (frameCounterRef.current * 1000) / (time - lastFpsUpdateRef.current)
        );
        setFps(nextFps);
        setFpsDiagnostic(nextFps);
        frameIntervalRef.current = nextFps < 45 ? 22 : 16;
        frameCounterRef.current = 0;
        lastFpsUpdateRef.current = time;
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
    };
  }, [isE2E, isEnabled, reportError, setFpsDiagnostic]);

  useEffect(() => {
    if (!isEnabled || !isE2E) {
      return;
    }

    window.__setMockPose = (nextKeypoints: PoseKeypoint[]) => {
      setKeypoints(nextKeypoints, performance.now());
      setLocalKeypoints(nextKeypoints);
      setHasPose(nextKeypoints.some((point) => point.score > 0.05));
      setIsModelReady(true);
    };

    return () => {
      window.__setMockPose = undefined;
    };
  }, [isE2E, isEnabled, setKeypoints]);

  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    const interval = window.setInterval(() => {
      if (!lastPoseTimestamp) {
        return;
      }
      const stale = performance.now() - lastPoseTimestamp > 1000;
      setPoseStale(stale);
    }, 500);

    return () => window.clearInterval(interval);
  }, [isEnabled, lastPoseTimestamp, setPoseStale]);

  useEffect(() => {
    if (isEnabled) {
      return;
    }
    preflightStartedRef.current = false;
    detectorRef.current = null;
    lastSmoothedRef.current = null;
    setIsModelReady(false);
    setHasPose(false);
    setPumpActive(false);
    setJumpActive(false);
    setPumpSpeedMultiplier(1);
  }, [isEnabled]);

  usePoseDebugger(keypoints, keypoints[0]?.y ?? 0, DEBUG_MODE);

  useEffect(() => {
    keypointsRef.current = keypoints;
  }, [keypoints]);

  const wrist = getWristKeypoint(keypoints);
  const wristScore = wrist?.score ?? 0;
  const hasWrist = wristScore > 0.05;
  const shoulder = getShoulderKeypoint(keypoints);
  const wristNormalizedY = wrist
    ? normalizeY(wrist.y, videoRef.current?.videoHeight || 1)
    : 0;
  const shoulderNormalizedY = shoulder
    ? normalizeY(shoulder.y, videoRef.current?.videoHeight || 1)
    : 0;

  useEffect(() => {
    if (!wrist) {
      return;
    }

    if (!kalmanXRef.current) {
      kalmanXRef.current = new KalmanFilter1D(wrist.x, {
        processNoise: 2,
        measurementNoise: 10,
        estimatedError: 1,
      });
    }

    if (!kalmanYRef.current) {
      kalmanYRef.current = new KalmanFilter1D(wrist.y, {
        processNoise: 2,
        measurementNoise: 10,
        estimatedError: 1,
      });
    }
  }, [wrist]);

  const wristFiltered = wrist
    ? {
        x: kalmanXRef.current?.update(wrist.x) ?? wrist.x,
        y: kalmanYRef.current?.update(wrist.y) ?? wrist.y,
      }
    : null;

  const wristFilteredNormalizedY = wristFiltered
    ? normalizeY(wristFiltered.y, videoRef.current?.videoHeight || 1)
    : 0;

  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    const leftWrist = keypoints.find((point) => point.name === "left_wrist");
    const rightWrist = keypoints.find((point) => point.name === "right_wrist");
    const leftShoulder = keypoints.find(
      (point) => point.name === "left_shoulder"
    );
    const rightShoulder = keypoints.find(
      (point) => point.name === "right_shoulder"
    );
    const hasWrists =
      (leftWrist?.score ?? 0) > 0.05 && (rightWrist?.score ?? 0) > 0.05;
    const hasShoulders =
      (leftShoulder?.score ?? 0) > 0.05 && (rightShoulder?.score ?? 0) > 0.05;
    const videoHeight = videoRef.current?.videoHeight || 1;
    const timestamp = lastPoseTimestamp || performance.now();
    const tuning = getGestureTuning(gestureMode);

    const pumpResult = updatePumpState(pumpStateRef.current, {
      leftWristY: normalizeY(leftWrist?.y ?? 0, videoHeight),
      rightWristY: normalizeY(rightWrist?.y ?? 0, videoHeight),
      hasPose,
      hasWrists,
      timestamp,
      tuning,
    });
    pumpStateRef.current = pumpResult.state;
    setPumpActive(pumpResult.pumpActive);
    setPumpSpeedMultiplier(pumpResult.speedMultiplier);

    const shoulderMargin = (videoHeight || 1) * tuning.jumpShoulderMargin;
    const bothHandsUp =
      hasWrists &&
      hasShoulders &&
      (leftWrist?.y ?? 0) < (leftShoulder?.y ?? 0) - shoulderMargin &&
      (rightWrist?.y ?? 0) < (rightShoulder?.y ?? 0) - shoulderMargin;
    const fallbackHandsUp =
      hasWrists &&
      !hasShoulders &&
      normalizeY(leftWrist?.y ?? 0, videoHeight) < tuning.jumpFallbackThreshold &&
      normalizeY(rightWrist?.y ?? 0, videoHeight) < tuning.jumpFallbackThreshold;
    const now = timestamp;
    const jumpCooldownMs = 650;
    const canJump = now - lastJumpTimeRef.current > jumpCooldownMs;
    const nextJumpActive = (bothHandsUp || fallbackHandsUp) && canJump;

    if (nextJumpActive) {
      lastJumpTimeRef.current = now;
    }

    setJumpActive(nextJumpActive);
  }, [gestureMode, hasPose, isEnabled, keypoints, lastPoseTimestamp]);

  useEffect(() => {
    if (!stream || !previewVideoRef.current) {
      return;
    }

    previewVideoRef.current.srcObject = stream;
    void previewVideoRef.current.play().catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      reportError(error instanceof Error ? error.message : "Video play failed.");
    });
  }, [reportError, stream]);

  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    let raf = 0;
    const draw = () => {
      const canvas = previewCanvasRef.current;
      const video = previewVideoRef.current;
      if (!canvas || !video) {
        raf = requestAnimationFrame(draw);
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        raf = requestAnimationFrame(draw);
        return;
      }

      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;
      if (videoWidth > 0 && videoHeight > 0) {
        if (canvas.width !== videoWidth || canvas.height !== videoHeight) {
          canvas.width = videoWidth;
          canvas.height = videoHeight;
        }
        drawSkeleton(keypointsRef.current, ctx, 1, 1);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [isEnabled]);

  return {
    keypoints,
    hasPose,
    hasWrist,
    wristScore,
    shoulderNormalizedY,
    isModelReady,
    cameraStatus,
    fps,
    wrist,
    wristFiltered,
    wristFilteredNormalizedY,
    wristNormalizedY,
    videoRef,
    previewVideoRef,
    previewCanvasRef,
    pumpActive,
    jumpActive,
    pumpSpeedMultiplier,
  };
}

declare global {
  interface Window {
    __setMockPose?: (keypoints: PoseKeypoint[]) => void;
  }
}
