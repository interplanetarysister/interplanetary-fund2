import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const chat = read("src/components/agents/AgentChat.jsx");
const dialog = read("src/components/connections/ConnectDialog.jsx");
const plans = read("src/pages/Subscriptions.jsx");
const billing = read("base44/functions/getPayPalSubscriptionOptions/entry.ts");
const webhook = read("base44/functions/setupPayPalSubscriptionWebhook/entry.ts");

assert.match(chat, /createPortal\(composer, document\.body\)/, "mobile composer must escape animated page transforms");
assert.match(chat, /bottom-\[calc\(6rem\+env\(safe-area-inset-bottom\)\)\]/, "mobile composer must clear bottom navigation and safe area");
assert.match(chat, /overflow-y-auto overscroll-y-contain touch-pan-y/, "conversation history must support touch scrolling");
assert.match(dialog, /max-h-\[calc\(100dvh-1\.5rem\)\]/, "connection dialog must fit the mobile viewport");
assert.match(dialog, /setOauthReadiness\("not_configured"\)|"not_configured"/, "show missing IFund provider setup separately from user sign-in failure");
assert.match(plans, /Saved PayPal price mappings:/, "admin must see catalog records independently");
assert.match(plans, /Checkout-ready prices:/, "admin must see provider-verified readiness independently");
assert.match(billing, /saved_plan_mapping_count: savedMappingCount/, "backend must expose non-secret mapped catalog count for admin");
assert.match(billing, /webhook_not_verified/, "backend must not mislabel missing webhook as missing plans");
assert.match(webhook, /stage = 'register_paypal_webhook'/, "admin setup must identify failing stage safely");

console.log("Mobile AI chat, platform sign-in, and PayPal billing UX regression contract passed.");
