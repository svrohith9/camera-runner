"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PoseKeypoint } from "../lib/pose";
import {
  getShoulderKeypoint,
  getWristKeypoint,
  normalizeY,
  smoothKeypoints,
} from "../lib/pose";
import { useGameStore } from "../lib/store";

type WorkerPoseMessage = {
  type: "pose";
  keypoints: PoseKeypoint[];
  timestamp: number;
};

type WorkerErrorMessage = {
  type: "error";
  message: string;
};

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
  fps: number;
  wrist: PoseKeypoint | null;
  wristNormalizedY: number;
  wristVelocityX: number;
  videoRef: React.RefObject<HTMLVideoElement>;
  overlayRef: React.RefObject<HTMLCanvasElement>;
  resolution: { width: number; height: number };
};

export function usePose(options: UsePoseOptions = {}): PoseResult {
  const { enabled = true, onError } = options;
  const isE2E = useMemo(() => process.env.NEXT_PUBLIC_E2E === "1", []);
  const setKeypoints = useGameStore((state) => state.setKeypoints);
  const [keypoints, setLocalKeypoints] = useState<PoseKeypoint[]>([]);
  const [hasPose, setHasPose] = useState(false);
  const [fps, setFps] = useState(0);
  const [resolution, setResolution] = useState({ width: 640, height: 360 });
  const [isModelReady, setIsModelReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const captureRef = useRef<HTMLCanvasElement | null>(null);
  const lastKeypointsRef = useRef<PoseKeypoint[] | null>(null);
  const lastSentRef = useRef(0);
  const lastFpsUpdateRef = useRef(0);
  const frameCounterRef = useRef(0);
  const wristPrevRef = useRef<PoseKeypoint | null>(null);
  const wristVelocityRef = useRef(0);
  const wristTimeRef = useRef<number | null>(null);
  const lowResAppliedRef = useRef(false);
  const lastErrorRef = useRef<string | null>(null);

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
    if (!enabled) {
      return;
    }

    if (isE2E) {
      return;
    }

    const worker = new Worker(new URL("../workers/pose.worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<WorkerPoseMessage | WorkerErrorMessage>) => {
      if (event.data.type === "pose") {
        if (!isModelReady) {
          setIsModelReady(true);
        }
        const smoothed = smoothKeypoints(lastKeypointsRef.current, event.data.keypoints);
        lastKeypointsRef.current = smoothed;
        setKeypoints(smoothed);
        setLocalKeypoints(smoothed);
        setHasPose(smoothed.some((point) => point.score > 0.05));
      } else if (event.data.type === "error") {
        reportError(event.data.message);
      }
    };

    worker.onerror = (event) => {
      reportError(event.message);
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [enabled, reportError, setKeypoints]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (isE2E) {
      return;
    }

    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: resolution.width,
            height: resolution.height,
          },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (error) {
        reportError("Camera permissions denied or unavailable.");
      }
    };

    init();

    return () => {
      const stream = videoRef.current?.srcObject;
      if (stream instanceof MediaStream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [enabled, reportError, resolution.height, resolution.width]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (isE2E) {
      return;
    }

    let raf = 0;

    const loop = (time: number) => {
      const worker = workerRef.current;
      const video = videoRef.current;
      if (!worker || !video) {
        raf = requestAnimationFrame(loop);
        return;
      }

      if (!captureRef.current) {
        captureRef.current = document.createElement("canvas");
      }

      const canvas = captureRef.current;
      canvas.width = resolution.width;
      canvas.height = resolution.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) {
        raf = requestAnimationFrame(loop);
        return;
      }

      if (time - lastSentRef.current > 33 && video.readyState >= 2) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        worker.postMessage({
          type: "frame",
          imageData,
        });
        lastSentRef.current = time;
      }

      frameCounterRef.current += 1;
      if (time - lastFpsUpdateRef.current > 1000) {
        const nextFps = Math.round(
          (frameCounterRef.current * 1000) / (time - lastFpsUpdateRef.current)
        );
        setFps(nextFps);
        frameCounterRef.current = 0;
        lastFpsUpdateRef.current = time;

        if (nextFps < 55 && !lowResAppliedRef.current) {
          lowResAppliedRef.current = true;
          setResolution({ width: 320, height: 180 });
        }
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
    };
  }, [enabled, resolution.height, resolution.width]);

  useEffect(() => {
    if (!enabled || !isE2E) {
      return;
    }

    window.__setMockPose = (nextKeypoints: PoseKeypoint[]) => {
      setKeypoints(nextKeypoints);
      setLocalKeypoints(nextKeypoints);
      setHasPose(nextKeypoints.some((point) => point.score > 0.2));
    };

    return () => {
      window.__setMockPose = undefined;
    };
  }, [enabled, isE2E, setKeypoints]);

  const wrist = getWristKeypoint(keypoints);
  const wristScore = wrist?.score ?? 0;
  const hasWrist = wristScore > 0.05;
  const shoulder = getShoulderKeypoint(keypoints);
  const wristNormalizedY = wrist
    ? normalizeY(wrist.y, resolution.height)
    : 0;
  const shoulderNormalizedY = shoulder
    ? normalizeY(shoulder.y, resolution.height)
    : 0;

  useEffect(() => {
    if (!wrist) {
      return;
    }

    const now = performance.now();
    const prev = wristPrevRef.current;
    const prevTime = wristTimeRef.current;
    if (prev && prevTime !== null) {
      const dx = wrist.x - prev.x;
      const dt = (now - prevTime) / 1000;
      if (dt > 0) {
        wristVelocityRef.current = Math.abs(dx / dt);
      }
    }
    wristPrevRef.current = wrist;
    wristTimeRef.current = now;
  }, [wrist]);

  return {
    keypoints,
    hasPose,
    hasWrist,
    wristScore,
    shoulderNormalizedY,
    isModelReady,
    fps,
    wrist,
    wristNormalizedY,
    wristVelocityX: wristVelocityRef.current,
    videoRef,
    overlayRef,
    resolution,
  };
}

declare global {
  interface Window {
    __setMockPose?: (keypoints: PoseKeypoint[]) => void;
  }
}
