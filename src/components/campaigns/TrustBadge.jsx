export default function TrustBadge({ donorCount = 0 }) {
  if (donorCount < 10) return null;
  const level = donorCount >= 100
    ? { label: "Trusted", classes: "bg-sky-50 text-sky-700 border-sky-200" }
    : donorCount >= 50
      ? { label: "Popular", classes: "bg-violet-50 text-violet-700 border-violet-200" }
      : { label: "Rising", classes: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  return <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border font-semibold ${level.classes}`}>{level.label}</span>;
}
