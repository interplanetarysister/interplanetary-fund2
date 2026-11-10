# Interplanetary Fund — original Base44 implementation (legacy reference)

**Official platform URL:** https://interplanetaryfund.com

**Independent canonical source repository:** https://github.com/interplanetarysister/InterplanetaryFund

**Original Base44 app (legacy reference only):** https://interplanetaryfund.base44.app

This repository retains the original Base44 implementation for migration reconciliation. The independent React/Vite + Supabase + Cloudflare implementation belongs in `InterplanetaryFund`; do not treat the Base44 app as the new production destination. The original app and its backend remain in service until verified replacement and owner-approved retirement. The Base44 links and environment values below are deliberately retained for running this historical source, **not** public site links.

---

# Base44 Project

Use this repository to run and edit the app locally, then publish changes back through Base44.

Any change pushed to the repo will also be reflected in the Base44 Builder.

## Prerequisites

1. Clone the repository using the project's Git URL.
2. Navigate to the project directory.
3. Install dependencies: `npm install`.
4. Install the Base44 CLI: `npm install -g base44@latest`.

See the [Base44 CLI docs](https://docs.base44.com/developers/references/cli/get-started/overview) if you want to run Base44 commands directly.

## Run Locally

Run the full local development environment from the project root:

```bash
base44 dev
```

`base44 dev` starts the local Base44 development backend and, when this app is configured for it, also starts the frontend dev server for you. Use the frontend URL printed by the command.

For example, when the Base44 project config includes a `serveCommand`, `base44 dev` can launch the frontend too:

```json5
{
  "site": {
    "serveCommand": "npm run dev"
  }
}
```

In a Base44 project this lives in `base44/config.jsonc`.

## Run Only The Frontend

If you only want to work on the frontend against the hosted Base44 backend, run:

```bash
npm run dev
```

Open the local URL printed by Vite.

## Use The Hosted Backend

For frontend-only development, create or update `.env.local` in the project root:

```bash
VITE_BASE44_APP_ID=your_app_id
VITE_BASE44_APP_BASE_URL=https://interplanetaryfund.base44.app
```

`VITE_BASE44_APP_ID` identifies the Base44 app.

`VITE_BASE44_APP_BASE_URL` tells the Base44 Vite plugin where to send local `/api` requests. Point it at your deployed Base44 app URL when you want the local frontend to use the hosted backend.

When you use `base44 dev`, the command injects the local Base44 values for you, so `.env.local` is mainly needed for frontend-only workflows.

## Publish Your Changes

After pushing your changes to git, open the Base44 dashboard and publish the app:

```bash
base44 dashboard open
```

## Docs & Support

Documentation: [https://docs.base44.com/Integrations/Using-GitHub](https://docs.base44.com/Integrations/Using-GitHub)

Base44 CLI command reference: [https://docs.base44.com/developers/references/cli/commands/introduction](https://docs.base44.com/developers/references/cli/commands/introduction)

Support: [https://app.base44.com/support](https://app.base44.com/support)


## PayPal sandbox demonstration (no real money)

Live fundraising is intentionally paused. A sandbox demonstration path exists so the checkout flow can be shown safely, and it is **off by default**.

To enable it:

1. In the PayPal developer dashboard (Sandbox → Apps & Credentials), copy the sandbox **Client ID** and **Secret**.
2. Add secrets `PAYPAL_SANDBOX_CLIENT_ID`, `PAYPAL_SANDBOX_CLIENT_SECRET`, and (optional) `PAYPAL_SANDBOX_MERCHANT_EMAIL`.
3. Register the webhook URL `https://interplanetaryfund.base44.app/functions/payPalCampaignWebhook` for sandbox events `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.PENDING`, `PAYMENT.CAPTURE.DENIED`, and `PAYMENT.CAPTURE.REFUNDED`, then add its ID as `PAYPAL_SANDBOX_WEBHOOK_ID`.
4. Turn on the `paypal_sandbox_demo` feature flag.

Check readiness any time with the admin function `paypalSandboxReadiness`. Sandbox money is recorded with `environment: "sandbox"` and is never counted in campaign totals, the financial ledger, analytics, withdrawal balances, or payouts. Use a PayPal sandbox **personal** account to pay.

## Copyright and reuse

© 2026 Interplanetary Fund. All rights reserved in original protectable IFund materials held by their lawful owners. Details: [LICENSE](LICENSE) and [Copyright & Intellectual Property](https://interplanetaryfund.com/help/copyright-and-intellectual-property). Third-party open-source software and member submissions remain governed by their own rights and licenses.
