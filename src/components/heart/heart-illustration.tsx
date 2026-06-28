import type { HeartRegion } from "@/types/database";
import { HEART_VIEWBOX, PERICARDIUM_PATH, REGION_SHAPES } from "./heart-region-paths";

interface HeartIllustrationProps {
  highlightedRegion?: HeartRegion | null;
  className?: string;
}

const FILLED_REGION_COLOR = "var(--claret)";
const STROKE_REGION_COLOR = "var(--steel)";
const VALVE_COLOR = "var(--bone)";
const HIGHLIGHT_COLOR = "var(--primary)";

export function HeartIllustration({ highlightedRegion, className }: HeartIllustrationProps) {
  const regionEntries = Object.entries(REGION_SHAPES) as [HeartRegion, (typeof REGION_SHAPES)[HeartRegion]][];
  const isOuterOutlineHighlighted = highlightedRegion === "whole_heart" || highlightedRegion === "pericardium";

  return (
    <svg viewBox={HEART_VIEWBOX} className={className} role="img" aria-label="Stylized heart illustration">
      <path
        d={PERICARDIUM_PATH}
        fill="none"
        stroke={isOuterOutlineHighlighted ? HIGHLIGHT_COLOR : STROKE_REGION_COLOR}
        strokeWidth={isOuterOutlineHighlighted ? 3 : 1.5}
        opacity={isOuterOutlineHighlighted ? 0.9 : 0.4}
        style={{ transition: "stroke 0.6s ease, opacity 0.6s ease, stroke-width 0.6s ease" }}
      />
      {regionEntries
        .filter(([key]) => key !== "pericardium" && key !== "whole_heart")
        .map(([key, shape]) => {
          const isHighlighted = highlightedRegion === key;
          const isValve = key === "aortic_valve" || key === "mitral_valve" || key === "right_sided_valves";
          const baseColor = isValve ? VALVE_COLOR : FILLED_REGION_COLOR;

          return (
            <g key={key} data-region={key}>
              {shape.paths.map((d, i) => (
                <path
                  key={i}
                  d={d}
                  fill={shape.strokeOnly ? "none" : isHighlighted ? HIGHLIGHT_COLOR : baseColor}
                  stroke={shape.strokeOnly ? (isHighlighted ? HIGHLIGHT_COLOR : "var(--primary)") : "var(--oxidized-blood)"}
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
