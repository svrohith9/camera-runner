"use client";

import { useEffect } from "react";
import { useGameStore } from "../../lib/store";
import type { PoseKeypoint } from "../../lib/pose";

const SKELETON_EDGES: Array<[string, string]> = [
  ["left_shoulder", "right_shoulder"],
  ["left_shoulder", "left_elbow"],
  ["left_elbow", "left_wrist"],
  ["right_shoulder", "right_elbow"],
  ["right_elbow", "right_wrist"],
  ["left_shoulder", "left_hip"],
  ["right_shoulder", "right_hip"],
  ["left_hip", "right_hip"],
  ["left_hip", "left_knee"],
  ["left_knee", "left_ankle"],
  ["right_hip", "right_knee"],
  ["right_knee", "right_ankle"],
];

export type HudProps = {
  fps: number;
  keypoints: PoseKeypoint[];
  videoRef: React.RefObject<HTMLVideoElement>;
  overlayRef: React.RefObject<HTMLCanvasElement>;
};

export default function Hud({ fps, keypoints, videoRef, overlayRef }: HudProps) {
  const score = useGameStore((state) => state.score);
  const combo = useGameStore((state) => state.combo);

  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const draw = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      const rawVideoWidth = videoRef.current?.videoWidth ?? 0;
      const rawVideoHeight = videoRef.current?.videoHeight ?? 0;
      const videoWidth = rawVideoWidth > 0 ? rawVideoWidth : canvas.width;
      const videoHeight = rawVideoHeight > 0 ? rawVideoHeight : canvas.height;
      const scaleX = canvas.width / videoWidth;
      const scaleY = canvas.height / videoHeight;
      const lookup = new Map(keypoints.map((point) => [point.name, point]));

      for (const [from, to] of SKELETON_EDGES) {
        const start = lookup.get(from);
        const end = lookup.get(to);
        if (!start || !end) {
          continue;
        }

        const confidence = Math.min(start.score, end.score);
        context.strokeStyle = `hsl(${confidence * 120}, 100%, 50%)`;
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(start.x * scaleX, start.y * scaleY);
        context.lineTo(end.x * scaleX, end.y * scaleY);
        context.stroke();
      }

      for (const point of keypoints) {
        context.fillStyle = `hsl(${point.score * 120}, 100%, 50%)`;
        context.beginPath();
        context.arc(point.x * scaleX, point.y * scaleY, 3, 0, Math.PI * 2);
        context.fill();
      }
    };

    draw();
  }, [keypoints, overlayRef, videoRef]);

  return (
    <div className="absolute inset-x-0 top-0 flex items-start justify-between p-6">
      <div className="rounded-xl bg-glass px-4 py-2 text-sm text-cyan-200 shadow-neon">
        <div className="font-mono text-lg">{fps} fps</div>
        <div className="text-xs text-slate-400">auto-adjusting</div>
      </div>

      <div className="flex flex-col items-end gap-3">
        <div className="rounded-xl bg-glass px-4 py-2">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Score</div>
          <div className="font-mono text-2xl text-cyan-300">
            {Math.floor(score)}
          </div>
          <div className="text-xs text-slate-400">
            Combo x{combo.toFixed(1)}
          </div>
        </div>

        <div className="relative">
          <video
            ref={videoRef}
            className="h-[108px] w-[192px] rounded-lg border border-slate-600/50 object-cover opacity-90"
            autoPlay
            playsInline
            muted
          />
          <canvas
            ref={overlayRef}
            width={192}
            height={108}
            className="pointer-events-none absolute inset-0 h-[108px] w-[192px] opacity-30"
          />
        </div>
      </div>
    </div>
  );
}
