// TEMPORARY production diagnostic: returns only non-secret JWT metadata from
// Base44's hosted service-role authorization header. Never returns the token or
// signature. Remove after the Base44 -> Convex trust boundary is verified.
function decodeSegment(segment: string) {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  return JSON.parse(atob(padded));
}

export default async function (req: Request) {
  const auth = req.headers.get('Base44-Service-Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return Response.json({ present: false }, { status: 200 });
  }

  const token = auth.slice(7);
  const parts = token.split('.');
  if (parts.length !== 3) {
    return Response.json({ present: true, jwt: false }, { status: 200 });
  }

  try {
    const header = decodeSegment(parts[0]);
    const payload = decodeSegment(parts[1]);
    const verifyResponse = await fetch('https://base44.app/api/apps/6a67a778342a8fe05ee79cba/entities/PlatformAccessRegistry?limit=1', {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-App-Id': '6a67a778342a8fe05ee79cba',
      },
    }).catch(() => null);

    const bogusResponse = await fetch('https://base44.app/api/apps/6a67a778342a8fe05ee79cba/entities/PlatformAccessRegistry?limit=1', {
      headers: {
        Authorization: 'Bearer not-a-valid-token',
        'X-App-Id': '6a67a778342a8fe05ee79cba',
      },
    }).catch(() => null);

    return Response.json({
      present: true,
      jwt: true,
      header: {
        alg: header?.alg ?? null,
        kid: header?.kid ?? null,
        typ: header?.typ ?? null,
      },
      payload: {
        iss: payload?.iss ?? null,
        aud: payload?.aud ?? null,
        sub: payload?.sub ?? null,
        iat: payload?.iat ?? null,
        exp: payload?.exp ?? null,
        app_id: payload?.app_id ?? payload?.appId ?? null,
        role: payload?.role ?? null,
        token_type: payload?.token_type ?? payload?.type ?? null,
      },
      introspection: {
        service_token_status: verifyResponse?.status ?? null,
        bogus_token_status: bogusResponse?.status ?? null,
      },
    });
  } catch {
    return Response.json({ present: true, jwt: true, decoded: false }, { status: 200 });
  }
}
