import { v } from "convex/values";
import {
  query,
  mutation,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

// ---------------------------------------------------------------------------
// Public queries (signed-in user's own briefs)
// ---------------------------------------------------------------------------

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("briefs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { briefId: v.id("briefs") },
  handler: async (ctx, { briefId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const brief = await ctx.db.get(briefId);
    if (!brief || brief.userId !== userId) return null;
    return brief;
  },
});

export const listChunks = query({
  args: { briefId: v.id("briefs") },
  handler: async (ctx, { briefId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const brief = await ctx.db.get(briefId);
    if (!brief || brief.userId !== userId) return [];
    return await ctx.db
      .query("chunks")
      .withIndex("by_brief", (q) => q.eq("briefId", briefId))
      .order("asc")
      .collect();
  },
});

// ---------------------------------------------------------------------------
// Public mutations
// ---------------------------------------------------------------------------

export const create = mutation({
  args: {
    title: v.string(),
    rawText: v.string(),
  },
  handler: async (ctx, { title, rawText }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const now = Date.now();
    const briefId = await ctx.db.insert("briefs", {
      userId,
      title: title.slice(0, 200) || "Untitled brief",
      rawText: rawText.slice(0, 60_000),
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
    // Kick off the AI agent pipeline (extract → plan → refs → render)
    await ctx.scheduler.runAfter(0, internal.pipeline.runPipeline, { briefId });
    return briefId;
  },
});

export const remove = mutation({
  args: { briefId: v.id("briefs") },
  handler: async (ctx, { briefId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const brief = await ctx.db.get(briefId);
    if (!brief || brief.userId !== userId) throw new Error("Not found");
    const chunks = await ctx.db
      .query("chunks")
      .withIndex("by_brief", (q) => q.eq("briefId", briefId))
      .collect();
    for (const chunk of chunks) {
      await ctx.db.delete(chunk._id);
    }
    await ctx.db.delete(briefId);
  },
});

// ---------------------------------------------------------------------------
// Internal helpers used by the pipeline action
// ---------------------------------------------------------------------------

export const getInternal = internalQuery({
  args: { briefId: v.id("briefs") },
  handler: async (ctx, { briefId }) => {
    return await ctx.db.get(briefId);
  },
});

export const setStatus = internalMutation({
  args: {
    briefId: v.id("briefs"),
    status: v.union(
      v.literal("extracting"),
      v.literal("planning"),
      v.literal("rendering"),
    ),
  },
  handler: async (ctx, { briefId, status }) => {
    await ctx.db.patch(briefId, { status, updatedAt: Date.now() });
  },
});

export const setExtracted = internalMutation({
  args: {
    briefId: v.id("briefs"),
    extracted: v.any(),
  },
  handler: async (ctx, { briefId, extracted }) => {
    await ctx.db.patch(briefId, {
      extracted,
      status: "extracted",
      updatedAt: Date.now(),
    });
  },
});

export const replaceChunks = internalMutation({
  args: {
    briefId: v.id("briefs"),
    chunks: v.array(
      v.object({
        index: v.number(),
        name: v.string(),
        goal: v.string(),
        spec: v.string(),
      }),
    ),
  },
  handler: async (ctx, { briefId, chunks }) => {
    const existing = await ctx.db
      .query("chunks")
      .withIndex("by_brief", (q) => q.eq("briefId", briefId))
      .collect();
    for (const chunk of existing) {
      await ctx.db.delete(chunk._id);
    }
    for (const chunk of chunks) {
      await ctx.db.insert("chunks", {
        briefId,
        index: chunk.index,
        name: chunk.name,
        goal: chunk.goal,
        spec: chunk.spec,
        status: "todo",
      });
    }
    await ctx.db.patch(briefId, {
      status: "planned",
      chunksPlanned: chunks.length,
      chunksDone: 0,
      updatedAt: Date.now(),
    });
  },
});

export const getChunkByIndex = internalQuery({
  args: {
    briefId: v.id("briefs"),
    index: v.number(),
  },
  handler: async (ctx, { briefId, index }) => {
    return await ctx.db
      .query("chunks")
      .withIndex("by_brief", (q) => q.eq("briefId", briefId))
      .filter((q) => q.eq(q.field("index"), index))
      .first();
  },
});

export const setChunkStatus = internalMutation({
  args: {
    chunkId: v.id("chunks"),
    status: v.union(
      v.literal("finding_refs"),
      v.literal("generating"),
      v.literal("done"),
      v.literal("failed"),
    ),
  },
  handler: async (ctx, { chunkId, status }) => {
    await ctx.db.patch(chunkId, { status });
  },
});

export const setChunkRefs = internalMutation({
  args: {
    chunkId: v.id("chunks"),
    refs: v.array(v.string()),
  },
  handler: async (ctx, { chunkId, refs }) => {
    await ctx.db.patch(chunkId, { refs });
  },
});

export const setChunkSheet = internalMutation({
  args: {
    chunkId: v.id("chunks"),
    sheetUrl: v.string(),
    prompt: v.string(),
  },
  handler: async (ctx, { chunkId, sheetUrl, prompt }) => {
    await ctx.db.patch(chunkId, {
      sheetUrl,
      prompt,
      status: "done",
    });
  },
});

export const setProgress = internalMutation({
  args: {
    briefId: v.id("briefs"),
    chunksDone: v.number(),
  },
  handler: async (ctx, { briefId, chunksDone }) => {
    await ctx.db.patch(briefId, { chunksDone, updatedAt: Date.now() });
  },
});

export const finish = internalMutation({
  args: {
    briefId: v.id("briefs"),
    sheetUrl: v.string(),
  },
  handler: async (ctx, { briefId, sheetUrl }) => {
    await ctx.db.patch(briefId, {
      status: "done",
      sheetUrl,
      updatedAt: Date.now(),
    });
  },
});

export const fail = internalMutation({
  args: {
    briefId: v.id("briefs"),
    error: v.string(),
  },
  handler: async (ctx, { briefId, error }) => {
    await ctx.db.patch(briefId, {
      status: "failed",
      stageError: error.slice(0, 500),
      updatedAt: Date.now(),
    });
  },
});
