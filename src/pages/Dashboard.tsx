import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  Box,
  CheckCircle2,
  FileText,
  Images,
  Loader2,
  LogOut,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

const BRIEF_STATUS: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  extracting: {
    label: "Reading brief",
    className: "bg-clay-butter text-[#7c5a10]",
  },
  extracted: {
    label: "3D info ready",
    className: "bg-clay-butter text-[#7c5a10]",
  },
  planning: { label: "Planning chunks", className: "bg-clay-sky text-[#20506f]" },
  planned: { label: "Chunks planned", className: "bg-clay-sky text-[#20506f]" },
  rendering: {
    label: "Rendering sheets",
    className: "bg-clay-lilac text-[#4d3580]",
  },
  done: { label: "Complete", className: "bg-clay-mint text-[#1d5c44]" },
  failed: { label: "Failed", className: "bg-clay-coral text-white" },
};

const CHUNK_STATUS: Record<string, { label: string; className: string }> = {
  todo: { label: "Queued", className: "bg-muted text-muted-foreground" },
  finding_refs: {
    label: "Finding refs",
    className: "bg-clay-sky text-[#20506f]",
  },
  generating: {
    label: "Generating sheet",
    className: "bg-clay-lilac text-[#4d3580]",
  },
  done: { label: "Sheet ready", className: "bg-clay-mint text-[#1d5c44]" },
  failed: { label: "Failed", className: "bg-clay-coral text-white" },
};

function StatusChip({
  map,
  status,
}: {
  map: Record<string, { label: string; className: string }>;
  status: string;
}) {
  const entry = map[status] ?? map.draft;
  const running = ["extracting", "planning", "rendering", "finding_refs", "generating"].includes(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold",
        entry.className,
      )}
    >
      {running && <Loader2 className="size-3 animate-spin" />}
      {entry.label}
    </span>
  );
}

function SheetImage({ src, alt }: { src: string; alt: string }) {
  return (
    <a href={src} target="_blank" rel="noopener noreferrer" className="block">
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="w-full rounded-2xl bg-white object-cover clay-sm transition-transform hover:-translate-y-0.5"
      />
    </a>
  );
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const briefs = useQuery(api.briefs.listMine, {});
  const [selectedId, setSelectedId] = useState<Id<"briefs"> | null>(null);
  const brief = useQuery(
    api.briefs.get,
    selectedId ? { briefId: selectedId } : "skip",
  );
  const chunks = useQuery(
    api.briefs.listChunks,
    selectedId ? { briefId: selectedId } : "skip",
  );

  const createBrief = useMutation(api.briefs.create);
  const removeBrief = useMutation(api.briefs.remove);

  const [title, setTitle] = useState("");
  const [rawText, setRawText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!rawText.trim() || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const briefId = await createBrief({
        title: title.trim() || "Untitled event",
        rawText: rawText.trim(),
      });
      setTitle("");
      setRawText("");
      setSelectedId(briefId);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to create brief");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (briefId: Id<"briefs">) => {
    await removeBrief({ briefId });
    if (selectedId === briefId) setSelectedId(null);
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6">
        <Link to="/" className="flex items-center gap-3">
          <span className="clay-sm flex size-10 items-center justify-center rounded-2xl bg-white/80 p-2">
            <Sparkles className="size-5 text-primary" />
          </span>
          <span className="font-display text-xl font-bold tracking-tight">
            Modelforge Studio
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm font-semibold text-muted-foreground sm:block">
            {user?.name ?? user?.email ?? "Guest"}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="clay-sm rounded-full border-transparent bg-white/80 font-bold"
            onClick={handleSignOut}
          >
            <LogOut className="size-4" />
            Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 pb-20">
        <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
          {/* ---------- Left: new brief + list ---------- */}
          <div className="flex flex-col gap-6">
            <form
              onSubmit={handleSubmit}
              className="clay-sheen clay rounded-[1.8rem] bg-white/85 p-6"
            >
              <h2 className="font-display text-lg font-bold">New event brief</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Paste the whole briefing — notes, details, extra context. The
                agent keeps only what the 3D model needs.
              </p>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Event name (optional)"
                className="clay-sm mt-4 rounded-2xl border-transparent bg-muted/70 px-4 py-3 font-semibold"
              />
              <Textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="The full brief goes here… stage sizes, venue, layout, materials, lighting, branding — anything and everything."
                rows={7}
                required
                className="clay-sm mt-3 rounded-2xl border-transparent bg-muted/70 px-4 py-3 font-medium"
              />
              {submitError && (
                <p className="mt-3 rounded-2xl bg-clay-coral/10 px-4 py-2 text-sm font-semibold text-destructive">
                  {submitError}
                </p>
              )}
              <Button
                type="submit"
                disabled={submitting || !rawText.trim()}
                className="clay-sm mt-4 w-full rounded-full bg-primary py-3 font-display text-base font-extrabold text-primary-foreground"
              >
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    Run the agent
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="flex flex-col gap-3">
              {briefs === undefined ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : briefs.length === 0 ? (
                <p className="clay-sm rounded-[1.5rem] bg-white/60 px-5 py-6 text-center text-sm text-muted-foreground">
                  No briefs yet. Your first one will show up here.
                </p>
              ) : (
                briefs.map((b) => (
                  <div
                    key={b._id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedId(b._id)}
                    onKeyDown={(e) => e.key === "Enter" && setSelectedId(b._id)}
                    className={cn(
                      "clay-sheen group cursor-pointer rounded-[1.5rem] bg-white/80 p-4 transition-transform hover:-translate-y-0.5 clay-sm",
                      selectedId === b._id && "ring-2 ring-primary/60",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-display font-bold">
                        {b.title}
                      </span>
                      <button
                        type="button"
                        aria-label="Delete brief"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDelete(b._id);
                        }}
                        className="rounded-full p-1.5 text-muted-foreground/50 opacity-0 transition-opacity hover:bg-clay-coral/10 hover:text-destructive group-hover:opacity-100"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <StatusChip map={BRIEF_STATUS} status={b.status} />
                      <span className="text-xs font-semibold text-muted-foreground">
                        {new Date(b.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ---------- Right: detail ---------- */}
          <div className="flex flex-col gap-6">
            {!brief ? (
              <div className="clay-sheen clay flex min-h-[420px] flex-col items-center justify-center rounded-[2rem] bg-white/70 p-10 text-center">
                <span className="flex size-16 items-center justify-center rounded-3xl bg-clay-blush clay-sm">
                  <FileText className="size-8 text-[#8a3b52]" />
                </span>
                <h2 className="mt-5 font-display text-xl font-bold">
                  Pick a brief or start a new one
                </h2>
                <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                  The agent extracts the 3D-relevant info, plans the build in
                  chunks, finds references, and renders a turnaround sheet for
                  each chunk — then one master sheet.
                </p>
              </div>
            ) : (
              <>
                {/* Summary card */}
                <div className="clay-sheen clay rounded-[2rem] bg-white/85 p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                        Event brief
                      </p>
                      <h2 className="mt-1 font-display text-2xl font-extrabold">
                        {brief.title}
                      </h2>
                    </div>
                    <StatusChip map={BRIEF_STATUS} status={brief.status} />
                  </div>

                  {brief.status === "failed" && brief.stageError && (
                    <div className="mt-4 flex items-start gap-3 rounded-2xl bg-clay-coral/10 p-4">
                      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
                      <div>
                        <p className="text-sm font-bold text-destructive">
                          The agent hit a problem
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {brief.stageError}
                        </p>
                      </div>
                    </div>
                  )}

                  {brief.extracted && (
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {Object.entries(brief.extracted)
                        .filter(([, v]) => v !== undefined && v !== null)
                        .map(([key, value]) => (
                          <div
                            key={key}
                            className="clay-sm rounded-2xl bg-muted/60 p-3"
                          >
                            <p className="text-[11px] font-extrabold tracking-wide text-muted-foreground uppercase">
                              {key}
                            </p>
                            <p className="mt-1 text-sm font-semibold">
                              {Array.isArray(value) ? value.join(", ") : String(value)}
                            </p>
                          </div>
                        ))}
                    </div>
                  )}

                  {typeof brief.chunksPlanned === "number" && (
                    <div className="mt-5">
                      <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
                        <span>
                          {brief.chunksDone ?? 0} / {brief.chunksPlanned} chunks rendered
                        </span>
                        <span>
                          {Math.round(
                            ((brief.chunksDone ?? 0) / brief.chunksPlanned) * 100,
                          )}
                          %
                        </span>
                      </div>
                      <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted clay-press">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-clay-mint to-clay-sky transition-all"
                          style={{
                            width: `${((brief.chunksDone ?? 0) / brief.chunksPlanned) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Master sheet */}
                {brief.sheetUrl && (
                  <div className="clay-sheen clay rounded-[2rem] bg-white/85 p-6">
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 items-center justify-center rounded-2xl bg-clay-mint clay-sm">
                        <CheckCircle2 className="size-5 text-[#1d5c44]" />
                      </span>
                      <div>
                        <h3 className="font-display text-lg font-bold">
                          Master model sheet
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          The full event model, assembled from all chunks.
                        </p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <SheetImage src={brief.sheetUrl} alt="Master 3D model sheet" />
                    </div>
                  </div>
                )}

                {/* Chunks */}
                {chunks && chunks.length > 0 && (
                  <div className="flex flex-col gap-4">
                    <h3 className="px-1 font-display text-lg font-bold">
                      Build chunks
                    </h3>
                    {chunks.map((chunk) => (
                      <div
                        key={chunk._id}
                        className="clay-sheen clay-sm rounded-[1.6rem] bg-white/85 p-5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <span className="flex size-9 items-center justify-center rounded-xl bg-clay-butter clay-sm font-display text-sm font-extrabold text-[#7c5a10]">
                              {chunk.index + 1}
                            </span>
                            <span className="font-display font-bold">
                              {chunk.name}
                            </span>
                          </div>
                          <StatusChip map={CHUNK_STATUS} status={chunk.status} />
                        </div>

                        <p className="mt-3 text-sm text-muted-foreground">
                          {chunk.goal}
                        </p>
                        <p className="mt-2 rounded-2xl bg-muted/50 p-3 text-sm leading-relaxed">
                          {chunk.spec}
                        </p>

                        {chunk.refs && chunk.refs.length > 0 && (
                          <div className="mt-3">
                            <p className="flex items-center gap-1.5 text-xs font-extrabold tracking-wide text-muted-foreground uppercase">
                              <Images className="size-3.5" />
                              Reference images
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {chunk.refs.map((ref) => (
                                <a
                                  key={ref}
                                  href={ref}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="clay-sm rounded-full bg-clay-sky/20 px-3 py-1.5 text-xs font-bold text-[#20506f] transition-transform hover:-translate-y-0.5"
                                >
                                  Open ref
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {chunk.sheetUrl && (
                          <div className="mt-4">
                            <SheetImage
                              src={chunk.sheetUrl}
                              alt={`${chunk.name} turnaround sheet`}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
