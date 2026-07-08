export type BidNode<T extends { id: string; parentBidId: string | null }> = T & {
  children: BidNode<T>[];
};

/**
 * Build a forest of bid nodes ordered by `createdAt`. Bids whose parent is
 * missing (parent from a different scope, or filtered out) are treated as
 * roots so we never lose them.
 */
export function buildBidTree<T extends { id: string; parentBidId: string | null }>(
  bids: T[],
): BidNode<T>[] {
  const byId = new Map<string, BidNode<T>>();
  for (const b of bids) byId.set(b.id, { ...b, children: [] });

  const roots: BidNode<T>[] = [];
  for (const node of byId.values()) {
    if (node.parentBidId && byId.has(node.parentBidId)) {
      byId.get(node.parentBidId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}
