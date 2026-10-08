import { isPublicCampaignFundraisingEnabled } from './fundraisingMode.ts';

const SUPER_ADMIN_OWNER_EMAILS = new Set([
  'cuddlemeplatonically@gmail.com',
  'interplanetarysister@gmail.com',
]);

function isSuperAdminOwner(user) {
  return user?.role === 'admin' &&
    SUPER_ADMIN_OWNER_EMAILS.has(String(user?.email || '').trim().toLowerCase());
}

// Public campaign fundraising remains closed while PRELAUNCH_MODE is active.
// The authenticated platform owners may run real provider-backed campaign
// payments so the complete ledger/custody/UI path can be verified before launch.
export async function campaignPaymentAccess(base44) {
  const allowed = await isPublicCampaignFundraisingEnabled(base44);
  // Campaign checkout is closed to everyone while the switch is off.
  // Platform donations use a separate, explicitly labeled support link.
  return { allowed, prelaunchTest: false, user: null };
}
