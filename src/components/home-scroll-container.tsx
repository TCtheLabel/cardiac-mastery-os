"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import type { HeartRegion } from "@/types/database";
import { HeartHero } from "@/components/heart/heart-hero";

interface HomeScrollContainerProps {
  weakestRegion: HeartRegion;
  recommendedTopic: string;
  children: React.ReactNode;
}

export function HomeScrollContainer({ weakestRegion, recommendedTopic, children }: HomeScrollContainerProps) {
  const heroRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.75]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const heroStyle = shouldReduceMotion ? { scale: 1, opacity: 1 } : { scale: heroScale, opacity: heroOpacity };

  return (
    <div className="space-y-12">
      <div ref={heroRef} className="flex min-h-[70vh] flex-col items-center justify-center gap-8 text-center">
        <motion.div style={heroStyle} className="flex flex-col items-center gap-8">
          <HeartHero highlightedRegion={weakestRegion} className="w-64" />
          <div className="space-y-4">
            <h1 className="font-[family-name:var(--font-fraunces)] text-4xl text-bone">
              Train the judgment of a cardiac surgeon.
            </h1>
            <Link
              href={`/capture?topic=${encodeURIComponent(recommendedTopic)}`}
              className="inline-block rounded-full border border-primary px-6 py-2 text-sm text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              Continue: {recommendedTopic}
            </Link>
          </div>
        </motion.div>
      </div>
      {children}
    </div>
  );
}
