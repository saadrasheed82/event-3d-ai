"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Id } from "./_generated/dataModel";

// ---------------------------------------------------------------------------
// Supabase archive for finished briefs.
//
// After the pipeline renders the master sheet, the whole brief (extracted 3D
// info, chunks, and the generated infographic images) is archived to Supabase
// Postgres + Storage. The live app keeps running on Convex; Supabase is the
// durable archive/backup layer.
//
// Keys (set them in the Keys/API keys tab):
//   SUPABASE_URL            e.g. https://xxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY  service-role key (server-only, never exposed)
//   SUPABASE_ARCHIVE_BUCKET    optional, defaults to "brief-archives"
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const BUCKET = process.env.SUPABASE_ARCHIVE_BUCKET || "brief-archives";

let cachedClient: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error(
      "Supabase is not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the Keys tab",
    );
  }
  if (!cachedClient) {
    cachedClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    });
  }
  return cachedClient;
}

export const archiveBrief = internalAction({
  args: { briefId: v.id("briefs") },
  handler: async (ctx, { briefId }) => {
    const supabase = getClient();

    const brief = await ctx.runQuery(internal.briefs.getInternal, { briefId });
    if (!brief) throw new Error(`Brief ${briefId} not found`);

    const chunks = await ctx.runQuery(internal.briefs.getAllChunksInternal, {
      briefId,
    });

    // ---- 1. Store images in Supabase Storage -----------------------------
    async function storeImage(
      storageId: Id<"_storage"> | undefined,
      path: string,
    ): Promise<string | null> {
      if (!storageId) return null;
      const blob = await ctx.storage.get(storageId);
      if (!blob) return null;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { contentType: "image/png", upsert: true });
      if (error) throw new Error(`Storage upload failed: ${error.message}`);
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      return data.publicUrl;
    }

    const masterUrl = await storeImage(
      brief.sheetStorageId,
      `${briefId}/master.png`,
    );

    const chunkUrls: Record<string, string> = {};
    for (const chunk of chunks) {
      const url = await storeImage(
        chunk.sheetStorageId,
        `${briefId}/chunk-${chunk.index}.png`,
      );
      if (url) chunkUrls[chunk.index] = url;
    }

    // ---- 2. Upsert the archive row ---------------------------------------
    const { error } = await supabase.from("brief_archives").upsert(
      {
        brief_id: briefId,
        user_id: brief.userId,
        title: brief.title,
        raw_text: brief.rawText,
        status: brief.status,
        extracted: brief.extracted ?? null,
        chunks: chunks.map((c) => ({
          index: c.index,
          name: c.name,
          goal: c.goal,
          spec: c.spec,
          refs: c.refs ?? [],
          prompt: c.prompt ?? null,
          sheetUrl: chunkUrls[c.index] ?? null,
        })),
        master_sheet_url: masterUrl,
        chunks_planned: brief.chunksPlanned ?? null,
        chunks_done: brief.chunksDone ?? null,
        archived_at: new Date().toISOString(),
      },
      { onConflict: "brief_id" },
    );
    if (error) throw new Error(`Supabase upsert failed: ${error.message}`);

    return { ok: true as const, masterUrl };
  },
});
