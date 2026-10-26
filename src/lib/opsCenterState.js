export const OPS_LOAD_ERROR = "We couldn't load Ops Center data.";

export function opsLoadFailureState({ preserveData }) {
  return {
    pageError: preserveData ? null : OPS_LOAD_ERROR,
    providerState: "unavailable",
  };
}

export function opsRefreshFailureMessage({ preserveData }) {
  return preserveData
    ? "Refresh failed — showing the last loaded data."
    : "Refresh failed. Please try again.";
}
