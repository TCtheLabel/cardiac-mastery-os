import { getOpenAIClient } from "@/lib/openai/client";
import type { HeartRegion } from "@/types/database";

const HEART_REGIONS: HeartRegion[] = [
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

const SYSTEM_PROMPT = `You are classifying a cardiac surgery training topic into the single anatomical region of the heart it is most associated with.

Given a topic title, choose exactly one region from this fixed list:
- aortic_valve: aortic valve disease, repair, replacement
- mitral_valve: mitral valve disease, repair, replacement
- right_sided_valves: tricuspid or pulmonic valve disease, repair, replacement
- left_ventricle: left ventricular structure, function, or pathology
- right_ventricle: right ventricular structure, function, or pathology
- atria: left or right atrial structure, function, or pathology (including arrhythmia topics)
- coronary_arteries: coronary artery disease, bypass grafting, ischemia
- aortic_root_great_vessels: aortic root, ascending/descending aorta, arch, great vessels
- pericardium: pericardial disease, tamponade, effusion
- whole_heart: anything that doesn't pin to one specific structure above — systemic/procedural topics like ECMO, transplant, LVAD, oncology, general principles, or topics spanning multiple structures

Choose "whole_heart" rather than forcing an inaccurate specific match.`;

export async function classifyTopicRegion(topic: string): Promise<HeartRegion> {
  const client = getOpenAIClient();

  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Topic: ${topic}` },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "topic_region",
        strict: true,
        schema: {
          type: "object",
          properties: {
            region: { type: "string", enum: HEART_REGIONS },
          },
          required: ["region"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = completion.choices[0]?.message?.content;

  if (!content) {
    throw new Error("OpenAI returned an empty response for classifyTopicRegion");
  }

  return (JSON.parse(content) as { region: HeartRegion }).region;
}
