// Builds varied campaign cover-image prompts while preserving one canonical
// Interplanetary Fund art direction and requiring the image to reflect the
// campaign context supplied by the user.

const SIGNATURE_STYLE = [
  "Interplanetary Fund signature art direction: cyberpunk, afropunk, interplanetary and celestial visual language, cinematic realism with subtle comic-book energy, sophisticated cool-toned lighting, human-centered and hopeful",
  "Interplanetary Fund signature art direction: afropunk futurism blended with space-travel and celestial motifs, cinematic realism with graphic-novel composition, cool cyan/teal/slate atmosphere and a hopeful human focus",
  "Interplanetary Fund signature art direction: cyberpunk interplanetary world-building, celestial light, expressive afropunk styling, cinematic realism with comic-book framing, cool-toned palette and grounded human emotion",
];

const STYLES = [
  "golden-hour natural light, shallow depth of field, candid documentary feel",
  "soft overcast daylight, muted cool palette, intimate and quiet mood",
  "bright midday light, rich saturated cool colors, hopeful and energetic",
  "dramatic low-key lighting with one cool celestial highlight, cinematic and emotional",
  "bright airy morning light, gentle uplifting atmosphere",
  "moody blue-hour twilight, cool tones with a luminous focal point",
  "wide environmental landscape, human scale, vast and hopeful",
  "tight detail shot of hands or meaningful objects, textured and tactile",
];

const SCENES = {
  medical: "a quiet moment of care and recovery in a warm clinical setting",
  emergency: "a community coming together after a sudden hardship",
  education: "a student learning with focus and determination",
  community: "neighbors gathered in solidarity",
  animals: "a beloved animal in a calm, caring setting",
  business: "a small business owner at work, proud and hopeful",
  memorial: "a gentle, reverent still life honoring a loved one",
  disaster_relief: "volunteers delivering supplies to a recovering neighborhood",
  creative: "an artist mid-project, surrounded by their work",
  other: "a person at a meaningful turning point in their life",
};

function cleanContext(value, fallback) {
  const text = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  return (text || fallback).slice(0, 900);
}

/**
 * Build the canonical campaign-image prompt.
 *
 * `story` is optional for backwards compatibility; callers that have the
 * campaign description should pass it so the generated image reflects the
 * user's actual campaign rather than a generic category scene.
 */
export function buildCoverPrompt({ title, category, story = "", regenCount = 0 }) {
  const style = STYLES[regenCount % STYLES.length];
  const signature = SIGNATURE_STYLE[regenCount % SIGNATURE_STYLE.length];
  const safeTitle = cleanContext(title, "fundraising campaign");
  const safeCategory = cleanContext(category, "community");
  const safeStory = cleanContext(story, "the campaign's stated mission and the people it is intended to help");
  const scene = SCENES[category] || SCENES.other;

  return `Create a campaign cover image for an Interplanetary Fund fundraising campaign titled "${safeTitle}" in the ${safeCategory} category. ${signature}. The image must clearly communicate the campaign context: ${safeStory}. Use this grounded scene direction: ${scene}. Shot with ${style}. Composition variation #${regenCount + 1}. Keep the story and visual subject aligned with the supplied campaign context; do not invent specific people, places, events, outcomes, statistics, medical claims, or other facts that are not present in the campaign context. No text, no watermark, no logos.`;
}
