import { lsKey } from "./storage";
import type { Conversation } from "./types";

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
  /** Current session mood -- feeds behavioral instructions in generateMemoryPrompt. */
  moodId?: "analytical" | "creative" | "learning" | "urgent" | "philosophical" | "neutral";
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

/** Writes the current UI mood into memory so it shapes the system prompt. */
export function saveMood(moodId: AgentMemory["moodId"]): void {
  const m = loadMemory();
  saveMemory({ ...m, moodId });
}

const VOICE_CALIBRATION_SIGNALS: Array<{ pattern: RegExp; instruction: string }> = [
  {
    pattern: /\b(be more casual|less formal|relax|chill|loosen up)\b/i,
    instruction: "Use casual, warm tone. Contractions fine. Light humour welcome.",
  },
  {
    pattern: /\b(be more formal|professional tone|formal please)\b/i,
    instruction: "Maintain professional, formal tone. No casual language.",
  },
  {
    pattern: /\b(shorter|be brief|tldr|no preamble|cut to the chase|less words|be concise)\b/i,
    instruction: "Keep every reply under 150 words. Lead with the answer. No preamble.",
  },
  {
    pattern: /\b(more detail|go deeper|elaborate|explain more|be thorough|long form)\b/i,
    instruction: "User wants depth. Provide full explanations with examples and edge cases.",
  },
  {
    pattern: /\b(use bullets|bullet points|list format|give me a list)\b/i,
    instruction: "Use bullet points for all multi-part answers.",
  },
  {
    pattern: /\b(no bullets|no lists|prose only|paragraph form)\b/i,
    instruction: "Write in prose paragraphs. Do not use bullet points or numbered lists.",
  },
  {
    pattern: /\b(stop asking questions|no questions|don't ask me|fewer questions)\b/i,
    instruction: "Do not end replies with questions. Deliver answers directly.",
  },
];

/**
 * Detects voice calibration signals in a user message and appends the matching
 * behavioral instruction to styleNotes so it persists for the rest of the session.
 * Call this in BbGPTClient whenever a user message is sent.
 */
export function detectAndSaveVoiceCalibration(userMessage: string): void {
  const m = loadMemory();
  let changed = false;
  for (const signal of VOICE_CALIBRATION_SIGNALS) {
    if (signal.pattern.test(userMessage) && !m.styleNotes.includes(signal.instruction)) {
      m.styleNotes = [
        ...m.styleNotes.filter(
          (note) =>
            !VOICE_CALIBRATION_SIGNALS.some(
              (s) =>
                s.instruction === note &&
                s.pattern !== signal.pattern &&
                s.instruction.split(" ")[0] === signal.instruction.split(" ")[0],
            ),
        ),
        signal.instruction,
      ];
      changed = true;
    }
  }
  if (changed) saveMemory({ ...m });
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

const MOOD_INSTRUCTIONS: Partial<Record<NonNullable<AgentMemory["moodId"]>, string>> = {
  urgent:
    "URGENT MODE: The user needs help fast. Lead with the direct answer on line 1. No preamble, no recap, no closing pleasantries. If there are steps, number them and keep each one to one sentence.",
  creative:
    "CREATIVE MODE: Be expansive and generative. Use vivid, evocative language. Explore adjacent ideas freely. Offer unexpected angles. Do not converge too early.",
  analytical:
    "ANALYTICAL MODE: User wants precision and structure. Use numbered steps, tables, or code blocks. State assumptions explicitly. Quantify wherever possible.",
  learning:
    "LEARNING MODE: User is building understanding. Define jargon on first use. Use one concrete analogy. Check comprehension at the end with a single clarifying question.",
  philosophical:
    "PHILOSOPHICAL MODE: Engage with nuance. Offer multiple perspectives before converging. Acknowledge uncertainty. Do not oversimplify.",
};

const INSTAGRAM_FORMAT_BLOCK = [
  "When writing Instagram content:",
  "- Structure every post: Hook (1 punchy line) -> Body (2-3 sentences max) -> CTA -> Hashtags (5-10)",
  "- The hook must stop the scroll: use a bold claim, a question, a surprising stat, or a story opener",
  "- Never write long paragraphs -- Instagram is scanned, not read",
  "- Vary hook style across posts -- do not repeat the same opener pattern",
  "- Hashtags: mix 2-3 niche-specific + 2-3 broad reach + 1-2 brand-specific",
].join("\n");

export function generateMemoryPrompt(m: AgentMemory): string {
  const sections: string[] = ["You are bbGPT. Persistent context about this user:"];

  if (m.moodId && MOOD_INSTRUCTIONS[m.moodId]) {
    sections.push(MOOD_INSTRUCTIONS[m.moodId]!);
  }

  if (m.brandContext) {
    sections.push(`Brand voice profile -- apply to every response:\n${m.brandContext}`);
    sections.push(INSTAGRAM_FORMAT_BLOCK);
  }

  if (m.companionIntake) {
    sections.push(
      `Personal context (answered at session start -- honor the tone, stakes, and goals described):\n${m.companionIntake}`,
    );
  }

  if (m.styleNotes.length) {
    sections.push(
      `Calibrated style instructions (inferred or set by user -- follow these precisely):\n${m.styleNotes.map((s) => `- ${s}`).join("\n")}`,
    );
  }

  if (m.preferences.length) {
    sections.push(`User preferences: ${m.preferences.join("; ")}`);
  }

  if (m.ongoingTasks.length) {
    sections.push(`Ongoing tasks: ${m.ongoingTasks.join("; ")}`);
  }

  if (m.technicalLevel !== "unknown") {
    const levelMap: Record<Exclude<AgentMemory["technicalLevel"], "unknown">, string> = {
      beginner: "Pitch explanations at beginner level -- define terms, use analogies, skip assumed knowledge",
      intermediate: "Pitch at intermediate level -- skip basics, define advanced terms, include examples",
      advanced: "Pitch at expert level -- assume deep knowledge, use precise terminology, skip hand-holding",
    };
    sections.push(levelMap[m.technicalLevel]);
  }

  const block = sections.filter(Boolean).join("\n\n");
  return block.length > 2800 ? block.slice(0, 2800) + "\n[memory truncated]" : block;
}
