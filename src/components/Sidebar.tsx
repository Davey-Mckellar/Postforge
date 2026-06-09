"use client";

import { useEffect, useState } from "react";
import type { AgentMemory } from "@/lib/agent-memory";
import { loadMemory, saveMemory } from "@/lib/agent-memory";
import type { Conversation } from "@/lib/types";
import type { UiPreferences } from "@/lib/ui-preferences";

type Tab = "chats" | "memory";

export function Sidebar({
  conversations,
  activeId,
  onNew,
  onSelect,
  onDelete,
  appearance = "dark",
  className = "",
  onNavigate,
}: {
  conversations: Conversation[];
  activeId: string | null;
  onNew: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  appearance?: UiPreferences["appearance"];
  /** Merged onto the root panel (e.g. `w-full` inside a mobile drawer). */
  className?: string;
  /** Called after choosing a chat or starting a new one (e.g. close mobile drawer). */
  onNavigate?: () => void;
}) {
  const [tab, setTab] = useState<Tab>("chats");
  const [memory, setMemory] = useState<AgentMemory | null>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate memory editor from localStorage */
    setMemory(loadMemory());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!memory) return;
    saveMemory(memory);
  }, [memory]);

  const shell =
    appearance === "light"
      ? "border-zinc-200 bg-white/95"
      : appearance === "oled"
        ? "border-zinc-800 bg-black/50"
        : "border-zinc-900 bg-zinc-950/40";
  const hairline =
    appearance === "light" ? "border-zinc-200" : appearance === "oled" ? "border-zinc-800" : "border-zinc-900";
  const tabActive =
    appearance === "light"
      ? "bg-zinc-200 text-zinc-900 ring-1 ring-zinc-300"
      : "bg-zinc-900 text-zinc-100 ring-1 ring-zinc-800";
  const tabIdle = appearance === "light" ? "text-zinc-500" : "text-zinc-500";
  const rowHover = appearance === "light" ? "hover:bg-zinc-100" : "hover:bg-zinc-900/60";
  const rowActive =
    appearance === "light"
      ? "bg-zinc-200 text-zinc-900 ring-1 ring-zinc-300"
      : "bg-zinc-900 text-zinc-100 ring-1 ring-zinc-800";
  const rowText = appearance === "light" ? "text-zinc-800" : "text-zinc-300";

  return (
    <aside
      className={`flex h-full min-h-0 w-[min(13.5rem,30vw)] shrink-0 flex-col border-r sm:w-52 ${shell} ${className}`.trim()}
    >
      <div className={`flex border-b ${hairline} p-2`}>
        <button
          type="button"
          className={`min-h-11 flex-1 rounded-xl px-2 py-2.5 text-xs font-semibold sm:min-h-10 sm:py-2 ${tab === "chats" ? tabActive : tabIdle}`}
          onClick={() => setTab("chats")}
        >
          Chats
        </button>
        <button
          type="button"
          className={`min-h-11 flex-1 rounded-xl px-2 py-2.5 text-xs font-semibold sm:min-h-10 sm:py-2 ${tab === "memory" ? tabActive : tabIdle}`}
          onClick={() => setTab("memory")}
        >
          Memory
        </button>
      </div>

      {tab === "chats" ? (
        <>
          <div className={`border-b ${hairline} p-3`}>
            <button
              type="button"
              onClick={() => {
                onNew();
                onNavigate?.();
              }}
              className={`min-h-12 w-full rounded-xl px-3 py-3 text-sm font-semibold sm:min-h-10 sm:py-2 ${
                appearance === "light"
                  ? "bg-zinc-900 text-white hover:bg-zinc-700"
                  : "bg-emerald-600 text-white hover:bg-emerald-500"
              }`}
            >
              + New chat
            </button>
          </div>
          <div className="flex-1 overflow-auto p-2">
            {conversations.map((c) => (
              <div key={c.id} className="group mb-1 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    onSelect(c.id);
                    onNavigate?.();
                  }}
                  className={`min-h-11 min-w-0 flex-1 truncate rounded-xl px-3 py-2.5 text-left text-sm sm:min-h-10 sm:py-2 ${
                    c.id === activeId ? rowActive : `${rowText} ${rowHover}`
                  }`}
                >
                  {c.title || "Untitled"}
                </button>
                <button
                  type="button"
                  title="Delete"
                  aria-label={`Delete chat ${c.title || "Untitled"}`}
                  className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-sm leading-none md:hidden ${
                    appearance === "light"
                      ? "text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800"
                      : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
                  }`}
                  onClick={() => onDelete(c.id)}
                >
                  ×
                </button>
                <button
                  type="button"
                  title="Delete"
                  aria-label={`Delete chat ${c.title || "Untitled"}`}
                  className={`hidden min-h-10 min-w-10 shrink-0 items-center justify-center rounded-lg text-xs md:inline-flex md:opacity-0 md:transition-opacity md:group-hover:opacity-100 ${
                    appearance === "light"
                      ? "text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800"
                      : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
                  }`}
                  onClick={() => onDelete(c.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-auto p-3 text-sm">
          {!memory ? (
            <div className="text-xs text-zinc-500">Loading…</div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-zinc-500">
                Persistent memory (local). Injected into system prompts alongside DNA-style routing.
              </p>
              <label className="block text-xs text-zinc-400">
                Preferences (one per line)
                <textarea
                  className="mt-1 w-full rounded-xl bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800"
                  rows={3}
                  value={memory.preferences.join("\n")}
                  onChange={(e) =>
                    setMemory({
                      ...memory,
                      preferences: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                    })
                  }
                />
              </label>
              <label className="block text-xs text-zinc-400">
                Style notes
                <textarea
                  className="mt-1 w-full rounded-xl bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800"
                  rows={3}
                  value={memory.styleNotes.join("\n")}
                  onChange={(e) =>
                    setMemory({
                      ...memory,
                      styleNotes: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                    })
                  }
                />
              </label>
              <label className="block text-xs text-zinc-400">
                Ongoing tasks
                <textarea
                  className="mt-1 w-full rounded-xl bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800"
                  rows={3}
                  value={memory.ongoingTasks.join("\n")}
                  onChange={(e) =>
                    setMemory({
                      ...memory,
                      ongoingTasks: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                    })
                  }
                />
              </label>
            </div>
          )}
        </div>
      )}

      {/* Content Planner shortcut */}
      <div className={`border-t ${hairline} px-2 py-2`}>
        <a
          href="/batch-review"
          className={`flex min-h-10 w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
            appearance === "light"
              ? "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-200"
          }`}
        >
          <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
            <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
          </svg>
          Content Planner
        </a>
      </div>

      <div
        className={`border-t ${hairline} p-3 text-[11px] ${appearance === "light" ? "text-zinc-600" : "text-zinc-600"}`}
      >
        History uses <span className={appearance === "light" ? "text-zinc-500" : "text-zinc-400"}>bbgpt_</span> keys
      </div>
    </aside>
  );
}
