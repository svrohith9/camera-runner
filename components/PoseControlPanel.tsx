"use client";

import type React from "react";
import { useMemo } from "react";
import { usePoseStore } from "../store/poseStore";
import { useDiagnosticStore } from "../store/diagnosticStore";

export type PoseControlPanelProps = {
  useCamera: boolean;
  onToggleCamera: () => void;
  pumpActive: boolean;
  jumpActive: boolean;
  previewVideoRef: React.RefObject<HTMLVideoElement>;
  previewCanvasRef: React.RefObject<HTMLCanvasElement>;
};

export default function PoseControlPanel({
  useCamera,
  onToggleCamera,
  pumpActive,
  jumpActive,
  previewVideoRef,
  previewCanvasRef,
}: PoseControlPanelProps) {
  const cameraStatus = useDiagnosticStore((state) => state.cameraStatus);
  const lastPoseTimestamp = usePoseStore((state) => state.lastPoseTimestamp);
  const isPoseStale = usePoseStore((state) => state.isPoseStale);
  const keypointsCount = usePoseStore((state) => state.keypoints.length);
  const gestureMode = usePoseStore((state) => state.gestureMode);
  const setGestureMode = usePoseStore((state) => state.setGestureMode);

  const secondsSincePose = useMemo(() => {
    if (!lastPoseTimestamp) {
      return 0;
    }
    return Math.max(0, (performance.now() - lastPoseTimestamp) / 1000);
  }, [lastPoseTimestamp]);

  return (
    <div className="w-full px-6 pb-8 pt-4">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 rounded-[28px] bg-[#f7f1e8] p-6 text-slate-800 shadow-[0_18px_40px_rgba(15,23,42,0.2)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.35em] text-slate-500">
              Pose Control
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-900">
              Pulse Dash Moves
            </div>
          </div>
          <button
            onClick={onToggleCamera}
            className={`rounded-full px-5 py-2 text-xs uppercase tracking-[0.3em] transition ${
              useCamera
                ? "bg-emerald-500 text-white shadow-[0_8px_16px_rgba(16,185,129,0.35)]"
                : "bg-slate-200 text-slate-600"
            }`}
          >
            {useCamera ? "Disable" : "Enable"}
          </button>
        </div>

        <div className="grid gap-5 md:grid-cols-[220px_1fr]">
          <div className="relative h-[150px] w-full overflow-hidden rounded-2xl bg-slate-900">
            <video
              ref={previewVideoRef}
              className="absolute inset-0 h-full w-full object-cover opacity-90"
              autoPlay
              playsInline
              muted
            />
            <canvas
              ref={previewCanvasRef}
              className="pointer-events-none absolute inset-0 h-full w-full opacity-80"
            />
          </div>

          <div className="flex flex-col justify-between gap-4">
            <p className="text-sm leading-relaxed text-slate-600">
              Pump your arms to move right. Raise both hands above your shoulders
              to hop. Wave both hands side-to-side after a crash to restart.
            </p>
            <div className="flex flex-wrap gap-2">
              <span
                className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.2em] ${
                  pumpActive
                    ? "border-emerald-300 bg-emerald-100 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-500"
                }`}
              >
                Arm Pump
              </span>
              <span
                className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.2em] ${
                  jumpActive
                    ? "border-emerald-300 bg-emerald-100 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-500"
                }`}
              >
                Jump
              </span>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.2em]">
              {(["accuracy", "balanced", "responsive"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setGestureMode(mode)}
                  className={`rounded-full border px-3 py-1 ${
                    gestureMode === mode
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-500"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-slate-500">
              <span>Camera: {cameraStatus}</span>
              <span>Pose: {isPoseStale ? "lost" : "detected"}</span>
              <span>Last seen: {secondsSincePose.toFixed(1)}s</span>
              <span>Keypoints: {keypointsCount}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
