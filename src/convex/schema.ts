import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

// ---- 3D Model pipeline status ----
const pipelineStatus = v.union(
  v.literal("draft"),
  v.literal("extracting"),
  v.literal("extracted"),
  v.literal("planning"),
  v.literal("planned"),
  v.literal("rendering"),
  v.literal("done"),
  v.literal("failed"),
);
export type PipelineStatus = Infer<typeof pipelineStatus>;

const chunkStatus = v.union(
  v.literal("todo"),
  v.literal("finding_refs"),
  v.literal("generating"),
  v.literal("done"),
  v.literal("failed"),
);
export type ChunkStatus = Infer<typeof chunkStatus>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // add other tables here

    briefs: defineTable({
      userId: v.id("users"),
      title: v.string(),
      rawText: v.string(),
      status: pipelineStatus,
      stageError: v.optional(v.string()),
      extracted: v.optional(v.object({
        eventName: v.optional(v.string()),
        eventType: v.optional(v.string()),
        venue: v.optional(v.string()),
        dimensions: v.optional(v.string()),
        staging: v.optional(v.string()),
        lighting: v.optional(v.string()),
        av: v.optional(v.string()),
        seating: v.optional(v.string()),
        branding: v.optional(v.string()),
        layoutNotes: v.optional(v.string()),
        objects: v.optional(v.array(v.string())),
        ignored: v.optional(v.string()),
      })),
      chunksPlanned: v.optional(v.number()),
      chunksDone: v.optional(v.number()),
      sheetStorageId: v.optional(v.id("_storage")),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_user", ["userId", "createdAt"])
      .index("by_status", ["status"]),

    chunks: defineTable({
      briefId: v.id("briefs"),
      index: v.number(),
      name: v.string(),
      goal: v.string(),
      spec: v.string(),
      refs: v.optional(v.array(v.string())),
      status: chunkStatus,
      error: v.optional(v.string()),
      attempts: v.optional(v.number()),
      sheetStorageId: v.optional(v.id("_storage")),
      prompt: v.optional(v.string()),
    })
      .index("by_brief", ["briefId", "index"])
      .index("by_status", ["status"]),

    // tableName: defineTable({
    //   ...
    //   // table fields
    // }).index("by_field", ["field"])
  },
  {
    schemaValidation: false,
  },
);

export default schema;
