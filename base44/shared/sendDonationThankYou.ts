const APP_URL = "https://interplanetaryfund.base44.app";

const escapeHtml = (value) => String(value || "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// Header-safe single line: no CR/LF can reach a header value.
const oneLine = (value, max = 160) => String(value || "").replace(/[\r\n]+/g, " ").trim().slice(0, max);

const bytesToBase64 = (bytes) => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

const base64Url = (value) => bytesToBase64(new TextEncoder().encode(value))
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const money = (value) => `USD ${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Personalized thank-you immediately after a verified capture. Sends through the
// connected Gmail account. Best effort only: a mail failure must never change,
// retract, or duplicate a settled donation. Returns true when Gmail accepted it.
export async function sendDonationThankYou(sr, { donation, campaign, donorEmail, amount } = {}) {
  const to = oneLine(donorEmail, 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) return false;
  const campaignId = String(campaign?.id || donation?.campaign_id || "");
  if (!campaignId) return false;

  const { accessToken } = await sr.connectors.getConnection("googleworkspace");
  if (!accessToken) return false;

  const donorName = oneLine(donation?.donor_name || "", 80) || "friend";
  const campaignTitle = oneLine(campaign?.title || donation?.campaign_title || "a campaign you support", 120);
  const gift = Number(amount || donation?.amount || 0);
  if (!(gift > 0)) return false;
  const updateLink = `${APP_URL}/campaign/${encodeURIComponent(campaignId)}#campaign-updates`;
  const subject = oneLine(`Thank you for supporting ${campaignTitle}`, 180);

  const text = [
    `Hi ${donorName},`,
    "",
    `Thank you for your gift of ${money(gift)} to "${campaignTitle}". Your support goes directly to the people behind this campaign.`,
    "",
    "You can follow the campaign's progress and read updates here:",
    updateLink,
    "",
    "You are receiving this because you made a donation through Interplanetary Fund.",
    "Interplanetary Fund",
  ].join("\n");

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f8fc;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:28px">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#0891b2;font-weight:700">Interplanetary Fund</p>
    <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">Thank you, ${escapeHtml(donorName)}</h1>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6">Your gift of <strong>${escapeHtml(money(gift))}</strong> to <strong>${escapeHtml(campaignTitle)}</strong> was received.</p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6">Every contribution moves this campaign forward. You can follow the progress and read the latest update here:</p>
    <p style="margin:0 0 22px"><a href="${escapeHtml(updateLink)}" style="display:inline-block;background:#0891b2;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px">View the campaign update</a></p>
    <p style="margin:0;font-size:12px;color:#64748b;line-height:1.6">You are receiving this because you made a donation through Interplanetary Fund.</p>
  </div></body></html>`;

  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "",
    html,
  ].join("\r\n");

  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: base64Url(message) }),
  });
  return response.ok;
}