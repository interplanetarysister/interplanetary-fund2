export const RECIPE_TRANSPORTS = new Set([
  'oauth',
  'api',
  'webhook',
  'token',
  'authenticated_browser',
  'public_browser',
  'manual',
]);

export const RECIPE_RESULTS = new Set(['failure', 'stale']);
const MAX_RECIPE_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function recipeKey(value) {
  const key = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return /^[a-z0-9][a-z0-9_-]{0,63}$/.test(key) ? key : '';
}

function safeString(value, max = 128) {
  return typeof value === 'string' ? value.replace(/[\r\n\t]+/g, ' ').trim().slice(0, max) : '';
}

function safeTransportList(value) {
  if (!Array.isArray(value) || value.length > 8) return [];
  return [...new Set(value.filter((item) => RECIPE_TRANSPORTS.has(item)))];
}

export function recipeIsFreshAndProven(recipe, now = Date.now()) {
  if (!recipe || recipe.status !== 'proven') return false;
  const verifiedAt = Date.parse(recipe.last_verified_at || '');
  return Number.isFinite(verifiedAt) && now - verifiedAt >= 0 && now - verifiedAt <= MAX_RECIPE_AGE_MS;
}

export function recipeTransportOrder(recipe, now = Date.now()) {
  if (!recipeIsFreshAndProven(recipe, now)) return [];
  const preferred = RECIPE_TRANSPORTS.has(recipe.preferred_transport) ? recipe.preferred_transport : '';
  return [...new Set([preferred, ...safeTransportList(recipe.fallback_transports)].filter(Boolean))];
}

export function sanitizedCapability(recipe, platform, operation, now = Date.now()) {
  const available = recipeTransportOrder(recipe, now).length > 0;
  return {
    platform,
    operation,
    available,
    status: available ? 'available' : 'unavailable',
    requires_provider_authorization: true,
    next_step: available ? 'Continue with the provider authorization shown in Connections.' : 'No verified connection method is available yet.',
  };
}

export function adminRecipeView(recipe, platform, operation, now = Date.now()) {
  if (!recipe) return { platform, operation, status: 'missing', transport_order: [], rediscovery_required: true };
  const status = ['proven', 'probation', 'stale', 'disabled'].includes(recipe.status) ? recipe.status : 'stale';
  const safe = {
    id: safeString(recipe.id, 128),
    platform,
    operation,
    recipe_version: Number.isSafeInteger(recipe.recipe_version) && recipe.recipe_version > 0 ? recipe.recipe_version : 1,
    status,
    preferred_transport: RECIPE_TRANSPORTS.has(recipe.preferred_transport) ? recipe.preferred_transport : '',
    fallback_transports: safeTransportList(recipe.fallback_transports),
    connector_type: safeString(recipe.connector_type, 80),
    worker_key: safeString(recipe.worker_key, 80),
    required_capabilities: Array.isArray(recipe.required_capabilities)
      ? [...new Set(recipe.required_capabilities.map((item) => safeString(item, 80)).filter(Boolean))].slice(0, 20)
      : [],
    last_verified_at: safeString(recipe.last_verified_at, 64),
  };
  const transportOrder = recipeTransportOrder(safe, now);
  return {
    platform,
    operation,
    recipe: safe,
    transport_order: transportOrder,
    rediscovery_required: transportOrder.length === 0,
  };
}

export function safeRecipeFailure(result, transport, code) {
  if (!RECIPE_RESULTS.has(result) || !RECIPE_TRANSPORTS.has(transport)) return null;
  const failureCode = safeString(code, 80);
  if (!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(failureCode)) return null;
  return { result, transport, code: failureCode };
}
