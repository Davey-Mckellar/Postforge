import { eq, and, gte } from "drizzle-orm";
import { getDb } from "@/lib/db/index";
import { aiRuns, aiUsageLedger, organizations } from "@/lib/db/schema";

export class InsufficientCreditsError extends Error {
  constructor(public readonly required: number, public readonly available: number) {
    super(`Insufficient credits: need ${required}, have ${available}`);
    this.name = "InsufficientCreditsError";
  }
}

function tokensToCredits(input: number, output: number): number {
  return Math.ceil((input + output * 3) / 1000);
}

export async function reserveCredits(
  organizationId: string,
  estimatedCredits: number,
  runType: string,
  model: string,
): Promise<string> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(organizations)
      .set({ aiCredits: organizations.aiCredits - estimatedCredits } as never)
      .where(and(eq(organizations.id, organizationId), gte(organizations.aiCredits, estimatedCredits)))
      .returning({ aiCredits: organizations.aiCredits });

    if (updated.length === 0) {
      const [org] = await tx.select({ aiCredits: organizations.aiCredits })
        .from(organizations).where(eq(organizations.id, organizationId)).limit(1);
      throw new InsufficientCreditsError(estimatedCredits, org?.aiCredits ?? 0);
    }

    const [run] = await tx.insert(aiRuns).values({
      organizationId, model, runType,
      estimatedTokens: estimatedCredits * 1000,
      reservedCredits: estimatedCredits,
      status: "RUNNING",
    }).returning({ id: aiRuns.id });

    await tx.insert(aiUsageLedger).values({
      organizationId, aiRunId: run.id,
      amount: -estimatedCredits, type: "RESERVATION",
      description: `Reserved ${estimatedCredits} credits for ${runType} (${model})`,
    });

    return run.id;
  });
}

export async function reconcileCredits(
  aiRunId: string,
  actualInputTokens: number,
  actualOutputTokens: number,
): Promise<number> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const [run] = await tx.select().from(aiRuns).where(eq(aiRuns.id, aiRunId)).limit(1);
    if (!run) throw new Error(`AiRun ${aiRunId} not found`);

    const actual = tokensToCredits(actualInputTokens, actualOutputTokens);
    const diff = run.reservedCredits - actual;

    if (diff > 0) {
      await tx.update(organizations)
        .set({ aiCredits: organizations.aiCredits + diff } as never)
        .where(eq(organizations.id, run.organizationId));
    }

    await tx.update(aiRuns).set({
      actualInputTokens, actualOutputTokens,
      chargedCredits: actual, status: "COMPLETED", completedAt: new Date(),
    }).where(eq(aiRuns.id, aiRunId));

    await tx.insert(aiUsageLedger).values({
      organizationId: run.organizationId, aiRunId,
      amount: -actual, type: "CHARGE",
      description: `Charged ${actual} credits (${actualInputTokens}in/${actualOutputTokens}out)`,
    });

    return actual;
  });
}

export async function refundReservation(aiRunId: string, reason?: string): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    const [run] = await tx.select().from(aiRuns).where(eq(aiRuns.id, aiRunId)).limit(1);
    if (!run || run.reservedCredits === 0) return;

    await tx.update(organizations)
      .set({ aiCredits: organizations.aiCredits + run.reservedCredits } as never)
      .where(eq(organizations.id, run.organizationId));

    await tx.update(aiRuns)
      .set({ status: "REFUNDED", failedAt: new Date(), errorMessage: reason ?? "Refunded" })
      .where(eq(aiRuns.id, aiRunId));

    await tx.insert(aiUsageLedger).values({
      organizationId: run.organizationId, aiRunId,
      amount: run.reservedCredits, type: "REFUND",
      description: reason ?? "Reservation refunded",
    });
  });
}
