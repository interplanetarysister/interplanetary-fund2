import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { displayHelpCategory } from "@/lib/helpCenter";

export default function HelpArticle() {
  const { slug } = useParams();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    base44.entities.HelpArticle.filter({ slug }, "-created_date", 1)
      .then((rows) => { if (active) setArticle(Array.isArray(rows) ? rows[0] || null : null); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);
  return <main className="max-w-3xl mx-auto px-4 sm:px-8 py-10 min-w-0 text-foreground">
    <Link to="/help" className="font-semibold text-cyan-700 underline">Back to Help Center</Link>
    {loading && <p role="status" className="mt-8">Loading article…</p>}
    {error && <p role="alert" className="mt-8">We couldn't load this article. Please try again.</p>}
    {!loading && !error && !article && <p className="mt-8">This article isn't available yet. <Link to="/contact" className="underline">Contact support</Link>.</p>}
    {!loading && !error && article && <article className="mt-8">
      <p className="text-sm font-semibold text-cyan-700">{displayHelpCategory(article.category)}</p>
      <h1 className="font-display text-3xl sm:text-4xl mt-2 break-words">{article.question}</h1>
      {article.description && <p className="text-muted-foreground mt-3">{article.description}</p>}
      <div className="border-t border-border my-7" />
      <div className="whitespace-pre-wrap leading-8 break-words">{article.answer}</div>
      <div className="mt-10 rounded-xl border border-border p-5">
        <h2 className="font-semibold">Still need help?</h2>
        <Link to="/help" className="inline-block mt-3 font-semibold text-cyan-700 underline">Get support</Link>
      </div>
    </article>}
  </main>;
}
