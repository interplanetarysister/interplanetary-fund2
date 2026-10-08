export const PUBLIC_IFUND_ORIGIN = "https://interplanetaryfund.com";

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[character]));
}

function validCampaignId(id) {
  return typeof id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(id);
}

export function campaignPublicUrl(id) {
  if (!validCampaignId(id)) return "";
  return `${PUBLIC_IFUND_ORIGIN}/campaign/${encodeURIComponent(id)}`;
}

export function buildCampaignEmbed(campaign, platformOnly = true) {
  const url = campaignPublicUrl(campaign?.id);
  if (!url) return { url: "", card: "", button: "" };
  const title = escapeHtml(campaign?.title || "Campaign");
  const label = platformOnly ? "View campaign on Interplanetary Fund" : "Support campaign on Interplanetary Fund";
  const cardUrl = `${PUBLIC_IFUND_ORIGIN}/embed/campaign/${encodeURIComponent(campaign.id)}`;
  const card = `<iframe src="${cardUrl}" title="${title} – Interplanetary Fund" width="360" height="470" loading="lazy" style="max-width:100%;border:0;border-radius:16px;overflow:hidden" referrerpolicy="strict-origin-when-cross-origin"></iframe>\n<p><a href="${url}" target="_blank" rel="noopener noreferrer">${title} on Interplanetary Fund</a></p>`;
  const button = `<a href="${url}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 20px;border-radius:12px;background:#4f46e5;color:#ffffff;font-family:Arial,sans-serif;font-weight:700;text-decoration:none">${label}</a>`;
  return { url, card, button };
}
