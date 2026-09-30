export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildEmbedMarkup({ campaignTitle, embedUrl }) {
  const safeTitle = escapeHtml(campaignTitle || "Campaign");
  return [
    "<iframe",
    `  src="${escapeHtml(embedUrl)}"`,
    '  width="100%"',
    '  style="display:block;width:100%;max-width:340px;min-height:420px;border:0;border-radius:16px;overflow:hidden;"',
    `  title="${safeTitle} — Interplanetary Fund campaign"`,
    '  loading="lazy"',
    '  referrerpolicy="strict-origin-when-cross-origin"',
    "></iframe>",
  ].join("\n");
}
