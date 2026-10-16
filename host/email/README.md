# IFund Email Routing — catch-all and priority mailboxes

Status: **staged, not live**. Wix nameservers stay unchanged until the complete
mail delivery path is verified. Cloudflare Email Routing must remain disabled
until all prerequisites pass.

## Architecture

Cloudflare Email Routing (catch-all for *@interplanetaryfund.com)
→ dedicated `ifund-email-ingress` Cloudflare Email Worker
→ HTTPS request signed with HMAC-SHA256
→ Base44 `receiveCloudflareEmail`
→ private owner-scoped `InboxItem`
→ IFund Universal Inbox on web and APK.

The receiving Worker is separate from the existing website/MCP Worker. Do not
assign website routes to it or modify the website Worker for mail delivery.

## Priority mailboxes

- contact@interplanetaryfund.com
- support@interplanetaryfund.com
- admin@interplanetaryfund.com
- ifund@interplanetaryfund.com
- campaigns@interplanetaryfund.com
- help@interplanetaryfund.com
- developer@interplanetaryfund.com
- partner@interplanetaryfund.com
- crowdfund@interplanetaryfund.com

These nine are marked `mailbox_priority = priority` in IFund.
Every other syntactically valid address at the domain receives
`mailbox_priority = normal`. This is a catch-all, not nine separate mailbox
accounts. IFund keeps the exact original address in `recipient_address`.
The inbox sorts open priority messages ahead of other messages and displays
the original recipient.

## Configuration and activation

1. Set Base44 runtime encrypted secrets:
   - `IFUND_EMAIL_INGRESS_SECRET`: new randomly generated string >= 32 characters.
   - `IFUND_EMAIL_INBOX_OWNER_ID`: verified IFund admin account ID approved
     to receive all domain email. Keep mailbox messages private to that user.
2. The dedicated Cloudflare Worker is uploaded under `ifund-email-ingress`.
   Configure its encrypted Worker secrets:
   - `IFUND_EMAIL_INGRESS_SECRET`: EXACTLY the Base44 secret from step 1.
   - `IFUND_EMAIL_RECEIVER_URL`: deployed, verified HTTPS endpoint of the
     Base44 `receiveCloudflareEmail` function.
3. Ensure the Base44 receiver deployment is active. Verify incorrect and
   missing signatures fail with 401, wrong domain fails with 400, and correct
   signed test delivery creates only one private inbox item on retries.
4. Test at least one priority address and one non-priority address in both
   web and app; check sender, recipient, original body, classification and
   lack of cross-user access. Add inbound spam/abuse and storage protections.
5. Only once these checks pass, enable Cloudflare Email Routing and its
   catch-all worker rule. Wix still owns live DNS until you deliberately
   replace Wix nameservers with the two assigned Cloudflare nameservers.
   Check A/CNAME, MX/SPF/DKIM and HTTPS before making that switch.
6. After delegation has propagated, test receiving an external email from
   an unrelated provider to each category. Track and correct any failures.

Cloudflare catch-all currently points to `ifund-email-ingress` but is
`enabled: false`. Turning it on early would not make email operational.

## Security, limits and scope

- This implementation receives **plain-text mail only**, not an SMTP/IMAP
  mailbox. It does not provide outgoing replies, attachments, sent-mail
  tracking, or HTML storage. The IFund reply draft button does not send email.
- Worker refuses messages larger than 2 MB and validates the recipient domain.
  Base44 stores at most 12,000 text characters per incoming message.
- The shared HMAC signature, timestamp window, admin owner and RLS protect the
  private backend. Never commit secret values or use unprotected HTTP routes.
- Duplicate Message-IDs are filtered on a best-effort basis. Concurrency
  handling and anti-spam controls need further validation before enablement.
- A catch-all attracts spam, including guessed or random recipient aliases.
  Filtering, alerting and quotas should be checked before switching DNS.
- The Worker may not be used as a reason to publish an incomplete APK.
