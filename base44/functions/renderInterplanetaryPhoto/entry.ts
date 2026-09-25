import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const SIGNATURE_STYLE = `Interplanetary Fund signature art direction: cyberpunk, steampunk, afropunk/afrofuturist, interstellar science fiction, celestial imagery, and space-comic/graphic-novel energy. Blend cinematic realism with selective ink, halftone, retro-futurist machinery, brass/copper mechanical detail, analog gauges, gears, pipes, tactile switches, luminous circuitry, orbital architecture, cosmic scale, sophisticated cyan/teal/violet/slate lighting, and hopeful human-centered storytelling. Steampunk is part of the vocabulary, not a requirement to cover every image in gears. Preserve the original subject, people, identity, pose, composition, setting, and important factual details. Do not change apparent race, age, body, facial identity, number of people, objects, location, event, or factual meaning. Apply the signature look as a photo treatment and environmental/art-direction layer rather than replacing the photo with a different scene. Do not add readable text, watermarks, or logos.`;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const sourceUrl = typeof body.source_url === 'string' ? body.source_url.trim() : '';
    if (!sourceUrl) return Response.json({ error: 'A source photo is required' }, { status: 400 });

    const prompt = `Transform the user-supplied photo at this source URL into an Interplanetary Fund version while keeping it recognizably the same photo: ${sourceUrl}

${SIGNATURE_STYLE}

This is an edit/restyle request, not a request for a new unrelated image. The original uploaded photo is authoritative for subject identity and factual content.`;

    const imageRes = await base44.integrations.Core.GenerateImage({ prompt });
    if (!imageRes?.url) throw new Error('No image returned');
    return Response.json({ url: imageRes.url, source_url: sourceUrl, style: 'interplanetary_fund' });
  } catch (error) {
    console.error('renderInterplanetaryPhoto error:', error?.message || error);
    return Response.json({ error: 'Unable to render the Interplanetary Fund version. Your original photo is unchanged.' }, { status: 500 });
  }
}
