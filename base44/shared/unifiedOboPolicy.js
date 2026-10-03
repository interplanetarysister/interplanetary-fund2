// Pure policy helper kept in JavaScript so Node 20 contract checks can execute
// the same revocation rule used by Base44 functions.
export function isUnifiedOboRevoked(user) {
  return user?.ai_obo_consent?.granted === false;
}
