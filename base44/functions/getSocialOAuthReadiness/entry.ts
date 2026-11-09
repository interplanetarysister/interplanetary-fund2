import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { OAUTH_ENV } from '../../shared/connectionVerification.ts';

// Read-only readiness for the social destinations whose sign-in cannot be
// self-served until the provider approves IFund. Nothing here authorizes a
// connection, issues an OAuth URL, or claims a scope is granted: it reports the
// provider review gate and whether IFund's own OAuth client is registered.
const EXTRA_ENV: Record<string, string> = {
  x: 'APP_USER_CONNECTOR_X_ID',
  youtube: 'APP_USER_CONNECTOR_YOUTUBE_ID',
};

const REVIEW_GATE: Record<string, string> = {
  facebook_pages: 'Meta App Review and business verification required',
  instagram: 'Meta App Review and business verification required',
  linkedin: 'LinkedIn org permissions need approval',
  x: 'X developer app review required',
  tiktok: 'TikTok app audit required',
  youtube: 'Google verification required for upload scope',
};

const PROVIDER_NAME: Record<string, string> = {
  facebook_pages: 'Meta',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  x: 'X',
  tiktok: 'TikTok',
  youtube: 'Google',
};

const LABEL: Record<string, string> = {
  facebook_pages: 'Connect Facebook Page',
  instagram: 'Connect Instagram',
  linkedin: 'Connect LinkedIn',
  x: 'Connect X',
  tiktok: 'Connect TikTok',
  youtube: 'Connect YouTube',
};

const PLATFORMS = ['facebook_pages', 'instagram', 'linkedin', 'x', 'tiktok', 'youtube'];

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });

    const providers = PLATFORMS.map((platform) => {
      const envName = OAUTH_ENV[platform] || EXTRA_ENV[platform] || '';
      let registered = false;
      if (envName) {
        try {
          registered = Boolean(Deno.env.get(envName));
        } catch {
          registered = false;
        }
      }
      const gate = REVIEW_GATE[platform];
      const disabled_reason = registered
        ? gate
        : `${gate}; IFund's own ${PROVIDER_NAME[platform]} client credentials are not registered yet.`;
      return {
        platform,
        // No social destination can be connected without IFund's client and the
        // provider's own approval, so self-service is never available here.
        self_serve: false,
        review_required: true,
        credentials_present: registered,
        button_label: LABEL[platform],
        disabled_reason,
      };
    });

    return Response.json({ ok: true, providers }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('getSocialOAuthReadiness:', error instanceof Error ? error.name : 'UnknownError');
    return Response.json({ error: 'Social connection readiness is unavailable.' }, { status: 500 });
  }
}