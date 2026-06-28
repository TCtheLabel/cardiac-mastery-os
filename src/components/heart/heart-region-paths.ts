import type { HeartRegion } from "@/types/database";

export const HEART_VIEWBOX = "0 0 400 480";

export const PERICARDIUM_PATH =
  "M200,458 C168,432 108,388 82,332 C58,280 58,222 92,184 C120,152 162,150 188,176 C194,182 198,188 200,194 C202,188 206,182 212,176 C238,150 280,152 308,184 C342,222 342,280 318,332 C292,388 232,432 200,458 Z";

export const BASE_HEART_PATH = PERICARDIUM_PATH;

interface RegionShape {
  paths: string[];
  strokeOnly?: boolean;
  /**
   * When true, this region's shape is invisible at rest and only fades in when
   * highlighted, clipped to BASE_HEART_PATH so it can never poke outside the
   * silhouette. Used for the large chamber zones — at rest, the heart reads as one
   * solid shape; on highlight, a clipped zone lights up. Avoids the failure mode of
   * several independently-bordered chamber blobs competing for the "is this a heart"
   * read at all times.
   */
  clipToHeart?: boolean;
}

export const REGION_SHAPES: Record<HeartRegion, RegionShape> = {
  atria: {
    clipToHeart: true,
    paths: [
      "M188,176 C160,138 115,128 85,152 C58,174 50,212 66,244 C82,276 120,290 152,278 C176,269 192,246 192,218 C192,204 190,190 188,176 Z",
      "M212,176 C240,138 285,128 315,152 C342,174 350,212 334,244 C318,276 280,290 248,278 C224,269 208,246 208,218 C208,204 210,190 212,176 Z",
    ],
  },
  right_ventricle: {
    clipToHeart: true,
    paths: [
      "M170,230 C120,245 85,290 84,338 C83,388 115,432 165,452 C195,464 200,440 192,415 C180,378 172,330 170,280 C169,260 170,244 170,230 Z",
    ],
  },
  left_ventricle: {
    clipToHeart: true,
    paths: [
      "M230,230 C280,245 315,290 316,338 C317,388 285,432 235,452 C205,464 200,440 208,415 C220,378 228,330 230,280 C231,260 230,244 230,230 Z",
    ],
  },
  aortic_root_great_vessels: {
    paths: [
      "M194,176 C193,144 191,108 186,78 C182,56 187,40 202,39 C216,40 222,58 220,82 C218,112 213,146 206,176 C203,187 195,187 194,176 Z",
      "M204,95 C206,78 216,64 232,56 C252,46 276,48 292,62 C300,69 298,79 288,80 C276,81 266,76 254,76 C238,76 226,84 218,98 C212,109 203,107 204,95 Z",
    ],
  },
  coronary_arteries: {
    strokeOnly: true,
    paths: [
      "M199,258 C198,290 197,322 194,358 C191,392 184,420 172,442",
      "M201,258 C202,288 204,318 209,350 C214,384 222,412 200,448",
      "M192,278 C172,288 154,302 140,322",
      "M208,278 C228,288 246,302 262,324",
    ],
  },
  aortic_valve: {
    paths: ["M199,196 L210,207 L199,218 L188,207 Z"],
  },
  mitral_valve: {
    paths: ["M218,234 L231,246 L218,258 L205,246 Z"],
  },
  right_sided_valves: {
    paths: ["M178,234 L191,246 L178,258 L165,246 Z", "M199,160 L210,170 L199,180 L188,170 Z"],
  },
  pericardium: {
    strokeOnly: true,
    paths: [PERICARDIUM_PATH],
  },
  whole_heart: {
    strokeOnly: true,
    paths: [PERICARDIUM_PATH],
  },
};
