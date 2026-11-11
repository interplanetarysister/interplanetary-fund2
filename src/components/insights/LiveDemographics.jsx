import { useMemo } from "react";
import DonutCard from "./DonutCard";
import { goalBand, groupBy, placeOf, progressBand, titleCase } from "./donutData";

// Donut demographics for the features the demo walks through — discovery,
// campaign writing, promotion reach and finance — all computed only from live
// published campaign records passed in by the page.
export default function LiveDemographics({ campaigns = [], heading = "Live campaign demographics", description }) {
  const live = Array.isArray(campaigns) ? campaigns : [];

  const focus = useMemo(() => groupBy(live, (c) => titleCase(c.category)), [live]);
  const progress = useMemo(() => groupBy(live, progressBand), [live]);
  const goals = useMemo(() => groupBy(live, goalBand), [live]);
  const places = useMemo(() => groupBy(live, placeOf), [live]);

  return <section className="space-y-4" aria-label={heading}>
    <div>
      <h2 className="text-xl font-bold text-white">{heading}</h2>
      <p className="mt-2 text-sm text-slate-300">
        {description || "Each donut is built from live, published campaign records on Interplanetary Fund — never sample or estimated figures."}
      </p>
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <DonutCard title="Campaign focus" subtitle="Discovery · how live campaigns distribute by cause" data={focus} />
      <DonutCard title="Funding progress" subtitle="Finance · live progress toward each published goal" data={progress} />
      <DonutCard title="Goal size" subtitle="Campaign writing · the scale live organizers choose" data={goals} />
      <DonutCard title="Where campaigns are based" subtitle="Promotion reach · the cities live campaigns name" data={places} />
    </div>
  </section>;
}