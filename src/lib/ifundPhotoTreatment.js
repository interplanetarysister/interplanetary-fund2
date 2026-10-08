// A genuine image-to-image treatment: always starts from the user's original
// pixels, never swaps subjects or relies on text-to-image pretending to see a URL.
function readOriginal(sourceUrl) {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    if (!String(sourceUrl).startsWith('data:')) image.crossOrigin = 'anonymous';
    image.onload = () => image.naturalWidth && image.naturalHeight
      ? resolve(image) : reject(new Error('Image dimensions unavailable'));
    image.onerror = () => reject(new Error('Original photo cannot be loaded'));
    image.src = sourceUrl;
  });
}

export async function createIfundPhotoTreatment(sourceUrl) {
  const image = await readOriginal(sourceUrl);
  const width = Math.max(1, Math.round(image.naturalWidth * Math.min(1, 2200 / Math.max(image.naturalWidth, image.naturalHeight))));
  const height = Math.max(1, Math.round(image.naturalHeight * Math.min(1, 2200 / Math.max(image.naturalWidth, image.naturalHeight))));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Photo treatment unavailable');

  // Preserve the entire source composition and identities unchanged.
  // Improvements are color/exposure and restrained graphic accents.
  ctx.filter = 'contrast(1.055) saturate(1.115) brightness(1.018)';
  ctx.drawImage(image, 0, 0, width, height);
  ctx.filter = 'none';

  const edge = Math.max(4, Math.min(width, height) * .008);
  const aurora = ctx.createLinearGradient(0, 0, width, height);
  aurora.addColorStop(0, 'rgba(34,211,238,.24)');
  aurora.addColorStop(.5, 'rgba(59,130,246,.09)');
  aurora.addColorStop(1, 'rgba(147,51,234,.21)');
  ctx.strokeStyle = aurora;
  ctx.lineWidth = edge;
  ctx.strokeRect(edge / 2, edge / 2, width - edge, height - edge);

  const corner = Math.max(12, Math.min(width, height) * .055);
  const margin = Math.max(10, Math.min(width, height) * .022);
  ctx.lineWidth = Math.max(2, edge * .45);
  ctx.strokeStyle = 'rgba(34,211,238,.35)';
  for (const [x, dx] of [[margin, 1], [width - margin, -1]]) {
    for (const [y, dy] of [[margin, 1], [height - margin, -1]]) {
      ctx.beginPath();
      ctx.moveTo(x + dx * corner, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + dy * corner);
      ctx.stroke();
    }
  }

  // Steampunk-influenced tactile detail stays in the border, not over faces.
  // Overlay is purely decorative. Source pixels are still the principal image.
  ctx.strokeStyle = 'rgba(209,158,89,.24)';
  ctx.lineWidth = Math.max(1, edge * .22);
  const r = Math.max(7, Math.min(width, height) * .017);
  ctx.beginPath();
  ctx.arc(margin + r, height - margin - r, r, -Math.PI / 2, Math.PI);
  ctx.stroke();

  return await new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Unable to save IFund photo treatment')), 'image/png');
  });
}
