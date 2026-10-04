import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { hasImplementedDirectPublishAdapter, hasVerifiedManualShare, resolveCapabilities, REGISTRY_VERSION } from '../../shared/providerCapabilities.ts';

// Canonical provider-capability listing. Delegates to the shared resolver so
// the UI and financial execution see the same capability interpretation.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error:'Unauthorized' }, { status:401 });
    const sr = base44.asServiceRole;
    const providers = (await resolveCapabilities(sr)).map((provider) => ({
      ...provider,
      direct_publish_eligible: hasImplementedDirectPublishAdapter(provider),
      manual_share_eligible: hasVerifiedManualShare(provider),
    }));
    return Response.json({ providers, registry_version: REGISTRY_VERSION });
  } catch (error) {
    console.error('listFundraisingProviderCapabilities failed:', error?.message || error);
    return Response.json({ error:'Could not load fundraising provider capabilities.' }, { status:500 });
  }
}
