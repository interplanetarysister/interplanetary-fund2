import ReactMarkdown from "react-markdown";
import { Badge } from "@/components/ui/badge";

const CATEGORY_LABELS = {
  overview: "Overview",
  provider: "Provider",
  architecture: "Architecture",
  ui: "UI",
  security: "Security",
  acceptance: "Acceptance",
  "open-items": "Open items",
};

// Tailwind classes for rendered markdown are declared literally so they are
// generated at build time; typography is scoped to the document body only.
const MARKDOWN_CLASSES = [
  "space-y-3 text-sm leading-relaxed text-foreground break-words",
  "[&_h1]:text-xl [&_h1]:font-semibold [&_h1]:tracking-tight",
  "[&_h2]:text-lg [&_h2]:font-semibold",
  "[&_h3]:text-base [&_h3]:font-semibold",
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1",
  "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1",
  "[&_a]:text-primary [&_a]:underline",
  "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em]",
  "[&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-muted [&_pre]:p-3",
  "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
  "[&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left",
  "[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1",
].join(" ");

export default function SpecDocument({ document }) {
  const category = CATEGORY_LABELS[document.category] || document.category;
  return (
    <article id={document.key} className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
          {typeof document.order === "number" ? String(document.order).padStart(2, "0") : "—"}
        </span>
        <h2 className="font-heading text-lg font-semibold text-foreground">{document.title}</h2>
        {category && <Badge variant="secondary">{category}</Badge>}
      </header>
      <p className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Key: {document.key}</span>
        {document.spec_version && <span>Spec {document.spec_version}</span>}
        {document.source_branch && <span>Branch: {document.source_branch}</span>}
      </p>
      {document.body_markdown ? (
        <div className={MARKDOWN_CLASSES}>
          <ReactMarkdown>{document.body_markdown}</ReactMarkdown>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
          This document has no body yet.
        </p>
      )}
    </article>
  );
}