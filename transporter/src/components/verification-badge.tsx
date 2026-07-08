type Tier = "unverified" | "basic" | "verified";

const styles: Record<Tier, { label: string; cls: string }> = {
  unverified: {
    label: "Unverified",
    cls: "bg-neutral-100 text-neutral-600 border-neutral-300",
  },
  basic: { label: "Basic", cls: "bg-amber-50 text-amber-800 border-amber-300" },
  verified: {
    label: "Verified ✓",
    cls: "bg-emerald-50 text-emerald-800 border-emerald-300",
  },
};

export default function VerificationBadge({ tier }: { tier: Tier }) {
  const s = styles[tier];
  return (
    <span
      className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium leading-none ${s.cls}`}
      title={`Verification tier: ${tier}`}
    >
      {s.label}
    </span>
  );
}
