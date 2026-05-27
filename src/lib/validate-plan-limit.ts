import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/index";
import { organizations } from "@/lib/db/schema";
import { PLANS, type PlanId } from "@/lib/plans";
import { InsufficientCreditsError, reserveCredits, reconcileCredits, refundReservation } from "@/services/credit-accounting";

export class PlanLimitError extends Error {
  readonly upgradeRequired = true;
  constructor(public readonly planId: string, public readonly operation: string) {
    super(`Plan '${planId}' does not permit '${operation}'`);
    this.name = "PlanLimitError";
  }
}

export type Operation = "AI_GENERATION" | "BATCH_CREATE" | "POST_SCHEDULE";

export async function validatePlanLimit(
  organizationId: string,
  operation: Operation,
): Promise<{ permitted: true; availableCredits: number }> {
  const db = getDb();
  const [org] = await db
    .select({ planId: organizations.planId, aiCredits: organizations.aiCredits })
    .from(organizations).where(eq(organizations.id, organizationId)).limit(1);

  if (!org) throw new Error(`Organization ${organizationId} not found`);

  const plan = PLANS[org.planId as PlanId] ?? PLANS.free;

  if (operation === "AI_GENERATION" && plan.monthlyCredits === 0)
    throw new PlanLimitError(org.planId, operation);
  if (operation === "BATCH_CREATE" && plan.id === "free")
    throw new PlanLimitError(org.planId, operation);
  if (org.aiCredits <= 0)
    throw new InsufficientCreditsError(1, org.aiCredits);

  return { permitted: true, availableCredits: org.aiCredits };
}

export async function withCreditValidation<T>(
  organizationId: string,
  estimatedCredits: number,
  model: string,
  runType: string,
  fn: (aiRunId: string) => Promise<T & { inputTokens?: number; outputTokens?: number }>,
): Promise<T> {
  const aiRunId = await reserveCredits(organizationId, estimatedCredits, runType, model);
  try {
    const result = await fn(aiRunId);
    const i = result?.inputTokens ?? 0;
    const o = result?.outputTokens ?? 0;
    if (i > 0 || o > 0) await reconcileCredits(aiRunId, i, o);
    return result;
  } catch (err) {
    await refundReservation(aiRunId, err instanceof Error ? err.message : "Unknown error");
    throw err;
  }
}
