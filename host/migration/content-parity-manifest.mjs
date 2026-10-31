// IFund migration staging inventory, 2026-10-24.
// This is an audit manifest, not authorization to activate migrated data.
export const STAGED_CONTENT = Object.freeze({
  HelpArticle: 6, FeatureFlag: 24, PublicProfile: 2,
  DiscussionPost: 2, Community: 2, FoundingWaitlist: 2,
  SupportTicket: 1, AgentConversationRun: 13, Notification: 94,
  SocialPost: 10, Agent: 10, Recommendation: 100,
});
export const OTHER_STAGED = Object.freeze({
  Campaign: 27, CampaignUpdate: 10, PlatformConnection: 32,
});
export const SOURCE_COUNTS = Object.freeze({
  HelpArticle: 6, FeatureFlag: 24, PublicProfile: 2,
  DiscussionPost: 2, Community: 2, FoundingWaitlist: 2,
  SupportTicket: 1, AgentConversationRun: 13, Notification: 94,
  SocialPost: 15, Agent: 18, Recommendation: 836, CommunityMember: 2, Message: 1,
  Campaign: 27, CampaignUpdate: 10, PlatformConnection: 32,
  User: 10, LegalAcceptance: 5, AuthorizationGrant: 2,
  PayPalBillingWebhook: 1, Donation: 0, Withdrawal: 0,
});
export function migrationStatus(type, destinationCount = STAGED_CONTENT[type] ?? OTHER_STAGED[type] ?? 0) {
  const sourceCount = SOURCE_COUNTS[type];
  if (!Number.isInteger(sourceCount)) throw new Error('unknown_entity_type');
  if (!Number.isInteger(destinationCount) || destinationCount < 0) throw new Error('invalid_destination_count');
  return { entityType: type, sourceCount, destinationCount,
    missingCount: Math.max(0, sourceCount - destinationCount),
    countParity: sourceCount === destinationCount,
    productionReady: false };
}
export const ACTIVATION_BLOCKERS = Object.freeze([
  'owner_authentication', 'tenant_rls', 'consent_proof', 'field_parity',
  'media_copy_and_url_rewrite', 'payment_provider_reconciliation',
  'agent_history_and_retry_parity', 'base44_api_dependency_removal',
  'live_end_to_end_tests', 'rollback_verified',
]);
