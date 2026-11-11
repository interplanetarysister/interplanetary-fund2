import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { PALETTE } from "./donutData";

// One donut built from live records. The centre total is the number of real
// campaigns represented, so the chart can never imply more data than exists.
export default function DonutCard({ title, subtitle, data, unit = "campaigns" }) {
  const rows = Array.isArray(data) ? data : [];
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  return <figure className="min-w-0 rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
    <figcaption className="min-w-0">
      <h3 className="text-sm font-bold text-slate-100">{title}</h3>
      {subtitle && <p className="mt-1 text-xs leading-5 text-slate-400">{subtitle}</p>}
    </figcaption>

    {total === 0 ? (
      <p className="mt-6 rounded-xl border border-dashed border-slate-700 p-6 text-center text-xs text-slate-400">
        No live records for this view yet.
      </p>
    ) : (
      <>
        <div className="relative mt-2 h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={rows}
                dataKey="value"
                nameKey="name"
                innerRadius="58%"
                outerRadius="88%"
                paddingAngle={2}
                stroke="none"
                isAnimationActive={false}
              >
                {rows.map((entry, index) => (
                  <Cell key={entry.name} fill={PALETTE[index % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "#0b1730", border: "1px solid #334155",
                  borderRadius: 12, fontSize: 12, color: "#e2e8f0",
                }}
                itemStyle={{ color: "#e2e8f0" }}
                formatter={(value, name) => [value + " " + unit, name]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-white">{total}</span>
            <span className="text-[11px] uppercase tracking-wide text-slate-400">{unit}</span>
          </div>
        </div>

        <ul className="mt-3 space-y-1.5">
          {rows.map((entry, index) => (
            <li key={entry.name} className="flex items-center justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-2 text-slate-300">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PALETTE[index % PALETTE.length] }} />
                <span className="truncate">{entry.name}</span>
              </span>
              <span className="shrink-0 font-semibold text-slate-200">{entry.value}</span>
            </li>
          ))}
        </ul>
      </>
    )}
  </figure>;
}