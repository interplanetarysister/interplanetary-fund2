# Interplanetary Fund — inbound email routing

## Current state
Cloudflare zone is **active** and delegated to Cloudflare nameservers.
Email Routing is enabled, and the catch-all rule is enabled and points to
the deployed `ifund-email-ingress` Worker.

The admin mirror now targets the production `InterplanetaryFund` Supabase
project (`ssibsfmtodgximseeqsv`), and paid-member ingress targets its
`ifund-member-mail-ingress` Edge Function. The signing private key remains
stored only in Cloudflare Worker secrets.

Verification aliases still use the separate Base44 `receiveCloudflareEmail`
function through `IFUND_EMAIL_RECEIVER_URL`; that path has not been migrated
in this Supabase project transfer. External inbound-message delivery has not
been re-tested after the endpoint switch.

## Delivery flow
Cloudflare catch-all for all valid `*@interplanetaryfund.com` recipients
→ `ifund-email-ingress` dedicated Email Worker
→ verified owner forwarding destination `cuddlemeplatonically@gmail.com`
→ ECDSA P-256 signed HTTPS mirror to production Supabase
`ifund-admin-mail-ingest` → private `admin_inbound_email` storage
→ Supabase-authenticated organizational mailbox in IFund Notifications.
Verification aliases retain a separate receiver. Paid member addresses use
`@mail.interplanetaryfund.com` and a separately signed member ingress.

Gmail forwarding is a fail-safe; the Worker attempts IFund mirroring even when
the forwarded email already succeeded. The signed mirror uses a **private key
stored only in Cloudflare Worker secrets** and a **public key** pinned in the
Supabase receiver's source code. No Base44 secret-management access is needed.

## Priority mailbox categories

Priority: `contact`, `support`, `admin`, `ifund`, `campaigns`, `help`,
`developer`, `partner`, `crowdfund` under `@interplanetaryfund.com`.

All other valid recipient local parts receive normal priority.
IFund's `InboxItem.mailbox_priority` and `recipient_address` are stored,
and the inbox displays Priority and the actual To address. These are not
nine separate mailbox accounts.

## Verified preparation
- Dedicated `ifund-email-ingress` Worker exists in Cloudflare.
- Cloudflare has encrypted `IFUND_EMAIL_SIGNING_PRIVATE_KEY`,
  `IFUND_EMAIL_RECEIVER_URL`, and `IFUND_MEMBER_EMAIL_RECEIVER_URL` bindings.
- `IFUND_ADMIN_EMAIL_RECEIVER_URL` is a public HTTPS binding for the independent
  organization receiver. The original secret URL remains for verification.
- Recipient destination `cuddlemeplatonically@gmail.com` is verified
  in Cloudflare Email Routing.
- Local compiled Worker in-memory signed-delivery and forwarding simulation
  passed. This is **not** evidence of external SMTP receipt.
- Cloudflare zone status is `active`; nameservers are
  `angelina.ns.cloudflare.com` and `ed.ns.cloudflare.com`.
- Email Routing settings are enabled and the catch-all rule is enabled.
- The admin and member Supabase receiver URLs were switched to the
  `InterplanetaryFund` destination on 2026-10-31.
- The verification-alias path still points to Base44. Its previously probed
  `receiveCloudflareEmail` revision returned 503 `Email intake not configured`;
  verification aliases therefore remain a separate unfinished migration.
- No external SMTP round-trip has been run after the Supabase endpoint switch.
- Base44 CLI function deployment requested interactive device authentication.
  Do not interpret a saved checkpoint as proof of published backend updates.

## Remaining validation

1. Test the deployed admin and member Edge Function endpoints with invalid
   signatures and expired timestamps; both must reject with 401.
2. Test an authorized signed synthetic message, persistence and deduplication
   without sending real email to users. Confirm member mailbox entitlement,
   quota and duplicate handling.
3. Test the standalone `/admin/organization-mail` route with an authenticated
   administrator, including list, read/unread, audit, sign-out and denied users.
4. Before sending external mail, verify Gmail forwarding, signed persistence,
   privacy, audit and the member mailbox's no-fallback rejection behavior.
5. Migrate the verification-alias receiver from Base44 separately. Keep
   verification messages encrypted, user-scoped and excluded from the general
   organization inbox and agent tools.
6. Independently verify the website build, Capacitor web assets and Android
   authentication/CORS parity. Do not cancel Base44 or replace the final
   Android package until the independent release gate passes.

## Known limitations

- This is inbound plain-text mirroring, not an SMTP/IMAP mailbox.
- Email HTML and attachments are retained by the forwarding Gmail destination,
  but are not stored in Base44.
- Mirroring failures are logged and do not block forwarding.
- Email catch-all addresses are vulnerable to guessing/spam; use rate controls
  and filtering before marketing these addresses.
- The platform's existing notification/social inbox must not be disabled
  and DNS changes must preserve the apex A and www CNAME website records.

## Private verification aliases (staged)
The VerificationMailbox and VerificationMail tables support per-user encrypted account-verification messages. Random verify- aliases cannot be delivered until activated following deployment and end-to-end testing. A verification email must never be forwarded to the organization admin mailbox or exposed to the general agent inbox. Set IFUND_VERIFICATION_EMAIL_KEY as a random base64 32-byte AES key in Base44 secrets. No DNS migration or activation is included in this code change.
