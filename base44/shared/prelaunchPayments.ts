import { PRELAUNCH_MODE } from './prelaunch.js';

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
  if (!PRELAUNCH_MODE) return { allowed: true, prelaunchTest: false, user: null };

  const user = await base44.auth.me().catch(() => null);
  const allowed = isSuperAdminOwner(user);
  return { allowed, prelaunchTest: allowed, user };
}
