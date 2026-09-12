import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const SAFE_ERROR = 'Unable to geocode this location right now';
const MAX_CITY_LENGTH = 200;
const MAX_DISPLAY_LENGTH = 240;
const MAX_PROVIDER_ROWS = 5;

function diagnosticType(error) {
  if (error instanceof TypeError) return 'type_error';
  if (error instanceof SyntaxError) return 'syntax_error';
  if (error instanceof Error) return 'error';
  if (typeof error === 'string') return 'string';
  if (error === null) return 'null';
  return typeof error;
}

function hasUnsafeControls(value) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export default async function (req) {
  if (req?.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json', allow: 'POST' },
    });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid request body' }, { status: 400 });
    }
    if (!isPlainObject(body) || Object.keys(body).some((key) => key !== 'city')) {
      return Response.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const city = typeof body.city === 'string' ? body.city.trim() : '';
    if (!city || city.length > MAX_CITY_LENGTH || hasUnsafeControls(city)) {
      return Response.json({ error: 'A city name is required' }, { status: 400 });
    }

    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(city)}`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'InterplanetaryFund/1.0 (geocoding)' },
    });
    if (!r.ok) return Response.json({ error: 'Geocoding service unavailable' }, { status: 502 });

    const data = await r.json();
    if (!Array.isArray(data) || data.length === 0 || data.length > MAX_PROVIDER_ROWS) {
      return Response.json({ error: 'Location not found' }, { status: 404 });
    }

    const hit = data[0];
    if (!isPlainObject(hit)) return Response.json({ error: 'Location not found' }, { status: 404 });

    const lat = Number(hit.lat);
    const lng = Number(hit.lon);
    const display = typeof hit.display_name === 'string' ? hit.display_name.trim() : '';
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180 || !display || display.length > MAX_DISPLAY_LENGTH || hasUnsafeControls(display)) {
      return Response.json({ error: 'Location not found' }, { status: 404 });
    }

    return Response.json({ lat, lng, display });
  } catch (error) {
    console.error('geocodeCity error:', diagnosticType(error));
    return Response.json({ error: SAFE_ERROR }, { status: 500 });
  }
}
