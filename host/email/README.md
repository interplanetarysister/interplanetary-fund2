# Interplanetary Fund — inbound email routing

## Current state
Code staged and Cloudflare Email Worker deployed. **Not live yet.**
Cloudflare domain remains pending Wix nameserver switch, and the current
remote Base44 function is an earlier deployed revision.

## Delivery flow
Cloudflare catch-all for all valid `*@interplanetaryfund.com` recipients
→ `ifund-email-ingress` dedicated Email Worker
→ verified owner forwarding destination `cuddlemeplatonically@gmail.com`
→ optional ECDSA P-256 signed HTTPS mirror into Base44
`receiveCloudflareEmail` → private owner-scoped `InboxItem`
→ IFund Universal Inbox, web and APK.

Gmail forwarding is a fail-safe; the Worker attempts IFund mirroring even when
the forwarded email already succeeded. The signed mirror uses a **private key
stored only in Cloudflare Worker secrets** and a **public key** pinned in the
Base44 receiver's source code. No Base44 secret-management access is needed.

## Priority mailbox categories

Priority: `contact`, `support`, `admin`, `ifund`, `campaigns`, `help`,
`developer`, `partner`, `crowdfund` under `@interplanetaryfund.com`.

All other valid recipient local parts receive normal priority.
IFund's `InboxItem.mailbox_priority` and `recipient_address` are stored,
and the inbox displays Priority and the actual To address. These are not
nine separate mailbox accounts.

## Verified preparation
- Dedicated `ifund-email-ingress` Worker exists in Cloudflare.
- Cloudflare has encrypted `IFUND_EMAIL_SIGNING_PRIVATE_KEY` and
  `IFUND_EMAIL_RECEIVER_URL` bindings.
- Recipient destination `cuddlemeplatonically@gmail.com` is verified
  in Cloudflare Email Routing.
- Local compiled Worker in-memory signed-delivery and forwarding simulation
  passed. This is **not** evidence of external SMTP receipt.
- Cloudflare catch-all rule points to the Worker but is disabled.
- Cloudflare Email Routing activation returned `Active zone required`.
- Wix still serves authoritative DNS; Cloudflare zone status `pending`.
- The deployed Base44 `receiveCloudflareEmail` function returned 503
  `Email intake not configured` when probed, demonstrating that Base44's
  **older** HMAC/secret-based version is still deployed. The new public-key
  verifier is committed and checkpointed but must be deployed.
- Base44 CLI function deployment requested interactive device authentication.
  Do not interpret a saved checkpoint as proof of published backend updates.

## Required activation

1. Authorize the Base44 CLI as the appropriate IFund admin using the device
   login flow, then deploy only `receiveCloudflareEmail` and verify the
   unauthorized request returns 401. Avoid a full site redeploy until the
   user's current release batch is complete.
2. Send one signed test request and verify that exactly one IFund `InboxItem`
   appears for `cuddlemeplatonically@gmail.com`; invalid signatures must
   return 401; repeat submissions must deduplicate; validate tenant isolation.
3. Change Wix **registrar nameservers** (not ordinary NS DNS resource records)
   to `angelina.ns.cloudflare.com` and `ed.ns.cloudflare.com`.
   The Wix DNS-zone REST endpoint is not a registrar delegation endpoint.
4. Wait for Cloudflare to show Active. Enable Cloudflare Email Routing and
   the catch-all Worker rule. Then send a test email from an unrelated account
   to `support@interplanetaryfund.com` and to a non-priority alias.
5. Verify Gmail forwarding and IFund private inbox mirroring, mobile and web;
   only then declare the mail system operational.

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
The UserVerificationMailbox and VerificationMail tables support per-user encrypted account-verification messages. Random verify- aliases cannot be delivered until activated following deployment and end-to-end testing. A verification email must never be forwarded to the organization admin mailbox or exposed to the general agent inbox. Set IFUND_VERIFICATION_EMAIL_KEY as a random base64 32-byte AES key in Base44 secrets. No DNS migration or activation is included in this code change.
