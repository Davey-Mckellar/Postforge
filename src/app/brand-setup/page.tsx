"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { VoiceProfile } from "@/lib/voice-profile";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FormState {
  brandName: string;
  audience: string;        // Q2: who + niche (rich text)
  pillars: string[];       // Q3: content topics (tags)
  tone: string;            // Q4: voice + what to avoid
}

const PILLAR_SUGGESTIONS = [
  "Education",
  "Inspiration",
  "Behind-the-Scenes",
  "Promotion",
  "Community",
  "Tips & Tricks",
  "Product Features",
  "Customer Stories",
  "Entertainment",
  "News & Trends",
];

const STEPS = [
  { id: 1, label: "Brand Identity" },
  { id: 2, label: "Your Audience" },
  { id: 3, label: "Content Pillars" },
  { id: 4, label: "Brand Voice" },
];

// ---------------------------------------------------------------------------
// Pill tag input
// ---------------------------------------------------------------------------

function PillarInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
}) {
  const [input, setInput] = useState("");

  function addTag(tag: string) {
    const clean = tag.trim();
    if (!clean || value.includes(clean)) return;
    onChange([...value, clean]);
    setInput("");
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  return (
    <div className="space-y-3">
      {/* Selected tags */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-900/40 px-3 py-1.5 text-sm font-medium text-emerald-300 ring-1 ring-emerald-700/50"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="flex h-4 w-4 items-center justify-center rounded-full text-emerald-400 hover:bg-emerald-800/60 hover:text-white"
                aria-label={`Remove ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Custom input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addTag(input);
            }
          }}
          placeholder="Type a topic and press Enter…"
          className="min-w-0 flex-1 rounded-xl border-0 bg-zinc-900/70 px-4 py-3 text-base text-zinc-100 ring-1 ring-zinc-800 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
        />
        <button
          type="button"
          onClick={() => addTag(input)}
          disabled={!input.trim()}
          className="rounded-xl bg-zinc-800 px-4 py-3 text-sm font-medium text-zinc-300 ring-1 ring-zinc-700 hover:bg-zinc-700 disabled:opacity-40"
        >
          Add
        </button>
      </div>

      {/* Suggestion chips */}
      <div className="flex flex-wrap gap-2">
        {PILLAR_SUGGESTIONS.filter((s) => !value.includes(s)).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => addTag(s)}
            className="rounded-full border border-zinc-700 bg-zinc-900/50 px-3 py-1 text-xs text-zinc-400 hover:border-emerald-700/60 hover:bg-emerald-900/20 hover:text-emerald-300"
          >
            + {s}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function BrandSetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    brandName: "",
    audience: "",
    pillars: [],
    tone: "",
  });

  const update = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Validation per step
  const isStepValid = useCallback(() => {
    switch (step) {
      case 1: return form.brandName.trim().length >= 2;
      case 2: return form.audience.trim().length >= 20;
      case 3: return form.pillars.length >= 2;
      case 4: return form.tone.trim().length >= 20;
      default: return false;
    }
  }, [step, form]);

  async function handleSubmit() {
    setSaving(true);
    setError(null);

    try {
      // Build VoiceProfile from form fields
      const voiceProfile: VoiceProfile = {
        audience: form.audience.trim(),
        pillars: form.pillars,
        tone: form.tone.trim(),
      };

      // POST to create brand
      const res = await fetch("/api/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.brandName.trim(),
          voiceProfile,
        }),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to save brand");
      }

      const { brand } = (await res.json()) as { brand: { id: string } };

      // Redirect to batch review with new brand pre-selected
      router.push(`/batch-review?brandId=${brand.id}&fresh=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  }

  function nextStep() {
    if (!isStepValid()) return;
    if (step === 4) {
      void handleSubmit();
    } else {
      setStep((s) => s + 1);
    }
  }

  function prevStep() {
    setStep((s) => Math.max(1, s - 1));
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-950 px-4 py-12 sm:py-20">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 sm:text-3xl">
            Set up your brand
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Four quick questions — your AI content engine needs to know your voice.
          </p>
        </div>

        {/* Step indicator */}
        <div className="mb-8 flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex flex-1 flex-col items-center gap-1.5">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-all ${
                  s.id < step
                    ? "bg-emerald-600 text-white"
                    : s.id === step
                    ? "bg-emerald-500 text-white ring-4 ring-emerald-500/25"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                {s.id < step ? (
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  s.id
                )}
              </div>
              <span
                className={`hidden text-[10px] font-medium sm:block ${
                  s.id === step ? "text-emerald-400" : "text-zinc-600"
                }`}
              >
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <div
                  className={`absolute ml-[calc(50%+16px)] hidden h-px w-[calc(25%-18px)] sm:block ${
                    s.id < step ? "bg-emerald-700" : "bg-zinc-800"
                  }`}
                  style={{ position: "relative", top: -28, left: "50%", width: "100%" }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-zinc-900/80 p-6 ring-1 ring-zinc-800 sm:p-8">
          {/* Step 1 — Brand name */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-base font-semibold text-zinc-100">
                  What&apos;s your brand called?
                </label>
                <p className="mt-1 text-sm text-zinc-400">
                  This is the name your audience knows you by.
                </p>
              </div>
              <input
                type="text"
                autoFocus
                value={form.brandName}
                onChange={(e) => update("brandName", e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && nextStep()}
                placeholder="e.g. Sana Wellness Co."
                className="w-full rounded-xl border-0 bg-zinc-800/70 px-4 py-3.5 text-base text-zinc-100 ring-1 ring-zinc-700 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
            </div>
          )}

          {/* Step 2 — Audience + niche */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-base font-semibold text-zinc-100">
                  Who are you talking to, and what space are you in?
                </label>
                <p className="mt-1 text-sm text-zinc-400">
                  Describe your ideal customer and the industry or niche you operate in.
                </p>
              </div>
              <textarea
                autoFocus
                rows={4}
                value={form.audience}
                onChange={(e) => update("audience", e.target.value)}
                placeholder="e.g. Health-conscious women aged 25–40 looking to simplify their morning routines. I operate in the wellness and nutrition space, focusing on sustainable habits rather than crash diets."
                className="w-full resize-none rounded-xl border-0 bg-zinc-800/70 px-4 py-3.5 text-base leading-relaxed text-zinc-100 ring-1 ring-zinc-700 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
              <p className="text-xs text-zinc-500">
                {form.audience.trim().length} chars — at least 20 to continue
              </p>
            </div>
          )}

          {/* Step 3 — Content pillars */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-base font-semibold text-zinc-100">
                  What 3–5 topics do you consistently post about?
                </label>
                <p className="mt-1 text-sm text-zinc-400">
                  Pick from the suggestions or add your own. These become your content pillars — the AI will spread posts evenly across them.
                </p>
              </div>
              <PillarInput value={form.pillars} onChange={(tags) => update("pillars", tags)} />
              <p className="text-xs text-zinc-500">
                {form.pillars.length} selected — pick at least 2
              </p>
            </div>
          )}

          {/* Step 4 — Brand voice */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <label className="block text-base font-semibold text-zinc-100">
                  How does your brand sound?
                </label>
                <p className="mt-1 text-sm text-zinc-400">
                  Describe your tone and style. Include what it should <em>never</em> sound like if that matters to you.
                </p>
              </div>
              <textarea
                autoFocus
                rows={4}
                value={form.tone}
                onChange={(e) => update("tone", e.target.value)}
                placeholder="e.g. Warm, conversational, and empowering — like a knowledgeable friend who happens to be a nutritionist. Never clinical or preachy. Light humour is fine but keep it grounded."
                className="w-full resize-none rounded-xl border-0 bg-zinc-800/70 px-4 py-3.5 text-base leading-relaxed text-zinc-100 ring-1 ring-zinc-700 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
              <p className="text-xs text-zinc-500">
                {form.tone.trim().length} chars — at least 20 to continue
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="mt-4 rounded-lg bg-red-900/30 px-4 py-3 text-sm text-red-400 ring-1 ring-red-800/50">
              {error}
            </p>
          )}

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={prevStep}
              disabled={step === 1}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-400 hover:text-zinc-200 disabled:pointer-events-none disabled:opacity-0"
            >
              ← Back
            </button>

            <div className="flex items-center gap-2">
              {/* Dot progress */}
              {STEPS.map((s) => (
                <div
                  key={s.id}
                  className={`h-1.5 rounded-full transition-all ${
                    s.id === step
                      ? "w-6 bg-emerald-500"
                      : s.id < step
                      ? "w-1.5 bg-emerald-800"
                      : "w-1.5 bg-zinc-700"
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={nextStep}
              disabled={!isStepValid() || saving}
              className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving
                ? "Saving…"
                : step === 4
                ? "Generate my 30 posts →"
                : "Continue →"}
            </button>
          </div>
        </div>

        {/* Skip / later */}
        <p className="mt-6 text-center text-xs text-zinc-600">
          Already have a brand?{" "}
          <button
            type="button"
            onClick={() => router.push("/batch-review")}
            className="text-zinc-400 underline underline-offset-2 hover:text-zinc-200"
          >
            Go to Batch Review
          </button>
        </p>
      </div>
    </div>
  );
}
