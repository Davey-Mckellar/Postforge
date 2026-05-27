"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { FILE_SIZE_PRESETS, nearestPresetBytes } from "@/lib/attachment-presets";
import { formatBytes } from "@/lib/file-attachments";
import { getInlineAttachmentMaxBytes } from "@/lib/attachment-config";
import { getSpeechRecognitionConstructor } from "@/lib/speech-recognition";
import { CHAT_COLUMN_CLASS } from "@/lib/chat-layout";
import { VoiceModeOverlay } from "./VoiceModeOverlay";

export function ChatInput({
  disabled,
  onSend,
  skillSuggestion,
  onUseSkill,
  onDraftChange,
  value: controlledValue,
  onValueChange,
  children,
  pendingFiles,
  onPendingFilesChange,
  onGenerateImage,
  imagePromptExtra = "",
  onImagePromptExtraChange,
  geminiEnabled,
  readAloud,
  onReadAloudChange,
  attachmentLimitBytes,
  onAttachmentLimitChange,
}: {
  disabled?: boolean;
  onSend: (text: string) => void | Promise<void>;
  skillSuggestion?: { name: string } | null;
  onUseSkill?: () => void;
  onDraftChange?: (text: string) => void;
  /** Controlled input (templates, sync with parent mood/cost preview) */
  value?: string;
  onValueChange?: (text: string) => void;
  /** e.g. CostPreview above the textarea */
  children?: ReactNode;
  pendingFiles: File[];
  onPendingFilesChange: (files: File[]) => void;
  /** Opens Gemini image generation (requires GEMINI_API_KEY on server). */
  onGenerateImage?: () => void;
  /** When the main composer is empty, user can type here for image-only generation. */
  imagePromptExtra?: string;
  onImagePromptExtraChange?: (v: string) => void;
  geminiEnabled?: boolean;
  /** When true, new assistant replies are read with browser text-to-speech after streaming completes. */
  readAloud?: boolean;
  onReadAloudChange?: (next: boolean) => void;
  /** Effective per-file max (from env + user preset in localStorage). */
  attachmentLimitBytes: number;
  onAttachmentLimitChange: (bytes: number) => void;
}) {
  const [internal, setInternal] = useState("");
  const controlled = controlledValue !== undefined;
  const value = controlled ? controlledValue! : internal;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<SpeechRecognition | null>(null);
  const valueRef = useRef("");
  const [listening, setListening] = useState(false);
  const [voicePanelOpen, setVoicePanelOpen] = useState(false);
  const [interimText, setInterimText] = useState("");
  const inlineMax = getInlineAttachmentMaxBytes();
  /** Browser-only API: server snapshot null, client uses live constructor after hydration. */
  const voiceCtor = useSyncExternalStore(
    () => () => {
      /* no external store; capability is fixed per document */
    },
    () => getSpeechRecognitionConstructor(),
    () => null,
  );

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const setValue = useCallback(
    (next: string) => {
      if (controlled) onValueChange?.(next);
      else setInternal(next);
      onDraftChange?.(next);
    },
    [controlled, onDraftChange, onValueChange],
  );

  const stopVoice = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    recRef.current = null;
    setListening(false);
    setInterimText("");
  }, []);

  useEffect(() => () => stopVoice(), [stopVoice]);

  const startVoice = useCallback(() => {
    const Ctor = getSpeechRecognitionConstructor();
    if (!Ctor || disabled) return;
    stopVoice();
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = typeof navigator !== "undefined" ? navigator.language : "en-US";
    rec.onresult = (ev: SpeechRecognitionEvent) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (!r?.[0]) continue;
        const t = r[0].transcript;
        if (r.isFinal && t.trim()) {
          const cur = valueRef.current.trim();
          const sep = cur && !cur.endsWith(" ") ? " " : "";
          setValue(`${cur}${sep}${t.trim()}`);
        }
      }
      let interimBuf = "";
      for (let i = 0; i < ev.results.length; i++) {
        if (!ev.results[i].isFinal) interimBuf += ev.results[i][0]?.transcript ?? "";
      }
      setInterimText(interimBuf.trim());
    };
    rec.onerror = () => {
      stopVoice();
      setVoicePanelOpen(false);
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
    };
    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      stopVoice();
      setVoicePanelOpen(false);
    }
  }, [disabled, setValue, stopVoice]);

  function openVoiceMode() {
    if (!voiceCtor || disabled) return;
    setVoicePanelOpen(true);
    startVoice();
  }

  function closeVoiceMode() {
    stopVoice();
    setVoicePanelOpen(false);
  }

  async function submit() {
    const t = value.trim();
    if ((!t && pendingFiles.length === 0) || disabled) return;
    setValue("");
    await onSend(t);
  }

  const maxBytes = attachmentLimitBytes;
  const presetSelectBytes = nearestPresetBytes(attachmentLimitBytes);

  const col = CHAT_COLUMN_CLASS;

  return (
    <div className="bbgpt-chat-input-dock shrink-0 border-t border-zinc-900 bg-zinc-950/40 px-2 py-2 sm:px-3">
      <VoiceModeOverlay
        open={voicePanelOpen}
        listening={listening}
        interimText={interimText}
        readAloud={readAloud}
        onReadAloudChange={onReadAloudChange}
        onDone={closeVoiceMode}
      />

      {children}
      {skillSuggestion ? (
        <div
          className={`mb-1.5 flex items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 px-2.5 py-1.5 text-xs text-zinc-400 ${col}`}
        >
          <span>
            Use skill: <span className="text-zinc-200">{skillSuggestion.name}</span>?
          </span>
          <button
            type="button"
            className="min-h-11 shrink-0 rounded-lg bg-zinc-900 px-3 py-2 text-[11px] font-semibold text-cyan-300 ring-1 ring-zinc-800 hover:bg-zinc-800 sm:min-h-10"
            onClick={() => onUseSkill?.()}
          >
            Activate
          </button>
        </div>
      ) : null}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const list = e.target.files;
          if (!list?.length) return;
          onPendingFilesChange([...pendingFiles, ...Array.from(list)]);
          e.target.value = "";
        }}
      />
      {pendingFiles.length > 0 ? (
        <div className={`mb-1.5 flex flex-wrap gap-1.5 ${col}`}>
          {pendingFiles.map((f, i) => (
            <span
              key={`${f.name}-${i}`}
              className="inline-flex items-center gap-1 rounded-full bg-zinc-900 px-2 py-1 text-[11px] text-zinc-300 ring-1 ring-zinc-800"
            >
              <span className="max-w-[200px] truncate">{f.name}</span>
              <span className="text-zinc-500">({formatBytes(f.size)})</span>
              <button
                type="button"
                className="-mr-1 inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-200"
                onClick={() => onPendingFilesChange(pendingFiles.filter((_, j) => j !== i))}
                aria-label="Remove file"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {/* Attach + max size + create image on one row */}
      <div className={`mb-1.5 flex flex-wrap items-center gap-1.5 text-[11px] ${col}`}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-zinc-900/90 px-3 py-2 font-medium text-zinc-200 ring-1 ring-zinc-800 hover:bg-zinc-800 disabled:opacity-40 sm:min-h-10 sm:px-2.5 sm:py-1.5"
          title={`Add files (max ${formatBytes(maxBytes)} each)`}
        >
          <span className="text-sm leading-none text-zinc-400">+</span>
          Attach
        </button>
        <label className="inline-flex items-center gap-1.5 text-zinc-500">
          <span className="hidden sm:inline">Max</span>
          <select
            disabled={disabled}
            value={presetSelectBytes}
            onChange={(e) => onAttachmentLimitChange(Number(e.target.value))}
            className="min-h-11 cursor-pointer rounded-lg border-0 bg-zinc-900/90 py-2 pl-2 pr-7 text-[11px] font-medium text-zinc-300 ring-1 ring-zinc-800 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 disabled:opacity-40 sm:min-h-10 sm:py-1.5"
            title="Per-file size limit (stored on this device)"
          >
            {FILE_SIZE_PRESETS.map((p) => (
              <option key={p.id} value={p.bytes}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        {onGenerateImage && geminiEnabled ? (
          <>
            <input
              type="text"
              value={imagePromptExtra}
              onChange={(e) => onImagePromptExtraChange?.(e.target.value)}
              disabled={disabled}
              placeholder="Image prompt…"
              className="min-h-11 min-w-0 max-w-[200px] flex-1 rounded-lg border-0 bg-zinc-900/90 px-2 py-2 text-[11px] text-zinc-200 ring-1 ring-zinc-800 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/25 disabled:opacity-40 sm:max-w-xs sm:py-1.5"
              title="Optional: describe the image here if you do not want to use the main message box above"
              aria-label="Image generation prompt"
            />
            <button
              type="button"
              disabled={disabled}
              onClick={onGenerateImage}
              className="min-h-11 rounded-lg bg-fuchsia-950/50 px-3 py-2 text-[11px] font-semibold text-fuchsia-100/95 ring-1 ring-fuchsia-900/60 hover:bg-fuchsia-950/80 disabled:opacity-40 sm:min-h-10 sm:px-2.5 sm:py-1.5"
              title="Generate an image with Gemini (uses one chat credit; needs GEMINI_API_KEY on the server)"
            >
              Create image
            </button>
          </>
        ) : null}
      </div>

      <div className={`flex flex-wrap items-end gap-1.5 ${col}`}>
        <textarea
          value={value}
          disabled={disabled}
          onChange={(e) => {
            setValue(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          rows={3}
          placeholder="Message bbGPT…"
          className="min-h-[64px] min-w-0 flex-1 resize-y rounded-2xl bg-zinc-900/60 px-4 py-3 text-base leading-relaxed text-zinc-100 outline-none ring-1 ring-zinc-800 placeholder:text-zinc-500 focus:ring-cyan-500/30 disabled:opacity-50 sm:min-h-[56px]"
        />

        {/* ChatGPT-style circular voice control */}
        <button
          type="button"
          disabled={disabled || !voiceCtor}
          onClick={openVoiceMode}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition sm:h-12 sm:w-12 ${
            voicePanelOpen
              ? "border-cyan-500/60 bg-cyan-950/50 text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.25)]"
              : "border-zinc-700 bg-zinc-900/80 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800"
          } disabled:cursor-not-allowed disabled:opacity-40`}
          title={
            voiceCtor
              ? "Voice dictation — opens the voice panel; speak to insert text into the message box"
              : "Voice dictation is not supported in this browser"
          }
          aria-label={voicePanelOpen ? "Voice panel open" : "Open voice dictation"}
          aria-pressed={voicePanelOpen}
        >
          <svg className="h-5 w-5 sm:h-6 sm:w-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.7z" />
          </svg>
        </button>

        <button
          type="button"
          disabled={disabled || (!value.trim() && pendingFiles.length === 0)}
          onClick={() => void submit()}
          className="h-12 shrink-0 rounded-2xl bg-emerald-600 px-5 text-base font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40 sm:h-[58px] sm:px-6"
        >
          Send
        </button>
      </div>

      <div
        className={`mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-zinc-900/80 pt-1.5 text-[10px] text-zinc-600 ${col}`}
      >
        <p
          className="min-w-0 flex-1 leading-snug"
          title={`Enter sends · Shift+Enter newline · Inline attach up to ${formatBytes(inlineMax)} · Max per file from menu above · Host may cap lower`}
        >
          <span className="text-zinc-500">Enter</span> send · <span className="text-zinc-500">Shift+Enter</span> newline ·
          Inline cap {formatBytes(inlineMax)}
        </p>
        {onReadAloudChange ? (
          <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-zinc-500 hover:text-zinc-400">
            <input
              type="checkbox"
              checked={readAloud ?? false}
              onChange={(e) => onReadAloudChange(e.target.checked)}
              className="rounded border-zinc-700 bg-zinc-900 accent-cyan-600"
            />
            Read aloud
          </label>
        ) : null}
      </div>
    </div>
  );
}
