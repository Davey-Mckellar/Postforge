"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { useDialogA11y } from "@/hooks/useDialogA11y";
import {
  loadUiPreferences,
  saveUiPreferences,
  tryEnableDesktopNotifications,
  type UiPreferences,
} from "@/lib/ui-preferences";
import {
  addTimeCapsule,
  listTimeCapsules,
  removeTimeCapsule,
  type TimeCapsule,
} from "@/lib/time-capsule";
import { getUiDiagnosticsEnabled, setUiDiagnosticsEnabled } from "@/lib/ui-diagnostics";

export function SettingsPanel({
  open,
  onClose,
  onPreferencesSaved,
  introIntakeComplete,
  onRedoConnectionQuestionnaire,
}: {
  open: boolean;
  onClose: () => void;
  /** Called after user saves so parent can re-apply theme/font. */
  onPreferencesSaved: (p: UiPreferences) => void;
  /** When true, user may redo the blocking seven-question connection flow from Settings. */
  introIntakeComplete?: boolean;
  /** Clears saved intake and reopens the questionnaire modal. */
  onRedoConnectionQuestionnaire?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogA11y(open, ref, onClose);

  const [prefs, setPrefs] = useState<UiPreferences>(loadUiPreferences);
  const [capsules, setCapsules] = useState<TimeCapsule[]>([]);
  const [capMessage, setCapMessage] = useState("");
  const [capDate, setCapDate] = useState("");
  const [uiDiagLog, setUiDiagLog] = useState(false);

  useEffect(() => {
    if (!open) return;
    startTransition(() => {
      setPrefs(loadUiPreferences());
      setCapsules(listTimeCapsules());
      setUiDiagLog(getUiDiagnosticsEnabled());
    });
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-auto bg-black/60 p-4 pt-16 backdrop-blur-sm">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bbgpt-settings-title"
        className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl ring-1 ring-white/5"
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <h2 id="bbgpt-settings-title" className="text-sm font-semibold text-zinc-100">
            Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
          >
            Close
          </button>
        </div>

        <div className="max-h-[min(80vh,720px)] space-y-6 overflow-y-auto px-4 py-4">
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Appearance</h3>
            <label className="mt-2 block text-xs text-zinc-400">
              Font size ({Math.round(prefs.fontScale * 100)}%)
              <input
                type="range"
                min={85}
                max={135}
                step={5}
                value={Math.round(prefs.fontScale * 100)}
                onChange={(e) =>
                  setPrefs((p) => ({ ...p, fontScale: Number(e.target.value) / 100 }))
                }
                className="mt-2 w-full accent-cyan-500"
              />
            </label>
            <label className="mt-3 block text-xs text-zinc-400">
              Color shell
              <select
                value={prefs.appearance}
                onChange={(e) =>
                  setPrefs((p) => ({
                    ...p,
                    appearance: e.target.value as UiPreferences["appearance"],
                  }))
                }
                className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              >
                <option value="dark">Dark (default)</option>
                <option value="oled">OLED black</option>
                <option value="light">Light</option>
              </select>
            </label>
          </section>

          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Diagnostics</h3>
            <p className="mt-1 text-[11px] leading-snug text-zinc-500">
              When enabled, header controls and chat sends log structured lines to the browser console (
              <span className="font-mono text-zinc-400">[bbGPT UI]</span>
              ). Also set <span className="font-mono text-zinc-400">NEXT_PUBLIC_UI_DIAGNOSTICS=true</span> at build
              time to default on.
            </p>
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
              <input
                type="checkbox"
                checked={uiDiagLog}
                onChange={(e) => {
                  const on = e.target.checked;
                  setUiDiagnosticsEnabled(on);
                  setUiDiagLog(on);
                }}
                className="rounded border-zinc-600"
              />
              Log UI control &amp; send diagnostics
            </label>
          </section>

          {introIntakeComplete && onRedoConnectionQuestionnaire ? (
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Connection</h3>
              <p className="mt-1 text-[11px] leading-snug text-zinc-500">
                You completed the seven-question intake at first launch. Redo clears those answers and the
                companion-intake block in local memory, then walks you through again before you can chat.
              </p>
              <button
                type="button"
                onClick={onRedoConnectionQuestionnaire}
                className="mt-2 rounded-lg bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-200 ring-1 ring-zinc-700 hover:bg-zinc-700"
              >
                Redo connection questionnaire
              </button>
            </section>
          ) : null}

          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Notifications</h3>
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
              <input
                type="checkbox"
                checked={prefs.notificationsEnabled}
                onChange={(e) => setPrefs((p) => ({ ...p, notificationsEnabled: e.target.checked }))}
                className="rounded border-zinc-600"
              />
              Desktop notifications for reminders & suggestions (browser permission)
            </label>
            {prefs.notificationsEnabled ? (
              <button
                type="button"
                className="mt-2 rounded-lg bg-zinc-800 px-3 py-1.5 text-[11px] font-medium text-zinc-200 ring-1 ring-zinc-700 hover:bg-zinc-700"
                onClick={async () => {
                  const perm = await tryEnableDesktopNotifications();
                  if (perm !== "granted") {
                    alert(
                      perm === "denied"
                        ? "Notifications blocked in browser settings."
                        : "Permission was not granted.",
                    );
                  }
                }}
              >
                Request browser permission now
              </button>
            ) : null}
          </section>

          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Time capsule</h3>
            <p className="mt-1 text-[11px] leading-snug text-zinc-500">
              Save a note to your future self. When the time passes, bbGPT shows it in a popup (stored in this
              browser only).
            </p>
            <textarea
              value={capMessage}
              onChange={(e) => setCapMessage(e.target.value)}
              placeholder="Message to future you…"
              rows={3}
              className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600"
            />
            <label className="mt-2 block text-xs text-zinc-400">
              Reveal at (local time)
              <input
                type="datetime-local"
                value={capDate}
                onChange={(e) => setCapDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              />
            </label>
            <button
              type="button"
              disabled={!capMessage.trim() || !capDate}
              onClick={() => {
                const revealAt = new Date(capDate).getTime();
                if (!Number.isFinite(revealAt) || revealAt <= Date.now()) {
                  alert("Pick a future date and time.");
                  return;
                }
                addTimeCapsule({
                  id: uuidv4(),
                  message: capMessage.trim(),
                  revealAt,
                  createdAt: Date.now(),
                });
                setCapMessage("");
                setCapDate("");
                setCapsules(listTimeCapsules());
              }}
              className="mt-2 rounded-lg bg-cyan-900/40 px-3 py-1.5 text-xs font-semibold text-cyan-100 ring-1 ring-cyan-800/80 hover:bg-cyan-900/55 disabled:opacity-40"
            >
              Save capsule
            </button>
            {capsules.length > 0 ? (
              <ul className="mt-3 space-y-2 text-[11px] text-zinc-400">
                {capsules.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-start justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-2 py-2"
                  >
                    <span className="min-w-0 break-words">
                      {new Date(c.revealAt).toLocaleString()}: {c.message.slice(0, 120)}
                      {c.message.length > 120 ? "…" : ""}
                    </span>
                    <button
                      type="button"
                      className="shrink-0 text-red-400 hover:underline"
                      onClick={() => {
                        removeTimeCapsule(c.id);
                        setCapsules(listTimeCapsules());
                      }}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Chat Backup</h3>
            <p className="mt-1 text-[11px] leading-snug text-zinc-500">
              Your conversations are saved in this browser only. Export a JSON backup so you never lose them — and
              restore anytime by importing it.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  try {
                    const raw = localStorage.getItem("bbgpt_conversations") ?? "[]";
                    const blob = new Blob([raw], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `bbgpt-chats-${new Date().toISOString().slice(0, 10)}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  } catch (e) {
                    alert("Export failed: " + String(e));
                  }
                }}
                className="rounded-lg bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-200 ring-1 ring-zinc-700 hover:bg-zinc-700"
              >
                ↓ Export chats
              </button>
              <label className="cursor-pointer rounded-lg bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-200 ring-1 ring-zinc-700 hover:bg-zinc-700">
                ↑ Import chats
                <input
                  type="file"
                  accept=".json"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      try {
                        const incoming = JSON.parse(reader.result as string) as Array<{ id: string }>;
                        if (!Array.isArray(incoming)) throw new Error("Expected an array");
                        const existingRaw = localStorage.getItem("bbgpt_conversations") ?? "[]";
                        const existing = JSON.parse(existingRaw) as Array<{ id: string }>;
                        const existingIds = new Set(existing.map((c) => c.id));
                        const merged = [...existing, ...incoming.filter((c) => !existingIds.has(c.id))];
                        localStorage.setItem("bbgpt_conversations", JSON.stringify(merged));
                        alert(`Imported ${incoming.length - (incoming.length - merged.length + existing.length)} new conversations. Refresh to see them.`);
                      } catch (err) {
                        alert("Import failed — invalid file: " + String(err));
                      }
                    };
                    reader.readAsText(file);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </section>

          <div className="flex justify-end gap-2 border-t border-zinc-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-2 text-xs text-zinc-400 hover:bg-zinc-900"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                saveUiPreferences(prefs);
                onPreferencesSaved(prefs);
                onClose();
              }}
              className="rounded-lg bg-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-white"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
