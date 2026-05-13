/** Available credit top-up bundles.
 *  Safe to import from both server (API routes) and client (UI components).
 *  Prices in USD cents; credits are the in-app units added after payment.
 */
export const TOPUP_BUNDLES = [
  { id: "topup_sm", credits: 2_000,  amountCents: 199,  label: "2,000 credits",  price: "$1.99" },
  { id: "topup_md", credits: 8_000,  amountCents: 599,  label: "8,000 credits",  price: "$5.99" },
  { id: "topup_lg", credits: 25_000, amountCents: 1499, label: "25,000 credits", price: "$14.99" },
  { id: "topup_xl", credits: 75_000, amountCents: 3999, label: "75,000 credits", price: "$39.99" },
] as const;

export type TopupBundleId = (typeof TOPUP_BUNDLES)[number]["id"];
