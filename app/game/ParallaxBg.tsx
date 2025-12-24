"use client";

import { motion, useTransform, type MotionValue } from "framer-motion";

export type ParallaxBgProps = {
  worldX: MotionValue<number>;
};

export default function ParallaxBg({ worldX }: ParallaxBgProps) {
  const layerOne = useTransform(worldX, (value) => `translateX(${-value * 0.2}px)`);
  const layerTwo = useTransform(worldX, (value) => `translateX(${-value * 0.5}px)`);
  const layerThree = useTransform(worldX, (value) => `translateX(${-value * 0.8}px)`);

  return (
    <div className="absolute inset-0 overflow-hidden">
      <motion.div
        style={{ transform: layerOne }}
        className="absolute inset-0 opacity-40"
      >
        <div className="h-full w-[120%] bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.25),transparent_60%)]" />
      </motion.div>
      <motion.div
        style={{ transform: layerTwo }}
        className="absolute inset-0 opacity-70"
      >
        <div className="h-full w-[140%] bg-[linear-gradient(120deg,rgba(59,130,246,0.15),transparent_55%)]" />
      </motion.div>
      <motion.div
        style={{ transform: layerThree }}
        className="absolute inset-0"
      >
        <div className="h-full w-[160%] bg-[radial-gradient(circle_at_80%_40%,rgba(217,70,239,0.2),transparent_55%)]" />
      </motion.div>
    </div>
  );
}
