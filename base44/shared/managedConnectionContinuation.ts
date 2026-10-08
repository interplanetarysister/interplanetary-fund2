export const ACTIVE_MANAGED_DELEGATION_STATUSES = [
  'assigned',
  'in_progress',
  'waiting_user',
  'waiting_external',
  'needs_review',
];

const cleanPart = (value: unknown) => encodeURIComponent(String(value ?? '').trim().toLowerCase());

export function managedConnectionRequestKey(input: {
  ownerUserId: string;
  platform: string;
  action: string;
  connectionId?: string;
  campaignId?: string;
  consentVersion: string;
}) {
  return [
    'managed-connection-v1',
    cleanPart(input.ownerUserId),
    cleanPart(input.platform),
    cleanPart(input.action),
    cleanPart(input.connectionId || '-'),
    cleanPart(input.campaignId || '-'),
    cleanPart(input.consentVersion),
  ].join(':');
}

export function verifiedAccountCreationTransport(recipe: any, transports: string[]) {
  const successful = String(recipe?.successful_route || '').trim();
  return recipe?.status === 'proven'
    && successful === 'oauth'
    && transports.includes(successful)
    ? successful
    : null;
}

export function reusableManagedDelegation(rows: any[], requestKey: string) {
  return (rows || [])
    .filter((row) =>
      row?.request_key === requestKey
      && ACTIVE_MANAGED_DELEGATION_STATUSES.includes(row?.status),
    )
    .sort((left, right) => {
      const byCreated = String(left?.created_at || '').localeCompare(String(right?.created_at || ''));
      return byCreated || String(left?.id || '').localeCompare(String(right?.id || ''));
    })[0] || null;
}

export function validateManagedRequestIdentity(row: any, expected: {
  requestKey: string;
  ownerUserId: string;
  platform: string;
  action: string;
  campaignId: string;
  consentVersion: string;
}) {
  if (!row || row.request_key !== expected.requestKey) return 'request_mismatch';
  if (row.owner_user_id !== expected.ownerUserId) return 'owner_mismatch';
  if (row.destination_agent !== 'managed_connection_agent') return 'destination_mismatch';
  if (String(row.campaign_id || '') !== expected.campaignId) return 'campaign_mismatch';
  if (row.consent_version !== expected.consentVersion) return 'consent_mismatch';
  if (row?.continuation_state?.platform !== expected.platform) return 'platform_mismatch';
  if (row?.continuation_state?.requested_action !== expected.action) return 'action_mismatch';
  return null;
}

export function validateManagedResume(input: {
  delegation: any;
  ownerUserId: string;
  consentGranted: boolean;
  consentVersion: string;
  requestKey: string;
  platform: string;
  action: string;
}) {
  const { delegation } = input;
  if (!delegation || delegation.owner_user_id !== input.ownerUserId) return 'owner_mismatch';
  if (!input.consentGranted) return 'consent_revoked';
  if (!input.consentVersion || delegation.consent_version !== input.consentVersion) return 'consent_mismatch';
  if (!input.requestKey || delegation.request_key !== input.requestKey) return 'request_mismatch';
  if (!ACTIVE_MANAGED_DELEGATION_STATUSES.includes(delegation.status)) return 'delegation_inactive';
  if (delegation?.continuation_state?.platform !== input.platform) return 'platform_mismatch';
  if (delegation?.continuation_state?.requested_action !== input.action) return 'action_mismatch';
  return null;
}

export function completionDelegation(rows: any[], requestedId: string, connectionId: string, consentVersion: string) {
  const eligible = (rows || []).filter((row) =>
    (!requestedId || row?.id === requestedId)
    && ACTIVE_MANAGED_DELEGATION_STATUSES.includes(row?.status)
    && row?.consent_version === consentVersion
    && row?.continuation_state?.continuation_ref === connectionId,
  );
  return eligible.sort((left, right) => {
    const byCreated = String(left?.created_at || '').localeCompare(String(right?.created_at || ''));
    return byCreated || String(left?.id || '').localeCompare(String(right?.id || ''));
  })[0] || null;
}
