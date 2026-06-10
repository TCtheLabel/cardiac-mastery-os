import { NextResponse } from "next/server";
import { listMasteryTopics } from "@/services/db/mastery";

export async function GET() {
  const topics = await listMasteryTopics();
  return NextResponse.json(topics);
}
