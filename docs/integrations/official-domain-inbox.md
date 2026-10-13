# Official @interplanetaryfund.com mail inside IFund — staged implementation

**Status: CODE ONLY / NOT DEPLOYED / NO DNS CHANGES / NO LIVE MAIL PROOF.**  
Owner decision: receive official domain mail **inside IFund's existing Universal Inbox** on the same Base44-backed web and Android app, not in a Gmail-forwarded inbox. Initial approved mailboxes: **support@interplanetaryfund.com** and **info@interplanetaryfund.com**.

## Reuse decision (required GitHub OSS discovery)
- Existing `src/pages/Inbox.jsx` + `InboxItem` entity already expose owner-scoped incoming items. Extend them instead of shipping a duplicate webmail UI.
- Cloudflare Email Service routes an address to a Worker `email()` handler (free inbound routing; sending is a separate product/permission).
- Use [postalsys/postal-mime](https://github.com/postalsys/postal-mime) 4.0.5, license MIT-0, to parse MIME in an Email Worker. Avoid custom MIME parsing.
- Do **not** deploy a self-hosted SMTP server/Mailcow as a shortcut: that requires reliable MX hosts, port 25 reachability, reputation/deliverability and operating resources that have not been approved or verified.
- No new financial ledger, social-provider connection, message sender, background sync or frontend route.

## Data flow
`Cloudflare Email Routing` → dedicated `host/email/worker.mjs` → encrypted-at-rest private R2 RFC822 archive → HMAC-signed HTTPS request → `base44/functions/ingestOfficialEmail/entry.ts` → owner-scoped `InboxItem` record (platform `email`). The already shared web/app Universal Inbox renders the entry after refreshing.

**Inbound only.** No send/reply capability is claimed. R2 retains original attachments/HTML; the first implementation displays plain text in Inbox and does **not** yet include a secure attachment viewer. The Worker must not acknowledge a message as received if durable write fails. When a downstream write fails, an R2 archive copy remains for manual recovery/replay. Replay/reconciliation automation and concurrency-hardening of deduplication remain release gates.

## Configuration prerequisites — do not commit secret values
1. Cloudflare **nameserver delegation** must be verified at the registrar using the *full assigned pair*, and the Cloudflare zone must show Active. Nameservers are neither A, CNAME, nor MX records.
2. Inventory and preserve all current website, Base44, Wix, and Worker DNS records. **Do not replace existing MX without confirming whether another mailbox provider currently receives mail.**
3. Cloudflare dashboard → **Compute → Email Service → Email Routing → Onboard Domain** for `interplanetaryfund.com`. Review provider-generated MX, SPF and DKIM records. Do not separately press **Create SPF** if a valid SPF already exists; do not create two `v=spf1` root TXT policies.
4. Create a private Cloudflare R2 bucket `ifund-official-mail-private` subject to explicit account/billing approval. Apply limited access and a retention/deletion policy before live mail. Do not make bucket public.
5. Deploy the **independent** Worker with `host/email/wrangler.toml` only after offline and staging tests. Keep the existing root `wrangler.toml` and production website untouched.
6. Provision **the same high-entropy 32+ character secret** as `IFUND_MAIL_INGEST_SHARED_SECRET` in both the Cloudflare Worker and Base44 function environment. Keep it server-side; rotate if disclosed.
7. Cloudflare Worker environment: `IFUND_MAIL_ALLOWED_ADDRESSES` is preconfigured to the two approved addresses in `host/email/wrangler.toml`; provision `IFUND_MAIL_INGEST_ENDPOINT` (verified HTTPS Base44 function URL), `IFUND_MAIL_INGEST_SHARED_SECRET`, and the `IFUND_MAIL_ARCHIVE` R2 binding.
8. Base44 function environment: `IFUND_MAIL_ALLOWED_ADDRESSES`, `IFUND_MAIL_INGEST_SHARED_SECRET`, `IFUND_MAIL_OWNER_USER_ID` (verified active admin's Base44 User ID, **not** an email string). Never expose as Vite/client values.
9. In Cloudflare **Email Routing → Routing rules**, create **explicit mailbox addresses** targeting the dedicated Email Worker. Do not enable catch-all without an owner decision: it increases unsolicited mail. No Gmail destination is needed for this design.
10. Verify an independently sent test email arrives in Cloudflare Email logs, R2 and IFund's existing Inbox on the web and Android app with the correct subject, sender and content. Confirm unauthorized/unknown addresses reject safely, duplicate deliveries do not add extra items, attachments are archived privately, message size failures are clear, and malformed or unsigned ingress cannot create records. Verify unrelated website/app routes and payments still work. Only then consider publishing; an actual receiving proof is required.

## Local/static validation
- `cd host/email && node --test signature.test.mjs`
- `cd host/email && node --check signature.mjs && node --check worker.mjs`
- `cd host/email && npm install` (only in a dedicated test environment; resolves postal-mime before using `wrangler dev` and Cloudflare's local simulated email tests).
- Review HMAC freshness, tenant isolation, RLS, HTML safety, attachment retrieval controls, spam/abuse limits and dedup race conditions in staging.
- Do **not** merge or enable live DNS solely because static tests pass.

## Next decision
The owner approved defaulting to `support@interplanetaryfund.com` and `info@interplanetaryfund.com`. Deployment requires authorized access to the Cloudflare dashboard (not available through this chat) and approved Base44 server secret configuration.

## Test evidence (2026-10-13)
- Executed local Node 22 tests from mirrored `host/email/signature.mjs`, `handler.mjs` and their test contracts: approved-recipient allowlist, HMAC tamper detection, SHA-256 known vector, dual-address archive-then-ingest, unsafe destination rejection, oversized mail, failed archive, and failed ingress — **9/9 pass**. The mirrored harness was tested without live providers; full GitHub/Cloudflare integration is not yet verified.
- The actual Cloudflare/PostalMime handler, Base44 ingress function, R2, production DNS, and Android runtime have **not** been integration-tested.
- Confirmed existing production deploy workflow only triggers on a successful `main` quality-gates workflow, therefore this draft branch does not auto-deploy Cloudflare.
- Cloudflare docs confirm Email Routing routes incoming mail via the `email()` handler, and provider-generated DNS records should be reviewed rather than manually guessed: https://developers.cloudflare.com/email-service/get-started/route-emails/

## Recovery
Disable Cloudflare Email Routing rule to the Worker **only after** verifying an alternate valid MX receiver. Keep the private R2 archive for controlled message recovery. Revert the staging branch without touching production HTTP routes. Never delete or overwrite prior MX records during rollback without a receiving mail service.
