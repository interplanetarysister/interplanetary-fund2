// Single authoritative art direction for ALL AI-generated IFund imagery.
// Client-side photo improvements use the corresponding non-generative profile.
export const IFUND_SIGNATURE_STYLE = [
  'Signature IFund visual language: interplanetary space-comic, cosmic cyan/blue/violet',
  'lighting, cyberpunk circuitry, restrained steampunk brass/analog machinery,',
  'graphic novel linework, and occasionally respectful afrofuturist/afropunk',
  'design vocabulary. Express hope, dignity and human agency.',
  'Vary techniques and compositions: not every image needs all motifs.',
  'Never fabricate facts about a real campaign or person.',
  'Do not render any lettering, trademarks or watermarks in the AI image:',
  'IFund adds its exact official planet logo and domain watermark afterward.',
].join(' ');

export const IFUND_PHOTO_EDIT_STYLE = [
  'EDIT THE ACTUAL SOURCE PHOTOGRAPH rather than replacing it or generating a lookalike.',
  'Preserve the identical person(s), face, skin tone, age, hair, expression, pose,',
  'body geometry, clothing, background subjects, framing, and factual setting.',
  'Prefer gentle improvements: exposure, clarity, cinematic but natural color grade,',
  'restrained cyan-violet edge lighting, subtle space-comic ink/texture accents,',
  'and small futuristic graphic details outside faces and key content.',
  'Do not invent, delete or move any subject or suggest a different event.',
  'Source photograph fidelity takes priority over dramatic stylization.',
  IFUND_SIGNATURE_STYLE,
].join(' ');
