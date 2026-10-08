import { PUBLIC_IFUND_ORIGIN } from "./campaignSharing";
import { loadGeneratedImage, resolveGeneratedImageUrl } from "./generatedMedia";
import { BRAND_MARK } from "@/components/brand/brand";

export const IFUND_WATERMARK_TEXT = "interplanetaryfund.com";
export const IFUND_WATERMARK_LOGO = BRAND_MARK;

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    if (!source.startsWith("data:")) image.crossOrigin = "anonymous";
    image.onload = () => image.naturalWidth && image.naturalHeight
      ? resolve(image) : reject(new Error("Invalid image dimensions"));
    image.onerror = () => reject(new Error("Unable to load image for branding"));
    image.src = source;
  });
}

function circularText(ctx, text, x, y, radius) {
  const chars = Array.from(text);
  const span = 2.45;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < chars.length; i++) {
    const angle = -Math.PI / 2 - span / 2 + span * (i + .5) / chars.length;
    ctx.save();
    ctx.translate(x + radius * Math.cos(angle), y + radius * Math.sin(angle));
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillText(chars[i], 0, 0);
    ctx.restore();
  }
}

// Draws the exact planet logo used by Interplanetary Fund (Copy), plus a faint
// arc of website text, *into image pixels*. The link is provided by adjacent
// HTML UI; a JPEG/PNG alone cannot contain a clickable hyperlink.
export async function prepareBrandedImageBlob(sourceUrl) {
  const source = await loadImage(sourceUrl);
  const logo = await loadImage(IFUND_WATERMARK_LOGO);
  const maxSide = 2200;
  const scale = Math.min(1, maxSide / Math.max(source.naturalWidth, source.naturalHeight));
  const width = Math.round(source.naturalWidth * scale);
  const height = Math.round(source.naturalHeight * scale);
  if (!width || !height) throw new Error("Empty generated image");
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image compositing unavailable");
  ctx.drawImage(source, 0, 0, width, height);

  // Subtle bottom-right corner mark with the original planet in the middle.
  const diameter = Math.max(80, Math.min(180, Math.round(Math.min(width, height) * .18)));
  const radius = diameter / 2;
  const inset = Math.max(14, Math.round(Math.min(width, height) * .025));
  const x = width - radius - inset;
  const y = height - radius - inset;

  ctx.save();
  ctx.globalAlpha = 0.21;
  ctx.beginPath();
  ctx.arc(x, y + diameter * .085, radius * .64, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(logo, x - radius * .64, y + diameter * .085 - radius * .64,
    radius * 1.28, radius * 1.28);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.30;
  ctx.font = `600 ${Math.max(9, Math.round(diameter * .09))}px Arial,sans-serif`;
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "#08122c";
  ctx.shadowBlur = 2;
  circularText(ctx, IFUND_WATERMARK_TEXT, x, y, radius * .92);
  ctx.restore();

  return await new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Could not encode watermarked image")),
      "image/png");
  });
}

export async function brandAndUploadGeneratedImage(base44, sourceUrl) {
  const blob = await prepareBrandedImageBlob(sourceUrl);
  const file = new File([blob], `ifund-generated-${Date.now()}.png`, { type: "image/png" });
  const result = await base44.integrations.Core.UploadFile({ file });
  const url = resolveGeneratedImageUrl(result?.file_url
    ? { url: result.file_url } : result);
  if (!url) throw new Error("Watermarked image was not saved");
  await loadGeneratedImage(url);
  return url;
}

export function ifundImageLink() { return PUBLIC_IFUND_ORIGIN; }
