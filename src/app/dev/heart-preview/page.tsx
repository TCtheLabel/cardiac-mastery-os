"use client";

import { useState } from "react";
import { HeartHero } from "@/components/heart/heart-hero";
import type { HeartRegion } from "@/types/database";

const REGIONS: HeartRegion[] = [
  "aortic_valve",
  "mitral_valve",
  "right_sided_valves",
  "left_ventricle",
  "right_ventricle",
  "atria",
  "coronary_arteries",
  "aortic_root_great_vessels",
  "pericardium",
  "whole_heart",
];

export default function HeartPreviewPage() {
  const [region, setRegion] = useState<HeartRegion | null>(null);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-medium text-foreground">Heart Preview (dev only)</h1>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setRegion(null)}
          className={`rounded-full border px-3 py-1 text-sm ${region === null ? "border-primary text-primary" : "border-border text-muted-foreground"}`}
        >
          none
        </button>
        {REGIONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRegion(r)}
            className={`rounded-full border px-3 py-1 text-sm ${region === r ? "border-primary text-primary" : "border-border text-muted-foreground"}`}
          >
            {r}
          </button>
        ))}
      </div>
      <HeartHero highlightedRegion={region} className="mx-auto h-[480px] w-[400px]" />
    </div>
  );
}
