"use client";

import { motion, useReducedMotion } from "motion/react";
import type { HeartRegion } from "@/types/database";
import { HeartIllustration } from "./heart-illustration";

interface HeartHeroProps {
  highlightedRegion?: HeartRegion | null;
  className?: string;
}

export function HeartHero({ highlightedRegion, className }: HeartHeroProps) {
  const shouldReduceMotion = useReducedMotion();
  const pulseScale = shouldReduceMotion ? [1, 1, 1] : [1, 1.015, 1];
  const glowOpacity = shouldReduceMotion ? [0.25, 0.25, 0.25] : [0.15, 0.35, 0.15];

  return (
    <div className={`relative aspect-[5/6] ${className ?? ""}`}>
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: "radial-gradient(circle, var(--primary) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
        animate={{ opacity: glowOpacity }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        animate={{ scale: pulseScale }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <HeartIllustration highlightedRegion={highlightedRegion} className="relative h-full w-full" />
      </motion.div>
    </div>
  );
}
