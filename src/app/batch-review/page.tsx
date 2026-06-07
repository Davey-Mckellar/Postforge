"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// ---------------------------------------------------------------------------
// Types (mirror API shape)
// ---------------------------------------------------------------------------

interface Brand {
  id: string;
  name: string;
}

interface Draft {
  id: string;
  caption: string;
  pillar: string;
  visualBrief: string;
  platform: string;
  status: string;
}

interface Batch {
  id: string;
  brandId: string;
  status: string;
  itemCount: number;
  createdAt: string;
}

type DraftStatus = "DRAFT" | "APPROVED" | "REJECTED";

// ---------------------------------------------------------------------------
// Pillar colour map
// ---------------------------------------------------------------------------

const PILLAR_COLORS: Record<string, string> = {
  Education: "bg-blue-900/40 text-blue-300 ring-blue-700/40",
  Inspiration: "bg-purple-900/40 text-purple-300 ring-purple-700/40",
  "Behind-the-Scenes": "bg-amber-900/40 text-amber-300 ring-amber-700/40",
  Promotion: "bg-emerald-900/40 text-emerald-300 ring-emerald-700/40",
  Community: "bg-pink-900/40 text-pink-300 ring-pink-700/40",
  "Tips & Tricks": "bg-cyan-900/40 text-cyan-300 ring-cyan-700/40",
  "Product Features": "bg-indigo-900/40 text-indigo-300 ring-indigo-700/40",
  "Customer Stories": "bg-rose-900/40 text-rose-300 ring-rose-700/40",
  Entertainment: "bg-yellow-900/40 text-yellow-300 ring-yellow-700/40",
  "News & Trends": "bg-teal-900/40 text-teal-300 ring-teal-700/40",
};

function pillarClass(pillar: string) {
  return PILLAR_COLORS[pillar] ?? "bg-zinc-800 text-zinc-300 ring-zinc-700";
}

// ---------------------------------------------------------------------------
// Copy button
// ---------------------------------------------------------------------------

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-zinc-500 ring-1 ring-zinc-800 hover:bg-zinc-800 hover:text-zinc-300"
      title="Copy caption"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Draft card
// ---------------------------------------------------------------------------

function DraftCard({
  draft,
  batchId,
  onUpdated,
}: {
  draft: Draft;
  batchId: string;
  onUpdated: (updated: Draft) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editCaption, setEditCaption] = useState(draft.caption);
  const [saving, setSaving] = useState(false);

  async function patchDraft(payload: { caption?: string; status?: DraftStatus }) {
    setSaving(true);
    try {
      const res = await fetch(`/api/batches/${batchId}/drafts`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: draft.id, ...payload }),
      });
      if (res.ok) {
        const { draft: updated } = (await res.json()) as { draft: Draft };
        onUpdated(updated);
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  }

  const status = draft.status as DraftStatus;

  return (
    <div
      className={`group relative flex flex-col gap-3 rounded-2xl p-5 ring-1 transition-all ${
        status === "APPROVED"
          ? "bg-emerald-950/30 ring-emerald-800/50"
          : status === "REJECTED"
          ? "bg-zinc-950/60 opacity-50 ring-zinc-900"
          : "bg-zinc-900/70 ring-zinc-800 hover:ring-zinc-700"
      }`}
    >
      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ${pillarClass(draft.pillar)}`}
          >
            {draft.pillar}
          </span>
          <span className="text-[11px] text-zinc-600">{draft.platform}</span>
        </div>
        {status === "APPROVED" && (
          <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400">
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Approved
          </span>
        )}
        {status === "REJECTED" && (
          <span className="text-[11px] font-medium text-zinc-600">Rejected</span>
        )}
      </div>

      {/* Caption */}
      {editing ? (
        <div className="space-y-2">
          <textarea
            autoFocus
            rows={6}
            value={editCaption}
            onChange={(e) => setEditCaption(e.target.value)}
            className="w-full resize-none rounded-xl border-0 bg-zinc-800/80 px-3 py-2.5 text-sm leading-relaxed text-zinc-100 ring-1 ring-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void patchDraft({ caption: editCaption })}
              className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditCaption(draft.caption);
                setEditing(false);
              }}
              className="rounded-lg px-3 py-1.5 text-xs text-zinc-400 ring-1 ring-zinc-800 hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{draft.caption}</p>
      )}

      {/* Visual brief */}
      {draft.visualBrief && (
        <p className="rounded-lg bg-zinc-800/50 px-3 py-2 text-xs leading-snug text-zinc-500">
          <span className="font-medium text-zinc-400">Visual: </span>
          {draft.visualBrief}
        </p>
      )}

      {/* Actions */}
      {!editing && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {status !== "APPROVED" && (
            <button
              type="button"
              disabled={saving}
              onClick={() => void patchDraft({ status: "APPROVED" })}
              className="rounded-lg bg-emerald-900/50 px-3 py-1.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-800/60 hover:bg-emerald-800/60 disabled:opacity-40"
            >
              ✓ Approve
            </button>
          )}
          {status === "APPROVED" && (
            <button
              type="button"
              disabled={saving}
              onClick={() => void patchDraft({ status: "DRAFT" })}
              className="rounded-lg px-3 py-1.5 text-xs text-zinc-500 ring-1 ring-zinc-800 hover:bg-zinc-800"
            >
              Undo approve
            </button>
          )}
          {status !== "REJECTED" && (
            <button
              type="button"
              disabled={saving}
              onClick={() => void patchDraft({ status: "REJECTED" })}
              className="rounded-lg px-3 py-1.5 text-xs text-zinc-500 ring-1 ring-zinc-800 hover:bg-zinc-800 hover:text-red-400"
            >
              ✕ Reject
            </button>
          )}
          {status === "REJECTED" && (
            <button
              type="button"
              disabled={saving}
              onClick={() => void patchDraft({ status: "DRAFT" })}
              className="rounded-lg px-3 py-1.5 text-xs text-zinc-400 ring-1 ring-zinc-800 hover:bg-zinc-800"
            >
              Restore
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-lg px-3 py-1.5 text-xs text-zinc-500 ring-1 ring-zinc-800 hover:bg-zinc-800 hover:text-zinc-300"
          >
            Edit
          </button>
          <CopyButton text={draft.caption} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page (inner — has access to searchParams)
// ---------------------------------------------------------------------------

function BatchReviewInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialBrandId = searchParams.get("brandId") ?? "";
  const fresh = searchParams.get("fresh") === "1";

  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState(initialBrandId);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [activeBatch, setActiveBatch] = useState<Batch | null>(null);
  const [draftList, setDraftList] = useState<Draft[]>([]);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [filter, setFilter] = useState<"ALL" | "DRAFT" | "APPROVED" | "REJECTED">("ALL");

  const hasFiredFresh = useRef(false);

  // ---- Load brands ----
  useEffect(() => {
    fetch("/api/brands")
      .then((r) => r.json())
      .then((data: { brands?: Brand[] }) => {
        const list = data.brands ?? [];
        setBrands(list);
        if (!selectedBrandId && list[0]) setSelectedBrandId(list[0].id);
      })
      .catch(() => undefined);
  }, [selectedBrandId]);

  // ---- Load batches for selected brand ----
  useEffect(() => {
    if (!selectedBrandId) return;
    fetch("/api/batches")
      .then((r) => r.json())
      .then((data: { batches?: Batch[] }) => {
        const list = (data.batches ?? []).filter((b) => b.brandId === selectedBrandId);
        setBatches(list);
        const latest = list.find((b) => b.status === "READY") ?? list[0] ?? null;
        setActiveBatch(latest);
      })
      .catch(() => undefined);
  }, [selectedBrandId]);

  // ---- Load drafts when active batch changes ----
  useEffect(() => {
    if (!activeBatch) {
      setDraftList([]);
      return;
    }
    setLoadingDrafts(true);
    fetch(`/api/batches/${activeBatch.id}`)
      .then((r) => r.json())
      .then((data: { drafts?: Draft[] }) => setDraftList(data.drafts ?? []))
      .catch(() => undefined)
      .finally(() => setLoadingDrafts(false));
  }, [activeBatch]);

  // ---- Auto-generate if ?fresh=1 (redirect from brand setup) ----
  useEffect(() => {
    if (fresh && selectedBrandId && !hasFiredFresh.current && brands.length > 0) {
      hasFiredFresh.current = true;
      void generateBatch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fresh, selectedBrandId, brands]);

  const generateBatch = useCallback(async () => {
    if (!selectedBrandId || generating) return;
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId: selectedBrandId, itemCount: 30 }),
      });

      const body = (await res.json()) as {
        batchId?: string;
        drafts?: Draft[];
        error?: string;
        upgradeRequired?: boolean;
      };

      if (!res.ok) {
        if (body.upgradeRequired) {
          setGenError("Your plan doesn't support batch generation. Upgrade to Pro.");
        } else {
          setGenError(body.error ?? "Generation failed");
        }
        return;
      }

      // Refresh batch list
      const batchRes = await fetch("/api/batches");
      const batchData = (await batchRes.json()) as { batches?: Batch[] };
      const list = (batchData.batches ?? []).filter((b) => b.brandId === selectedBrandId);
      setBatches(list);

      const newBatch = list.find((b) => b.id === body.batchId) ?? list[0] ?? null;
      setActiveBatch(newBatch);
      setDraftList(body.drafts ?? []);

      // Remove ?fresh param from URL
      router.replace("/batch-review");
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }, [selectedBrandId, generating, router]);

  // ---- Draft update handler ----
  function handleDraftUpdated(updated: Draft) {
    setDraftList((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  }

  // ---- Approve all ----
  async function approveAll() {
    const toApprove = draftList.filter((d) => d.status === "DRAFT");
    if (!activeBatch || toApprove.length === 0) return;
    for (const draft of toApprove) {
      await fetch(`/api/batches/${activeBatch.id}/drafts`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: draft.id, status: "APPROVED" }),
      });
    }
    setDraftList((prev) => prev.map((d) => (d.status === "DRAFT" ? { ...d, status: "APPROVED" } : d)));
  }

  // ---- Derived counts ----
  const counts = {
    ALL: draftList.length,
    DRAFT: draftList.filter((d) => d.status === "DRAFT").length,
    APPROVED: draftList.filter((d) => d.status === "APPROVED").length,
    REJECTED: draftList.filter((d) => d.status === "REJECTED").length,
  };

  const filteredDrafts = filter === "ALL" ? draftList : draftList.filter((d) => d.status === filter);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Content Batch</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Review, edit, and approve your AI-generated posts.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/brand-setup")}
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800"
          >
            + New Brand
          </button>
        </div>

        {/* Brand selector + generate */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          {brands.length > 0 ? (
            <select
              value={selectedBrandId}
              onChange={(e) => setSelectedBrandId(e.target.value)}
              className="min-h-[40px] rounded-xl border-0 bg-zinc-900 py-2 pl-3 pr-8 text-sm text-zinc-200 ring-1 ring-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            >
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-zinc-500">No brands yet.</p>
          )}

          <button
            type="button"
            disabled={!selectedBrandId || generating}
            onClick={() => void generateBatch()}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {generating ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                Generating 30 posts…
              </>
            ) : (
              <>⚡ Generate 30 Posts</>
            )}
          </button>

          {batches.length > 1 && (
            <select
              value={activeBatch?.id ?? ""}
              onChange={(e) => {
                const b = batches.find((x) => x.id === e.target.value) ?? null;
                setActiveBatch(b);
              }}
              className="min-h-[40px] rounded-xl border-0 bg-zinc-900 py-2 pl-3 pr-8 text-xs text-zinc-400 ring-1 ring-zinc-800 focus:outline-none"
              title="Switch between previous batches"
            >
              {batches.map((b, i) => (
                <option key={b.id} value={b.id}>
                  Batch {batches.length - i} —{" "}
                  {new Date(b.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Error */}
        {genError && (
          <div className="mb-6 flex items-start gap-3 rounded-xl bg-red-900/25 px-4 py-3 text-sm text-red-400 ring-1 ring-red-800/50">
            <span className="shrink-0">⚠</span>
            <span>{genError}</span>
          </div>
        )}

        {/* Generating skeleton */}
        {generating && (
          <div className="mb-8 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-36 animate-pulse rounded-2xl bg-zinc-900/60 ring-1 ring-zinc-800"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
            <p className="text-center text-xs text-zinc-600">
              The AI is writing 30 captions — this usually takes 15–30 seconds…
            </p>
          </div>
        )}

        {/* Draft list */}
        {!generating && draftList.length > 0 && (
          <>
            {/* Filter + bulk actions */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1 rounded-xl bg-zinc-900 p-1 ring-1 ring-zinc-800">
                {(["ALL", "DRAFT", "APPROVED", "REJECTED"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                      filter === f
                        ? "bg-zinc-800 text-zinc-100"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}{" "}
                    <span className="text-zinc-600">{counts[f]}</span>
                  </button>
                ))}
              </div>

              {counts.DRAFT > 0 && (
                <button
                  type="button"
                  onClick={() => void approveAll()}
                  className="rounded-xl bg-emerald-900/50 px-3 py-2 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-800/60 hover:bg-emerald-800/60"
                >
                  Approve all ({counts.DRAFT})
                </button>
              )}
            </div>

            {filteredDrafts.length === 0 ? (
              <p className="py-12 text-center text-sm text-zinc-600">
                No posts in this view.
              </p>
            ) : (
              <div className="space-y-4">
                {filteredDrafts.map((draft) => (
                  <DraftCard
                    key={draft.id}
                    draft={draft}
                    batchId={activeBatch!.id}
                    onUpdated={handleDraftUpdated}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Empty state */}
        {!generating && !loadingDrafts && draftList.length === 0 && brands.length > 0 && (
          <div className="py-20 text-center">
            <p className="text-5xl">✨</p>
            <p className="mt-4 text-base font-medium text-zinc-300">
              No posts yet for this brand
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              Hit <strong className="text-zinc-300">Generate 30 Posts</strong> to create your first content batch.
            </p>
          </div>
        )}

        {!generating && brands.length === 0 && (
          <div className="py-20 text-center">
            <p className="text-5xl">🏗️</p>
            <p className="mt-4 text-base font-medium text-zinc-300">
              Set up your first brand to get started
            </p>
            <button
              type="button"
              onClick={() => router.push("/brand-setup")}
              className="mt-4 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              Set up a brand →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Export — Suspense wrapper required for useSearchParams in Next.js 15
// ---------------------------------------------------------------------------

export default function BatchReviewPage() {
  return (
    <Suspense>
      <BatchReviewInner />
    </Suspense>
  );
}
