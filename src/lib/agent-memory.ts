import { lsKey } from "./storage";
import type { Conversation } from "./types";
import { buildHolographicMessages } from "./holographic-context";

const KEY = lsKey("agent_memory_v1");

export type AgentMemory = {
  preferences: string[];
  styleNotes: string[];
  ongoingTasks: string[];
  topics: string[];
  technicalLevel: "beginner" | "intermediate" | "advanced" | "unknown";
  /** Seven-question companion intake (local), injected into memory prompt when present. */
  companionIntake?: string;
  /**
   * Brand voice profile from the Brand Setup wizard.
   * Pre-formatted string injected into every chat system prompt so the AI
   * always writes in the correct tone, for the correct audience, on the
   * correct content pillars.
   */
  brandContext?: string;
  updatedAt: number;
};

const DEFAULT_MEMORY: AgentMemory = {
  preferences: [],
  styleNotes: [],
  ongoingTasks: [],
  topics: [],
  technicalLevel: "unknown",
  updatedAt: Date.now(),
};

export function loadMemory(): AgentMemory {
  if (typeof window === "undefined") return DEFAULT_MEMORY;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_MEMORY;
    const parsed = JSON.parse(raw) as AgentMemory;
    return { ...DEFAULT_MEMORY, ...parsed };
  } catch {
    return DEFAULT_MEMORY;
  }
}

export function saveMemory(m: AgentMemory): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...m, updatedAt: Date.now() }));
  } catch {
    // ignore
  }
}

/** Persist structured answers from the blocking intro questionnaire into memory prompt context. */
export function setCompanionIntakeFromQuestionnaire(questions: string[], answers: string[]): void {
  const m = loadMemory();
  const block = questions
    .map((q, i) => `${i + 1}. ${q}\n→ ${(answers[i] ?? "").trim()}`)
    .join("\n\n");
  saveMemory({ ...m, companionIntake: block });
}

/** Removes questionnaire-derived intake from local memory (pair with `clearIntroIntake`). */
export function clearCompanionIntake(): void {
  const m = loadMemory();
  saveMemory({ ...m, companionIntake: undefined });
}

/**
 * Writes a formatted brand voice profile into persistent memory so every
 * subsequent chat request carries it in the system prompt.
 *
 * Call this immediately after creating or updating a brand via the wizard.
 */
export function setBrandContext(brandName: string, voiceProfile: {
  audience?: string;
  pillars?: string[];
  tone?: string;
  niche?: string;
  avoid?: string;
}): void {
  const lines: string[] = [
    `Brand: ${brandName}`,
  ];
  if (voiceProfile.audience) lines.push(`Audience & niche: ${voiceProfile.audience}`);
  if (voiceProfile.pillars?.length) lines.push(`Content pillars: ${voiceProfile.pillars.join(", ")}`);
  if (voiceProfile.tone) lines.push(`Voice & tone: ${voiceProfile.tone}`);
  if (voiceProfile.avoid) lines.push(`Avoid: ${voiceProfile.avoid}`);

  const m = loadMemory();
  saveMemory({ ...m, brandContext: lines.join("\n") });
}

/** Clears brand context from local memory (e.g. when brand is deleted). */
export function clearBrandContext(): void {
  const m = loadMemory();
  saveMemory({ ...m, brandContext: undefined });
}

function guessTechnicalLevel(text: string): AgentMemory["technicalLevel"] {
  const t = text.toLowerCase();
  const adv =
    /\b(kubernetes|terraform|rust|llvm|distributed|postgres internals)\b/.test(t) ||
    (t.match(/\b(api|async|typescript|react)\b/g) ?? []).length >= 4;
  const beg =
    /\b(new to|beginner|what is a|don't understand|simple terms)\b/.test(t) || text.length < 80;
  if (adv) return "advanced";
  if (beg) return "beginner";
  return "intermediate";
}

function extractTopics(text: string): string[] {
  const words = text.toLowerCase().match(/\b[a-z][a-z\-]{2,}\b/g) ?? [];
  const freq = new Map<string, number>();
  for (const w of words) {
    if (w.length < 4) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([w]) => w);
}

export function updateMemoryFromConversation(conv: Conversation): AgentMemory {
  const m = loadMemory();
  const last = [...conv.messages].reverse().find((x) => x.role === "user");
  if (!last) return m;
  const topics = extractTopics(last.content);
  const tech = guessTechnicalLevel(last.content);
  const mergedTopics = [...new Set([...m.topics, ...topics])].slice(0, 24);
  return {
    ...m,
    topics: mergedTopics,
    technicalLevel: tech === "unknown" ? m.technicalLevel : tech,
    updatedAt: Date.now(),
  };
}

function compactBlock(label: string, lines: string[], maxChars: number): string {
  const raw = lines.filter(Boolean).join(" · ");
  if (raw.length <= maxChars) return `${label}: ${raw}`;
  return `${label}: ${raw.slice(0, maxChars)}…`;
}

export function generateMemoryPrompt(m: AgentMemory): string {
  const block = [
    "User memory (persistent, local):",
    m.brandContext
      ? `Brand voice profile (always write in this voice for this brand — apply to every response):\n${m.brandContext}`
      : "",
    m.companionIntake
      ? `Early connection intake (answered before first chat; honor tone, stakes, and success criteria):\n${m.companionIntake}`
      : "",
    m.preferences.length ? `Preferences: ${m.preferences.join("; ")}` : "",
    m.styleNotes.length ? `Style: ${m.styleNotes.join("; ")}` : "",
    m.ongoingTasks.length ? `Ongoing tasks: ${m.ongoingTasks.join("; ")}` : "",
    m.topics.length ? `Topics: ${m.topics.slice(0, 12).join(", ")}` : "",
    `Technical level guess: ${m.technicalLevel}`,
  ]
    .filter(Boolean)
    .join("\n");
  const folded = buildHolographicMessages([{ role: "user", content: block }], { enabled: true });
  return compactBlock("Memory", [folded[0]?.content ?? block], 2500);
}
