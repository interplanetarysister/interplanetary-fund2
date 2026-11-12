import FinanceDonutChart from "@/components/finance/FinanceDonutChart";

// Four public demographic donuts are rendered by AG Charts Community. The
// accessible list remains authoritative when the optional CDN is unavailable.
// All inputs are supplied by the live campaign query, never by demo fixtures.
export default function DonutCard({ title, subtitle, data, unit = "campaigns" }) {
  const rows = Array.isArray(data) ? data.filter(row => typeof row?.name === "string" &&
    Number.isFinite(row.value) && row.value > 0) : [];
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return <figure className="min-w-0 rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
    <figcaption>
      <h3 className="text-sm font-bold text-slate-100">{title}</h3>
      {subtitle && <p className="mt-1 text-xs leading-5 text-slate-400">{subtitle}</p>}
    </figcaption>
    {total === 0 ? (
      <p className="mt-6 rounded-xl border border-dashed border-slate-700 p-6 text-center text-xs text-slate-400">
        No published records for this view yet.
      </p>
    ) : <>
      <FinanceDonutChart rows={rows} title={title} compact dark />
      <p className="text-center text-xs font-semibold text-slate-300">{total.toLocaleString()} {unit} represented</p>
      <ul className="mt-3 space-y-1.5">
        {rows.map(row => <li key={row.name} className="flex items-center justify-between gap-3 text-xs text-slate-200">
          <span className="min-w-0 truncate">{row.name}</span>
          <strong className="shrink-0">{row.value.toLocaleString()}</strong>
        </li>)}
      </ul>
    </>}
  </figure>;
}
