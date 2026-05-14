import type { ModelTier } from "@/lib/types";

export type PlanId = "free" | "starter" | "pro" | "team";

/** Monthly vs annual Stripe checkout — separate recurring Prices in Dashboard. */
export type PlanBillingCadence = "monthly" | "annual";

export type QuantumFeatureKey = "kolmogorov" | "holographic" | "dna";

export interface PlanDefinition {
  id: PlanId;
  label: string;
  subtitle: string;
  /** Credits added at the start of each calendar month (client-side bookkeeping). */
  monthlyCredits: number;
  allowedModels: readonly ModelTier[];
  /** Relative capability emphasis (shown in UI; server routing unchanged). */
  modelHighlights: Record<ModelTier, string>;
  features: {
    thinking: boolean;
    agent: boolean;
    schrodinger: boolean;
    kolmogorov: boolean;
    holographic: boolean;
    dna: boolean;
    communityDebate: boolean;
  };
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    label: "Free",
    subtitle: "Try the core chat experience",
    monthlyCredits: 600,
    allowedModels: ["glm-4-flash"],
    modelHighlights: {
      "glm-4-flash": "Fast default — included",
      "glm-4-air": "Upgrade to Starter",
      "glm-4-plus": "Upgrade to Starter",
      "glm-4-long": "Upgrade to Pro",
      "glm-4": "Upgrade to Pro",
    },
    features: {
      thinking: true,
      agent: false,
      schrodinger: false,
      kolmogorov: false,
      holographic: false,
      dna: false,
      communityDebate: true,
    },
  },
  starter: {
    id: "starter",
    label: "Starter",
    subtitle: "Stronger models + agent tools",
    monthlyCredits: 6_000,
    allowedModels: ["glm-4-flash", "glm-4-air", "glm-4-plus"],
    modelHighlights: {
      "glm-4-flash": "Quick answers",
      "glm-4-air": "Balanced daily driver",
      "glm-4-plus": "Code & reasoning",
      "glm-4-long": "Upgrade to Pro for long context",
      "glm-4": "Upgrade to Pro for flagship quality",
    },
    features: {
      thinking: true,
      agent: true,
      schrodinger: false,
      kolmogorov: true,
      holographic: true,
      dna: false,
      communityDebate: true,
    },
  },
  pro: {
    id: "pro",
    label: "Pro",
    subtitle: "Full stack: dual-model, DNA, long context",
    monthlyCredits: 25_000,
    allowedModels: ["glm-4-flash", "glm-4-air", "glm-4-plus", "glm-4-long", "glm-4"],
    modelHighlights: {
      "glm-4-flash": "Fast",
      "glm-4-air": "Balanced",
      "glm-4-plus": "Code / tools",
      "glm-4-long": "Long documents",
      "glm-4": "Richest reasoning",
    },
    features: {
      thinking: true,
      agent: true,
      schrodinger: true,
      kolmogorov: true,
      holographic: true,
      dna: true,
      communityDebate: true,
    },
  },
  team: {
    id: "team",
    label: "Team",
    subtitle: "Same capabilities as Pro — higher monthly pool",
    monthlyCredits: 80_000,
    allowedModels: ["glm-4-flash", "glm-4-air", "glm-4-plus", "glm-4-long", "glm-4"],
    modelHighlights: {
      "glm-4-flash": "Fast",
      "glm-4-air": "Balanced",
      "glm-4-plus": "Code / tools",
      "glm-4-long": "Long documents",
      "glm-4": "Flagship",
    },
    features: {
      thinking: true,
      agent: true,
      schrodinger: true,
      kolmogorov: true,
      holographic: true,
      dna: true,
      communityDebate: true,
    },
  },
};

export const DEFAULT_PLAN: PlanId = "free";

/** Stable UI / billing order (do not rely only on `Object.keys(PLANS)`). */
export const PLAN_IDS_IN_UI_ORDER: readonly PlanId[] = ["free", "starter", "pro", "team"];

/** One-time welcome grant so new users can explore credit spend before monthly accrual. */
export const FIRST_VISIT_CREDIT_BONUS = 500;

export function planAllowsModel(plan: PlanDefinition, model: ModelTier): boolean {
  return plan.allowedModels.includes(model);
}
