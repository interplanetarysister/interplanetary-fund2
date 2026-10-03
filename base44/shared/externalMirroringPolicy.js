export const EXTERNAL_MIRRORING_DISABLED_REASON =
  'external mirroring is disabled until per-owner provider binding and scheduled authorization are verified';

// Keep the denial at the production execution seam. Optional dependencies are
// accepted only so deterministic tests can prove that denial occurs before a
// connection read, provider fetch, or SocialPost write.
export async function runExternalMirroring({
  getConnections,
  fetchProviderPosts,
  createSocialPost,
} = {}) {
  void getConnections;
  void fetchProviderPosts;
  void createSocialPost;

  return {
    mirrored: 0,
    duplicates_skipped: 0,
    disabled: true,
    reason: EXTERNAL_MIRRORING_DISABLED_REASON,
    platforms: {},
  };
}
