import { getSupabaseClient } from "@/lib/supabase/server";
import type { Citation, NotebookKnowledge } from "@/types/database";

interface NotebookKnowledgeRow {
  id: string;
  domain: string;
  content: string;
  citations: Citation[];
  synced_at: string;
}

function toNotebookKnowledge(row: NotebookKnowledgeRow): NotebookKnowledge {
  return {
    id: row.id,
    domain: row.domain,
    content: row.content,
    citations: row.citations,
    syncedAt: row.synced_at,
  };
}

export async function upsertNotebookKnowledge(
  domain: string,
  content: string,
  citations: Citation[]
): Promise<NotebookKnowledge> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("notebook_knowledge")
    .upsert(
      { domain, content, citations, synced_at: new Date().toISOString() },
      { onConflict: "domain" }
    )
    .select()
    .single();

  if (error) throw new Error(`Failed to upsert notebook knowledge for domain "${domain}": ${error.message}`);
  return toNotebookKnowledge(data as NotebookKnowledgeRow);
}

export async function listNotebookKnowledge(): Promise<NotebookKnowledge[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("notebook_knowledge").select().order("domain", { ascending: true });

  if (error) throw new Error(`Failed to list notebook knowledge: ${error.message}`);
  return (data as NotebookKnowledgeRow[]).map(toNotebookKnowledge);
}

export async function getNotebookKnowledge(domain: string): Promise<NotebookKnowledge | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("notebook_knowledge")
    .select()
    .eq("domain", domain)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch notebook knowledge for domain "${domain}": ${error.message}`);
  return data ? toNotebookKnowledge(data as NotebookKnowledgeRow) : null;
}
