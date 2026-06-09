import { v4 as uuidv4 } from "uuid";
import { lsKey } from "./storage";
import { BUILT_IN_SKILLS } from "./built-in-skills";
import type { Skill } from "./skill-model";

export type { Skill } from "./skill-model";

const KEY = lsKey("skills_v1");

function isBrowser() {
  return typeof window !== "undefined";
}

function loadCustomOnly(): Skill[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Skill[];
  } catch {
    return [];
  }
}

export function loadAllSkills(): Skill[] {
  return [...BUILT_IN_SKILLS, ...loadCustomOnly()];
}

export function saveCustomSkills(skills: Skill[]) {
  if (!isBrowser()) return;
  localStorage.setItem(KEY, JSON.stringify(skills.filter((s) => !s.builtIn)));
}

export function createSkill(partial: Omit<Skill, "id" | "builtIn">): Skill {
  return {
    id: uuidv4(),
    builtIn: false,
    ...partial,
  };
}

export function deleteSkill(id: string) {
  const next = loadCustomOnly().filter((s) => s.id !== id);
  saveCustomSkills(next);
}

/** Pick best matching skill by naive keyword overlap with description */
export function suggestSkillForMessage(text: string): Skill | null {
  const skills = loadAllSkills();
  const words = new Set(text.toLowerCase().match(/\w{4,}/g) ?? []);
  let best: { s: Skill; score: number } | null = null;
  for (const s of skills) {
    const hay = `${s.name} ${s.description}`.toLowerCase();
    let score = 0;
    for (const w of words) {
      if (hay.includes(w)) score += 1;
    }
    if (!best || score > best.score) best = { s, score };
  }
  if (!best || best.score < 2) return null;
  return best.s;
}

export function skillSystemPrompt(skill: Skill | null | undefined): string {
  if (!skill) return "";
  const parts = [`Active skill: ${skill.name}\nInstructions:\n${skill.prompt}`];
  if (skill.format?.structure) parts.push(`Format your response as: ${skill.format.structure}`);
  if (skill.format?.maxWords) parts.push(`Maximum ${skill.format.maxWords} words.`);
  if (skill.format?.tone) parts.push(`Tone: ${skill.format.tone}.`);
  return parts.join("\n");
}
