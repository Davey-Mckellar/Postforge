export type SkillFormat = {
  /** Hard cap on response length in words. */
  maxWords?: number;
  /** Structural template the model must follow, e.g. "Hook -> 3 bullets -> CTA" */
  structure?: string;
  /** Tone override for this skill, e.g. "direct and critical" */
  tone?: string;
};

export type Skill = {
  id: string;
  name: string;
  description: string;
  prompt: string;
  /** Optional format contract -- included in system prompt when skill is active. */
  format?: SkillFormat;
  category: string;
  builtIn?: boolean;
};
