/**
 * Sealed bidding: redact `amount`/`message` for anyone who is neither the
 * posting owner nor that bid's own bidder. Prevents competing bidders from
 * reading each other's terms and undercutting by a dollar.
 */
export function sealBidsForViewer<T extends { bidderId: string; amount: string; message: string | null }>(
  rows: T[],
  posterId: string,
  viewerId: string | null,
): (Omit<T, "amount" | "message"> & { amount: string | null; message: string | null; sealed: boolean })[] {
  return rows.map((row) => {
    const canSee = viewerId !== null && (viewerId === posterId || viewerId === row.bidderId);
    return {
      ...row,
      amount: canSee ? row.amount : null,
      message: canSee ? row.message : null,
      sealed: !canSee,
    };
  });
}
