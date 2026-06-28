"use client";

import { motion } from "motion/react";
import type { HeartRegion } from "@/types/database";
import { HeartIllustration } from "./heart-illustration";

interface HeartHeroProps {
  highlightedRegion?: HeartRegion | null;
  className?: string;
}

export function HeartHero({ highlightedRegion, className }: HeartHeroProps) {
  return (
    <div className={`relative ${className ?? ""}`}>
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: "radial-gradient(circle, var(--primary) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
        animate={{ opacity: [0.15, 0.35, 0.15] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        animate={{ scale: [1, 1.015, 1] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <HeartIllustration highlightedRegion={highlightedRegion} className="relative h-full w-full" />
      </motion.div>
    </div>
  );
}
