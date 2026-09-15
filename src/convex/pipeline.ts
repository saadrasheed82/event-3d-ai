"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, type ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// ---------------------------------------------------------------------------
// Providers
//  - Text:  Experiential Labs (OpenAI-compatible) — extraction + planning
//  - Image: Pollinations `gpt-image-2` — infographic turnaround sheets
//  - Refs:  Tavily search API — real-world reference images
//
// Keys are read from env first (set them in the Keys/API keys tab); the
// fallbacks below keep local dev working. This file is "use node" and is
// never bundled into the client.
// ---------------------------------------------------------------------------

const XPL_BASE =
  process.env.EXPERIENTIAL_LABS_BASE_URL || "https://api.experientiallabs.ai/v1";
const XPL_KEY =
  process.env.EXPERIENTIAL_LABS_API_KEY ||
  "xpl_c0b44004186943a022962aed605ccab09f20f6cb";
const XPL_MODEL = process.env.EXPERIENTIAL_LABS_MODEL || "gpt-5.6-luna";

const IMG_BASE = "https://image.pollinations.ai/prompt";
const POLLINATIONS_KEY =
  process.env.POLLINATIONS_API_KEY ||
  "sk_WMmdKRZBaoECiwyS8S1csNgFJbGlE140";
const IMAGE_MODEL = "gpt-image-2"; // fixed per product decision

const TAVILY_KEY =
  process.env.TAVILY_API_KEY || "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";

const MAX_CHUNKS = 6;

// ---------------------------------------------------------------------------
// Small HTTP helpers (timeout + bounded retry)
// ---------------------------------------------------------------------------

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  attempts = 2,
): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 55_000);
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      if (res.status === 429 || res.status === 502 || res.status === 503) {
        lastErr = new Error(`HTTP ${res.status} from ${url}`);
        await sleep(1_500 * (i + 1));
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      await sleep(1_500 * (i + 1));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Experiential Labs text generation (OpenAI-compatible chat completions)
// ---------------------------------------------------------------------------

type ChatMessage = {
  role: "system" | "user";
  content: string;
};

async function callChat(
  messages: ChatMessage[],
  opts: { maxTokens?: number } = {},
): Promise<string> {
  const res = await fetchWithRetry(`${XPL_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${XPL_KEY}`,
    },
    body: JSON.stringify({
      model: XPL_MODEL,
      messages,
      temperature: 0.4,
      max_tokens: opts.maxTokens ?? 2200,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Experiential Labs chat failed (${res.status}): ${body.slice(0, 300)}`,
    );
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("LLM returned no content");
  return text;
}

async function callChatJson<T>(messages: ChatMessage[]): Promise<T> {
  const raw = await callChat(messages);
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Model returned no JSON");
  return JSON.parse(raw.slice(start, end + 1)) as T;
}

// ---------------------------------------------------------------------------
// Reference image search via Tavily
// ---------------------------------------------------------------------------

async function findReferenceImages(
  query: string,
  count = 4,
): Promise<string[]> {
  try {
    const res = await fetchWithRetry(
      "https://api.tavily.com/search",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${TAVILY_KEY}`,
        },
        body: JSON.stringify({
          query,
          include_images: true,
          max_results: 3,
          search_depth: "basic",
        }),
      },
      2,
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { images?: string[] };
    return (data.images ?? [])
      .filter((u) => typeof u === "string" && u.startsWith("http"))
      .slice(0, count);
  } catch {
    return []; // refs are best-effort; never block the pipeline
  }
}

// ---------------------------------------------------------------------------
// Pollinations gpt-image-2 — one infographic sheet with all sides.
// The generated bytes are downloaded and stored in Convex storage, so the
// browser never needs (or sees) the Pollinations key.
// ---------------------------------------------------------------------------

async function generateSheet(
  ctx: ActionCtx,
  prompt: string,
  seed: number,
  width = 1536,
  height = 1024,
): Promise<Id<"_storage">> {
  const params = new URLSearchParams({
    model: IMAGE_MODEL,
    width: String(width),
    height: String(height),
    seed: String(seed),
    nologo: "true",
    safe: "false",
    key: POLLINATIONS_KEY,
  });

  const url = `${IMG_BASE}/${encodeURIComponent(prompt)}?${params.toString()}`;
  const res = await fetchWithRetry(url, { method: "GET" }, 3);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Pollinations image failed (${res.status}): ${body.slice(0, 300)}`,
    );
  }
  const blob = await res.blob();
  if (blob.size < 2048) throw new Error("Image response too small");
  return await ctx.storage.store(blob);
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const STYLE_ANCHOR =
  "Single flat infographic reference sheet for a 3D modeling team, clean vector-style illustration with soft clay-like matte rendering, pastel color palette, no photo backgrounds, no watermark, no text gibberish";

function extractionMessages(brief: string): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        "You are a 3D visualization lead at an event production company. From the raw client brief, extract ONLY information needed to build a 3D model of the event. Ignore catering menus, pricing, contracts, guest lists, scheduling, entertainment bookings, marketing copy, and anything else that does not affect geometry, staging, layout, materials, colors, lighting, AV placement, or branding surfaces. If a field is not mentioned, omit it. Reply with JSON only — no prose, no markdown fences.",
    },
    {
      role: "user",
      content: `Brief:\n"""\n${brief}\n"""\n\nReturn JSON with this exact shape (omit unknown fields, keep strings concise):\n{"eventName":string,"eventType":string,"venue":string,"dimensions":string,"staging":string,"lighting":string,"av":string,"seating":string,"branding":string,"layoutNotes":string,"objects":string[],"ignored":string}`,
    },
  ];
}

function planningMessages(brief: string, extractedJson: string): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        "You are planning the build of one 3D event model. Split the 3D-relevant scope into an ordered list of 3 to 6 chunks (parts of the same single event model) that can each be modeled one at a time. Each chunk must cover distinct physical parts of the venue; together they must cover the whole event. Do not include tasks like files, exports, reviews, or meetings — only physical/geometric scope. Reply with JSON only — no prose, no markdown fences.",
    },
    {
      role: "user",
      content: `Brief:\n"""\n${brief}\n"""\n\nExtracted 3D info:\n${extractedJson}\n\nReturn JSON:\n{"chunks":[{"name":string,"goal":string,"spec":string}]}\n"spec" must be a detailed modeling instruction for that part: geometry, approximate dimensions, materials, colors, placement relative to the venue, and any branding/graphics to apply.`,
    },
  ];
}

function chunkSheetPrompt(
  eventName: string,
  chunkName: string,
  goal: string,
  spec: string,
): string {
  return [
    `${STYLE_ANCHOR}.`,
    `Reference sheet for one part of a 3D event model (${eventName || "the event"}). Part: ${chunkName}. Goal: ${goal}.`,
    `Modeling spec: ${spec}`,
    "The sheet shows the SAME object from multiple labeled viewpoints side by side: front view, side view, top-down plan view, and a 3/4 perspective view, plus a small color/material swatch strip. Consistent scale and colors across all views. Isometric-style clarity, soft shadows.",
  ]
    .join(" ")
    .slice(0, 1800);
}

function summarySheetPrompt(
  eventName: string,
  chunkSummaries: { name: string; prompt: string }[],
  layoutNotes: string,
): string {
  const parts = chunkSummaries
    .map((c, i) => `Panel ${i + 1} — ${c.name}: ${c.prompt}`)
    .join(" || ");
  return [
    `${STYLE_ANCHOR}.`,
    `Master 3D model plan for an event called "${eventName || "the event"}".`,
    layoutNotes ? `Layout: ${layoutNotes}.` : "",
    `The sheet is a multi-panel board showing the full event model: one overall 3/4 view of the whole venue, then a panel per major part. ${parts}`,
    "Consistent colors, materials and scale across all panels so the parts read as one single event model. Include a small legend strip of material/color swatches.",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 1900);
}

// ---------------------------------------------------------------------------
// The pipeline
// ---------------------------------------------------------------------------

export const runPipeline = internalAction({
  args: { briefId: v.id("briefs") },
  handler: async (ctx: ActionCtx, args: { briefId: Id<"briefs"> }) => {
    const briefId = args.briefId;
    const brief = await ctx.runQuery(internal.briefs.getInternal, { briefId });
    if (!brief) throw new Error(`Brief ${briefId} not found`);

    try {
      // ---- Stage 1: extract 3D-only info --------------------------------
      await ctx.runMutation(internal.briefs.setStatus, {
        briefId,
        status: "extracting",
      });
      const extracted = await callChatJson<Record<string, unknown>>(
        extractionMessages(brief.rawText),
      );
      await ctx.runMutation(internal.briefs.setExtracted, {
        briefId,
        extracted,
      });

      // ---- Stage 2: plan chunks -----------------------------------------
      await ctx.runMutation(internal.briefs.setStatus, {
        briefId,
        status: "planning",
      });
      const plan = await callChatJson<{
        chunks: { name: string; goal: string; spec: string }[];
      }>(
        planningMessages(
          brief.rawText,
          JSON.stringify(extracted).slice(0, 4000),
        ),
      );
      const chunkDefs = (plan.chunks ?? []).slice(0, MAX_CHUNKS);
      if (chunkDefs.length === 0) throw new Error("Planner returned no chunks");

      await ctx.runMutation(internal.briefs.replaceChunks, {
        briefId,
        chunks: chunkDefs.map((c, i) => ({
          index: i,
          name: String(c.name || `Part ${i + 1}`).slice(0, 120),
          goal: String(c.goal || "").slice(0, 600),
          spec: String(c.spec || "").slice(0, 4000),
        })),
      });

      // ---- Stage 3 + 4: per chunk, refs then sheet ----------------------
      await ctx.runMutation(internal.briefs.setStatus, {
        briefId,
        status: "rendering",
      });

      const chunkSheetPrompts: { name: string; prompt: string }[] = [];
      let done = 0;

      for (const [slot, def] of chunkDefs.entries()) {
        const chunk = await ctx.runQuery(internal.briefs.getChunkByIndex, {
          briefId,
          index: slot,
        });
        if (!chunk) continue;

        const sheetPrompt = chunkSheetPrompt(
          String(extracted.eventName ?? brief.title),
          def.name,
          def.goal,
          def.spec,
        );

        try {
          // Reference images (best effort)
          await ctx.runMutation(internal.briefs.setChunkStatus, {
            chunkId: chunk._id,
            status: "finding_refs",
          });
          const refQuery = `${chunk.name} ${chunk.goal} event production stage design`
            .replace(/[^a-zA-Z0-9 ]/g, " ")
            .slice(0, 120);
          const refs = await findReferenceImages(refQuery, 4);
          await ctx.runMutation(internal.briefs.setChunkRefs, {
            chunkId: chunk._id,
            refs,
          });

          // Generate the all-sides infographic sheet
          await ctx.runMutation(internal.briefs.setChunkStatus, {
            chunkId: chunk._id,
            status: "generating",
          });
          const seed = (hashString(briefId + chunk.name) % 900000) + 1000;
          const storageId = await generateSheet(ctx, sheetPrompt, seed);
          await ctx.runMutation(internal.briefs.setChunkSheet, {
            chunkId: chunk._id,
            storageId,
            prompt: sheetPrompt,
          });

          chunkSheetPrompts.push({ name: chunk.name, prompt: sheetPrompt });
          done += 1;
          await ctx.runMutation(internal.briefs.setProgress, {
            briefId,
            chunksDone: done,
          });
        } catch (chunkErr) {
          // One bad chunk must not sink the whole brief
          await ctx.runMutation(internal.briefs.setChunkStatus, {
            chunkId: chunk._id,
            status: "failed",
            error:
              chunkErr instanceof Error
                ? chunkErr.message
                : "Unknown chunk error",
          });
        }
      }

      if (done === 0) throw new Error("No chunk could be rendered");

      // ---- Summary sheet -------------------------------------------------
      const summaryStorageId = await generateSheet(
        ctx,
        summarySheetPrompt(
          String(extracted.eventName ?? brief.title),
          chunkSheetPrompts,
          String(extracted.layoutNotes ?? ""),
        ),
        (hashString(briefId) % 900000) + 1000,
        1536,
        1024,
      );

      await ctx.runMutation(internal.briefs.finish, {
        briefId,
        storageId: summaryStorageId,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown pipeline error";
      await ctx.runMutation(internal.briefs.fail, {
        briefId,
        error: message,
      });
    }
  },
});

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}
