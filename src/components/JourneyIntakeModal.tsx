"use client";

import { useCallback, useMemo, useState } from "react";
import { JOURNEY_SEVEN_QUESTIONS } from "@/lib/companion-onboarding";
import { INTRO_INTAKE_MIN_CHARS } from "@/lib/onboarding-intake-storage";

export function JourneyIntakeModal({
  appearance,
  onComplete,
  onSkip,
}: {
  appearance: "light" | "dark" | "oled";
  onComplete: (answers: string[]) => void;
  onSkip: () => void;
}) {
  const theme = appearance === "light" ? "light" : "dark";
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>(() => JOURNEY_SEVEN_QUESTIONS.map(() => ""));
  const [touched, setTouched] = useState(false);

  const question = JOURNEY_SEVEN_QUESTIONS[step]!;
  const value = answers[step] ?? "";
  const validLength = value.trim().length >= INTRO_INTAKE_MIN_CHARS;
  const isLast = step === JOURNEY_SEVEN_QUESTIONS.length - 1;

  const panelClass =
    theme === "light"
      ? "border-zinc-200 bg-white text-zinc-900 ring-zinc-300/80"
      : "border-zinc-800 bg-zinc-950 text-zinc-100 ring-zinc-800/80";

  const muted = theme === "light" ? "text-zinc-600" : "text-zinc-400";
  const inputClass =
    theme === "light"
      ? "border-zinc-300 bg-zinc-50 text-zinc-900 placeholder:text-zinc-400 focus:ring-cyan-600/40"
      : "border-zinc-700 bg-zinc-900/80 text-zinc-100 placeholder:text-zinc-600 focus:ring-cyan-500/35";

  const setCurrent = useCallback(
    (next: string) => {
      setAnswers((prev) => {
        const copy = [...prev];
        copy[step] = next;
        return copy;
      });
    },
    [step],
  );

  const goNext = useCallback(() => {
    setTouched(true);
    if (!validLength) return;
    if (isLast) {
      onComplete(answers.map((a, i) => (i === step ? value : a)));
      return;
    }
    setStep((s) => s + 1);
    setTouched(false);
  }, [answers, isLast, onComplete, step, validLength, value]);

  const goBack = useCallback(() => {
    setTouched(false);
    setStep((s) => Math.max(0, s - 1));
  }, []);

  const progress = useMemo(
    () => `${step + 1} / ${JOURNEY_SEVEN_QUESTIONS.length}`,
    [step],
  );

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center overflow-y-auto bg-black/70 p-0 backdrop-blur-sm md:items-center md:px-3 md:py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="journey-intake-title"
    >
      <div
        className={`flex w-full max-w-lg flex-col rounded-none border-0 p-5 shadow-2xl ring-1 md:rounded-2xl md:border ${panelClass}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide ${muted}`}>
              Journey questionnaire · {progress}
            </p>
            <h2 id="journey-intake-title" className="mt-1 text-lg font-semibold tracking-tight">
              Vision & direction
            </h2>
            <p className={`mt-2 text-xs leading-relaxed ${muted}`}>
              Seven questions about where you're headed — your mountaintop, your ideal life, your
              flow. These give bbGPT a sense of your bigger picture so responses can connect to what
              actually matters.
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all"
            style={{ width: `${((step + 1) / JOURNEY_SEVEN_QUESTIONS.length) * 100}%` }}
          />
        </div>

        <label className={`mt-5 block text-sm font-medium ${theme === "light" ? "text-zinc-800" : "text-zinc-200"}`}>
          {question}
        </label>
        <textarea
          value={value}
          onChange={(e) => setCurrent(e.target.value)}
          rows={5}
          className={`mt-2 w-full resize-y rounded-xl border px-3 py-2 text-sm outline-none ring-0 transition focus:ring-2 ${inputClass}`}
          placeholder="Describe it in your own words — a few sentences is great."
          autoComplete="off"
          autoFocus
        />
        {touched && !validLength ? (
          <p className="mt-1 text-[11px] text-amber-400/95">
            Add a bit more detail ({INTRO_INTAKE_MIN_CHARS}+ characters) so the model can hold your vision clearly.
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={step === 0 ? onSkip : goBack}
            className={`rounded-full px-4 py-2 text-xs font-medium ring-1 ${
              theme === "light"
                ? "bg-zinc-100 text-zinc-800 ring-zinc-300 hover:bg-zinc-200"
                : "bg-zinc-900 text-zinc-200 ring-zinc-700 hover:bg-zinc-800"
            }`}
          >
            {step === 0 ? "Skip for now" : "Back"}
          </button>
          <button
            type="button"
            onClick={goNext}
            className="rounded-full bg-cyan-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-cyan-900/30 hover:bg-cyan-500"
          >
            {isLast ? "Save my vision" : "Next question"}
          </button>
        </div>
      </div>
    </div>
  );
}
