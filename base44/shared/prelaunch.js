// Single source of truth for temporary prelaunch fundraising behavior.
// Set PRELAUNCH_MODE to false when Interplanetary Fund officially opens public
// campaign fundraising. Payment functions and public UI both consume this flag.
export const PRELAUNCH_MODE = true;

export const PRELAUNCH_HEADLINE = "PRELAUNCH PREVIEW — NOT YET OPEN FOR PUBLIC FUNDRAISING";
export const PRELAUNCH_NOTICE = "Interplanetary Fund is currently in development. This site is a preview. Any donations currently accepted support the development and operation of Interplanetary Fund itself and are not donations to individual campaigns.";
export const PRELAUNCH_PAYMENT_NOTICE = "Prelaunch donation: this payment supports the development and operation of Interplanetary Fund itself. It does not fund or get credited to the displayed individual campaign.";
