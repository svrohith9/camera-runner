"use client";

import { cx } from "../../lib/utils";

export type ObstacleVariant = "low" | "high";

export type ObstacleProps = {
  x: number;
  y: number;
  height: number;
  variant: ObstacleVariant;
};

export default function Obstacle({ x, y, height, variant }: ObstacleProps) {
  return (
    <div
      className={cx(
        "absolute bottom-12 w-12 rounded-md bg-black/90 shadow-[0_0_12px_rgba(0,0,0,0.7)]",
        variant === "high" ? "border border-slate-700" : "border border-slate-800"
      )}
      style={{
        transform: `translate(${x}px, ${-y}px)`,
        height,
      }}
    />
  );
}
