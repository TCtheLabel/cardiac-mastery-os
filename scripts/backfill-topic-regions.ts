import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local" });

import { getSupabaseClient } from "../src/lib/supabase/server";
import { classifyTopicRegion } from "../src/services/ai/classifyTopicRegion";
import type { HeartRegion } from "../src/types/database";

async function main() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("mastery_topics").select("id, topic").is("region", null);

  if (error) throw new Error(`Failed to fetch topics needing backfill: ${error.message}`);
  if (!data || data.length === 0) {
    console.log("No topics need backfilling.");
    return;
  }

  console.log(`Backfilling region for ${data.length} topic(s)...`);

  for (const row of data as { id: string; topic: string }[]) {
    let region: HeartRegion;
    try {
      region = await classifyTopicRegion(row.topic);
    } catch (err) {
      console.error(`Failed to classify topic "${row.topic}": ${(err as Error).message}`);
      continue;
    }
    const { error: updateError } = await supabase.from("mastery_topics").update({ region }).eq("id", row.id);
    if (updateError) {
      console.error(`Failed to update topic "${row.topic}": ${updateError.message}`);
      continue;
    }
    console.log(`  "${row.topic}" -> ${region}`);
  }

  console.log("Backfill complete.");
}

main().catch((error) => {
  console.error("backfill-topic-regions failed:", error);
  process.exit(1);
});
