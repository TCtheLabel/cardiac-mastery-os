"use client";

import { useId } from "react";
import type { HeartRegion } from "@/types/database";
import { BASE_HEART_PATH, HEART_VIEWBOX, PERICARDIUM_PATH, REGION_SHAPES } from "./heart-region-paths";

interface HeartIllustrationProps {
  highlightedRegion?: HeartRegion | null;
  className?: string;
}

const ACCENT_COLOR = "var(--primary)";
const STROKE_REGION_COLOR = "var(--steel)";
const VALVE_COLOR = "var(--bone)";
const HIGHLIGHT_COLOR = "var(--primary)";
const BASE_HEART_COLOR = "var(--claret)";

export function HeartIllustration({ highlightedRegion, className }: HeartIllustrationProps) {
  const clipId = useId();
  const regionEntries = Object.entries(REGION_SHAPES) as [HeartRegion, (typeof REGION_SHAPES)[HeartRegion]][];
  const isOuterOutlineHighlighted = highlightedRegion === "whole_heart" || highlightedRegion === "pericardium";
  const isBaseHighlighted = highlightedRegion === "whole_heart";

  const clippedZones = regionEntries.filter(([, shape]) => shape.clipToHeart);
  const accents = regionEntries.filter(
    ([key, shape]) => !shape.clipToHeart && key !== "pericardium" && key !== "whole_heart"
  );

  return (
    <svg viewBox={HEART_VIEWBOX} className={className} role="img" aria-label="Stylized heart illustration">
      <defs>
        <clipPath id={clipId}>
          <path d={BASE_HEART_PATH} />
        </clipPath>
      </defs>

      <path
        d={BASE_HEART_PATH}
        fill={isBaseHighlighted ? HIGHLIGHT_COLOR : BASE_HEART_COLOR}
        style={{
          transition: "fill 0.6s ease",
          filter: isBaseHighlighted ? "drop-shadow(0 0 16px var(--primary))" : "none",
        }}
      />

      <path
        d={PERICARDIUM_PATH}
        fill="none"
        stroke={isOuterOutlineHighlighted ? HIGHLIGHT_COLOR : STROKE_REGION_COLOR}
        strokeWidth={isOuterOutlineHighlighted ? 3 : 1.5}
        opacity={isOuterOutlineHighlighted ? 0.9 : 0.4}
        style={{ transition: "stroke 0.6s ease, opacity 0.6s ease, stroke-width 0.6s ease" }}
      />

      <g clipPath={`url(#${clipId})`}>
        {clippedZones.map(([key, shape]) => {
          const isHighlighted = highlightedRegion === key;
          return (
            <g key={key} data-region={key}>
              {shape.paths.map((d, i) => (
                <path
                  key={i}
                  d={d}
                  fill={HIGHLIGHT_COLOR}
                  opacity={isHighlighted ? 1 : 0}
                  style={{
                    transition: "opacity 0.6s ease",
                    filter: isHighlighted ? "drop-shadow(0 0 10px var(--primary))" : "none",
                  }}
                />
              ))}
            </g>
          );
        })}
      </g>

      {accents.map(([key, shape]) => {
        const isHighlighted = highlightedRegion === key;
        const isValve = key === "aortic_valve" || key === "mitral_valve" || key === "right_sided_valves";

        return (
          <g key={key} data-region={key}>
            {shape.paths.map((d, i) => (
              <path
                key={i}
                d={d}
                fill={shape.strokeOnly ? "none" : isHighlighted ? HIGHLIGHT_COLOR : isValve ? VALVE_COLOR : ACCENT_COLOR}
                stroke={shape.strokeOnly ? (isHighlighted ? HIGHLIGHT_COLOR : ACCENT_COLOR) : "var(--oxidized-blood)"}
                strokeWidth={shape.strokeOnly ? (isHighlighted ? 4 : 2.5) : 1}
                strokeOpacity={shape.strokeOnly ? (isHighlighted ? 0.95 : 0.55) : 1}
                style={{
                  transition: "fill 0.6s ease, stroke 0.6s ease, stroke-width 0.6s ease, stroke-opacity 0.6s ease",
                  filter: isHighlighted ? "drop-shadow(0 0 10px var(--primary))" : "none",
                }}
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
