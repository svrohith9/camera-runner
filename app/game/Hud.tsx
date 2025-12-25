"use client";

import { useGameStore } from "../../store/gameStore";

export type HudProps = {
  fps: number;
  preferKeyboard: boolean;
  onToggleControls: () => void;
  gestureIndicator: "jump" | "flap" | null;
  jumpReady: boolean;
  trackingOnly: boolean;
  onToggleTracking: () => void;
  status: "Running" | "Paused" | "Stopped" | "Calibrating" | "GameOver";
};

const MAX_LIVES = 3;

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="20"
      height="18"
      viewBox="0 0 24 20"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.6"
      className={filled ? "text-rose-400" : "text-rose-300/40"}
      aria-hidden="true"
    >
      <path d="M12 18s-6.7-4.4-9.6-8C-0.7 6.7 1.3 2 5.2 2c2.2 0 3.7 1.2 4.8 2.7C11.1 3.2 12.6 2 14.8 2c3.9 0 5.9 4.7 2.8 8-2.9 3.6-9.6 8-9.6 8z" />
    </svg>
  );
}

export default function Hud({
  fps,
  preferKeyboard,
  onToggleControls,
  gestureIndicator,
  jumpReady,
  trackingOnly,
  onToggleTracking,
  status,
}: HudProps) {
  const score = useGameStore((state) => state.score);
  const combo = useGameStore((state) => state.combo);
  const lives = useGameStore((state) => state.lives);
  const distance = Math.floor(score);

  return (
    <div className="absolute inset-x-0 top-0 flex items-start justify-between p-6">
      <div className="flex flex-col gap-3">
        <div className="rounded-xl bg-glass px-4 py-2 text-sm text-cyan-200 shadow-neon">
          <div className="font-mono text-lg">{fps} fps</div>
          <div className="text-xs text-slate-400">auto-adjusting</div>
        </div>

        <div className="rounded-2xl bg-[#f7f1e8] px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-600 shadow-[0_14px_32px_rgba(15,23,42,0.2)]">
          Status
          <div className="mt-2 text-sm font-semibold normal-case tracking-normal text-slate-800">
            {status}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-end gap-3">
        <div className="flex items-center gap-2 rounded-2xl bg-[#f7f1e8] px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-600 shadow-[0_14px_32px_rgba(15,23,42,0.2)]">
          <span className="text-[10px]">Lives</span>
          <div className="flex items-center gap-1 text-rose-400">
            {Array.from({ length: MAX_LIVES }).map((_, index) => (
              <HeartIcon key={index} filled={index < lives} />
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-[#f7f1e8] px-4 py-2 shadow-[0_14px_32px_rgba(15,23,42,0.2)]">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Distance
          </div>
          <div className="font-mono text-2xl text-slate-800">{distance}m</div>
        </div>

        <div className="rounded-xl bg-glass px-4 py-2">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Score
          </div>
          <div className="font-mono text-2xl text-cyan-300">
            {Math.floor(score)}
          </div>
          <div className="text-xs text-slate-400">
            Combo x{combo.toFixed(1)}
          </div>
        </div>

        <button
          onClick={onToggleControls}
          className="rounded-full border border-slate-600/50 px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-300 hover:text-cyan-200"
        >
          {preferKeyboard ? "Keyboard" : "Camera"}
        </button>

        <button
          onClick={onToggleTracking}
          className="rounded-full border border-slate-600/50 px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-300 hover:text-cyan-200"
        >
          {trackingOnly ? "Exit Tracking" : "Tracking Mode"}
        </button>

        <div className="flex items-center gap-3 rounded-full bg-glass px-4 py-2 text-xs text-slate-300">
          <span className="text-cyan-300">Indicators</span>
          <span
            className={`text-lg ${gestureIndicator === "jump" || jumpReady ? "text-cyan-300 animate-pulse" : "text-slate-600"}`}
          >
            ↑
          </span>
          <span
            className={`text-lg ${gestureIndicator === "flap" ? "text-fuchsia-400 animate-pulse" : "text-slate-600"}`}
          >
            〰
          </span>
        </div>
      </div>
    </div>
  );
}
