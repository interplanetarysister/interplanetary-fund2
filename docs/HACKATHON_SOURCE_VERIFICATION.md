# Base44 companion source verification

Verified locally on 2026-11-12 against upstream base `a171ced67a547760955e8d5c0b59c67946abd900`, using Node 24.22.1 and npm 11.9.0. This report covers the original Base44 source companion. It does not certify a production deployment, real provider transaction, or Devpost submission.

The companion now sends both judge and sandbox-checkout links to the dedicated demonstration:
<https://ifund-hackathon-demo.interplanetary-fund.workers.dev/hackathon>.
The independent demo is responsible for its sandbox payment and AI execution evidence.

## Repairs

- Reuse the existing integer-cent `computeWithdrawal` helper and `PLATFORM_FEE_RATE` for the external-fund migration preview, correcting the old 3% preview to the mandated 7%. A recorded external transfer remains an observation, not settled custody or a payout.
- Add Fundly to `PlatformConnection.platform` so the entity accepts the provider already present in the existing catalog.
- Keep the latest financial center, campaign analytics, AI experience and other upstream work. Remove four unused imports introduced upstream.
- Update stale source contracts to follow the existing explicit PayPal environment helper, hosted-card channel, approval variable, current donor labels and connection setup/error states. Preserve server allocation ordering, capture verification, immutable financial operation, ledger, recovery, authorization and error-disclosure assertions.
- Verify the new lazy financial center and its four lazy panels, together with legacy giving/ledger/withdrawal redirects. No eager panel import is permitted by the revised contract.

No payment settings, provider bindings, production data, DNS, Base44 application state, withdrawals or payout controls were changed by this source repair.

## Local evidence

All results below are local. Browser APIs and AI/provider responses were fixtures; no capture, payout, paid Base44 operation or real AI inference was performed by these tests.

| Command/check | Result | Evidence |
| --- | --- | --- |
| `npm run build` including postbuild | PASS | Production build, bundle/link/assets, mobile/billing, admin readiness, permissions/mail, cutover, fees, integration registry and PayPal webhook contracts passed. |
| `npm run lint` | PASS | ESLint exited 0 with no errors. |
| `npm run typecheck` | PASS | TypeScript exited 0. |
| `npm run test:payments` | PASS | Fee math, Stripe idempotency, financial integrity, PayPal recovery, account deletion/guard, order limits, checkout/wallet/Apple Pay contracts, fundraising mode and donor totals passed. |
| Deterministic run steps from `.github/workflows/quality-gates.yml` | PASS, 43/43 | Each step exited 0. Build, lint and payment jobs above ran separately. Preview used strict port 4475 locally to prevent another workspace application's port 4173 from producing a false success. |
| `npm run verify:design-ux` | PASS | Guest drawer at 320/390/767px, desktop at 768/1280px, member/admin navigation, themes, connection grid, donation dialog at 320/375/390/768px and campaign AI choice controls passed. |
| `npm run verify:campaign-creation` | PASS | 5 draft-handler cases and 7 generated-cover endpoint cases, including authentication and provider failures. |
| `npm run verify:host-portability` | PASS | Host-portability and admin-agent contract passed. |
| Local companion browser smoke | PASS | 320/390/768/1440px; exact built HTML, common independent-demo links, fictional financial disclosure, no horizontal overflow and no browser exceptions. |
| `git diff --check` | PASS | No whitespace errors. |

Representative output:

```text
PayPal campaign checkout contract verified.
PayPal/Google Pay fee, readiness, and SDK contracts verified.
Apple Pay gated checkout, captured ledger path, and recovery contracts verified.
Donor pledge, tip, receipts, historical ledgers and wallet totals passed.
PASS payment layout 320px button fully visible and clickable; no capture made
PASS payment layout 768px button fully visible and clickable; no capture made
PASS five title choices, five summary choices, one editable value for each
PASS: 5 draft handler cases; schema, resume, generated media URL/load/error, intrinsic image sizing and raw fallback.
PASS: 7 generated cover endpoint cases (success, response variants, authentication, malformed provider response, exception).
Host portability and admin-agent contract passed
```

The Base44 AI-choice fixture preserves this original application's five title/five summary controls. The separate judge demo's five-title/two-description requirement needs its own provider-backed evidence.

Full local output and screenshots are under `work/build-review/` (`*-final.log`, `quality-results.json`, `quality-*.log`, `hackathon-*.png`). They are intentionally excluded from source publishing. The additional companion smoke harness is `work/build-review/hackathon-smoke.mjs`.

### Fixture artifact boundary

The final local browser artifact was built with the existing public app ID and `VITE_BASE44_APP_BASE_URL=http://127.0.0.1:4499`. No backend was started at that address. Specific fixture routes answered authentication and application calls; any unmatched API call stayed on loopback. This isolates the tests from Base44 and provider billing.

**Do not release this `dist/` artifact.** A release must be rebuilt from the reviewed source using the actual authorized runtime configuration, then verified on the deployed host. Build/lint/typecheck and source contracts are evidence for source correctness, not deployed financial persistence.

## Reuse and branch reconciliation

The branch fast-forwarded from `3179761` to upstream `a171ced` before these repairs were reapplied. Open PRs #548, #547, #538 and #540 were inspected by changed paths; none overlaps this batch's source paths. They retain their own functional and financial review requirements.

Existing implementations were reused instead of adding dependencies or services: React lazy/Suspense (<https://github.com/react/react>, MIT), ESLint (<https://github.com/eslint/eslint>, MIT), Node assert/test execution (<https://github.com/nodejs/node>; core permissive license inspected in `LICENSE`, with separate bundled third-party notices), the existing Playwright/Vite fixtures and the internal fee calculator. The source repositories were active and unarchived when checked. No third-party implementation was copied, no dependency was added and no additional recurring service was enabled. The repair is reversible by reverting this source batch; existing PayPal/backend authorization stays intact.

## Release gates owned outside this source report

- Build a production artifact with verified runtime configuration; publish only the reviewed commit through the authorized source/deployment path.
- Verify the deployed companion and actual authenticated financial views; preserve current production payment settings and live/sandbox separation.
- Attach genuine independent-demo PayPal capture, webhook, replay, ledger and receipt evidence, and real AI execution evidence. Fixture success above cannot substitute for those records.
- Complete the current official hackathon rules/video/submission matrix and judge walkthrough in the demo repository. No compliance or deadline eligibility claim is made here.
