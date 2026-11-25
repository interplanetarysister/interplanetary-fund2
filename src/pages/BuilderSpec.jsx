import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import SpecDocument from "@/components/builder-spec/SpecDocument";

// Admin-only specification surface. It is deliberately absent from every
// member-facing navigation menu and is marked noindex for crawlers.
export default function BuilderSpec() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => { meta.remove(); };
  }, []);

  useEffect(() => {
    let active = true;
    base44.entities.BuilderSpecDocument.list("order", 200)
      .then((records) => { if (active) setDocuments(Array.isArray(records) ? records : []); })
      .catch(() => { if (active) setError("The specification documents could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <div className="ifund-experience min-h-dvh px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Internal · Admin only</p>
          <h1 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">Builder specification</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            The connection-layer specification read by the IFund Builder Assistant. Not linked from member navigation.
          </p>
        </header>

        {loading && (
          <p className="rounded-2xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground" role="status">
            Loading specification documents…
          </p>
        )}
        {error && !loading && (
          <p className="rounded-2xl border border-destructive/40 bg-card px-4 py-6 text-sm text-foreground" role="alert">
            {error}
          </p>
        )}
        {!loading && !error && documents.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border bg-card px-4 py-6 text-sm text-muted-foreground">
            No specification documents have been written yet.
          </p>
        )}
        {!loading && documents.length > 0 && (
          <div className="space-y-4">
            {documents.map((record) => <SpecDocument key={record.id || record.key} document={record} />)}
          </div>
        )}
      </div>
    </div>
  );
}