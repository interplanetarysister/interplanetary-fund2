# IFund Cloudflare Email -> private Universal Inbox

This is a **staged integration**, not a live mailbox. It is intentionally
fail-closed until the matching secrets, recipient owner and routing rule exist.

## Flow

Cloudflare Email Routing -> `ifund-email-ingress` Email Worker ->
HMAC-protected Base44 `receiveCloudflareEmail` function ->
owner-only `InboxItem` records -> IFund Universal Inbox on web and APK.

Messages are parsed with `postal-mime`. Only plain text, sender address,
recipient, subject, and Message-ID are retained. HTML and attachments are
not stored. Do not represent this as a complete RFC822 mailbox or reply sender.
Admin inbox uses the existing private record visibility; recipient is set
server-side, not taken from incoming email.

## Before enabling any inbound route

1. Set Base44 runtime secrets:
   - `IFUND_EMAIL_INGRESS_SECRET`: a new, random, >=32-character shared secret.
   - `IFUND_EMAIL_INBOX_OWNER_ID`: exact ID of a verified IFund admin user.
2. From `host/email`, install dependencies with Node 20+ and deploy via
   Wrangler to the existing Cloudflare account.
3. Set Cloudflare Worker secrets:
   - `IFUND_EMAIL_INGRESS_SECRET`: identical to the Base44 secret.
   - `IFUND_EMAIL_RECEIVER_URL`: verified HTTPS endpoint for the Base44
      `receiveCloudflareEmail` function.
   - The approved recipient list is **non-secret** and is set in
     `wrangler.toml` under `[vars].IFUND_EMAIL_ALLOWED_RECIPIENTS`.
     Only the nine addresses listed below are permitted.
4. Verify the function returns 503 with unconfigured secrets and 401 with
   invalid signatures. Test HMAC-signed delivery against a test mailbox,
   private inbox isolation, retries and duplicate Message-IDs.
5. Only after testing, configure Cloudflare Email Routing -> Send to Worker
   for the approved addresses. Confirm at least one real external email is
   visible to the intended admin on web and APK before updating Wix nameservers.

## Approved receiving addresses

- `contact@interplanetaryfund.com`
- `support@interplanetaryfund.com`
- `admin@interplanetaryfund.com`
- `ifund@interplanetaryfund.com`
- `campaigns@interplanetaryfund.com`
- `help@interplanetaryfund.com`
- `developer@interplanetaryfund.com`
- `partner@interplanetaryfund.com`
- `crowdfund@interplanetaryfund.com`

All nine are planned aliases into the existing IFund private admin inbox,
with the original recipient retained in the message text; not separate IMAP
mailboxes. Routes are not activated or demonstrated as deliverable yet.

## No DNS changes from this stage

The active Wix root A and `www` CNAME remain unchanged. The Cloudflare
zone has the matching website records plus email MX/SPF/DKIM staging records.
The nameserver switch must remain deferred until email routing works.

## Important limitations

- This is **receive-only**, not SMTP/IMAP, replies, or message attachment storage.
- Do not publish secrets or provider auth in GitHub or Base44 entity records.
- A recipient allowlist is required; avoid an indiscriminate catch-all.
- Base44 deduplicates matching Message-IDs on retry (best effort; no
  transactional uniqueness on concurrent requests). Review before production.
- Endpoint and Worker deployment require out-of-band secrets, no live
  route should be enabled until verified.
