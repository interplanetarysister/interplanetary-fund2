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