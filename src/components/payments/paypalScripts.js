// Dynamically loads the PayPal JS SDK (with the Google Pay payments component)
// and Google's own Pay button library. Both are idempotent/cached so repeated
// renders of the Google Pay button don't re-add the scripts.

let gpayPromise = null;
export function loadGooglePayScript() {
  if (gpayPromise) return gpayPromise;
  gpayPromise = new Promise((resolve, reject) => {
    if (window.google?.payments?.api) return resolve();
    const s = document.createElement("script");
    s.src = "https://pay.google.com/gp/p/js/pay.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { gpayPromise = null; reject(new Error("Failed to load Google Pay")); };
    document.head.appendChild(s);
  });
  return gpayPromise;
}

// Loads the PayPal JS SDK with the hosted-buttons component, for the
// platform's PayPal Hosted Button (configured in the PayPal dashboard).
// Separate from loadPayPalSdk because the hosted button is tied to its own
// PayPal client-id; cached so repeated renders don't re-add the script.
let ppHostedPromise = null;
const PAYPAL_HOSTED_CLIENT_ID =
  "BAACS0eGibmx5Rq9xWFqsgzyfLxl6xyCz41SfeO46Giq0E-Y7xqJyf3h2KnTChXWjRMbVnsrowVRDWqJMs";
export function loadPayPalHostedButtons() {
  if (ppHostedPromise) return ppHostedPromise;
  ppHostedPromise = new Promise((resolve, reject) => {
    if (window.paypal?.HostedButtons) return resolve();
    const s = document.createElement("script");
    s.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_HOSTED_CLIENT_ID}&components=hosted-buttons&enable-funding=venmo&currency=USD`;
    s.crossOrigin = "anonymous";
    s.async = true;
    s.onload = () => {
      if (window.paypal?.HostedButtons) resolve();
      else { ppHostedPromise = null; reject(new Error("PayPal Hosted Buttons unavailable")); }
    };
    s.onerror = () => { ppHostedPromise = null; reject(new Error("Failed to load PayPal Hosted Buttons")); };
    document.head.appendChild(s);
  });
  return ppHostedPromise;
}

let ppPromise = null;
export function loadPayPalSdk(clientId) {
  if (ppPromise) return ppPromise;
  ppPromise = new Promise((resolve, reject) => {
    if (window.paypal?.createInstance) return resolve();
    const s = document.createElement("script");
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&components=googlepay-payments&intent=capture&currency=USD`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { ppPromise = null; reject(new Error("Failed to load PayPal SDK")); };
    document.head.appendChild(s);
  });
  return ppPromise;
}