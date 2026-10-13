# IFund company mail — staging integration (NOT LIVE)

The company-mail receiver adds real inbound @interplanetaryfund.com mail to IFund's **existing** Universal Inbox. The frontend is shared by web and Android builds. The dedicated Cloudflare Email Worker saves MIME originals privately in R2 and mailbox metadata/plain-text messages in D1. The Base44 function `ifundDomainMail` authenticates administrators and proxies read requests using a server-side secret. An administrator can open and mark messages read in `/inbox`; sending and attachment downloads are intentionally not enabled.

## Production activation gates

Do **not** change the live domain's MX records, deploy to production, or merge before staging tests pass.

1. In the actual Cloudflare zone for `interplanetaryfund.com`, inspect **existing MX, SPF, DKIM, DMARC, and Email Routing** settings. Keep a record of current MX records; if another mail host is active, plan migration to avoid data loss. Do not assume that Cloudflare currently controls DNS.
2. Create Cloudflare D1 database **`ifund-domain-mail`**, R2 bucket **`ifund-domain-mail-raw`**, and a long random **`MAIL_API_TOKEN`** Worker secret. Check each product's free-tier quota and configure cost controls before activation.
3. Enter the returned D1 database UUID into `workers/ifund-mail/wrangler.toml`. Never commit the API token. From `workers/ifund-mail`, use Node 22 and run `npm ci` (or `npm install` where no lockfile exists), `npm test`, `npm run check`, then `npm run db:init` to create the remote schema. Confirm DB/R2 permissions.
4. Enable **Cloudflare Email Routing** for the correct domain. Cloudflare creates/manages the necessary inbound MX records when routing is enabled. Review the live DNS before accepting the change. The Worker `addresses` array declares `admin`, `support`, `donations`, `legal`, and `hello`; `wrangler deploy` may propose changes to email rules. Review proposed changes before applying. Do not enable a catch-all.
5. `npm run deploy` from the Worker subdirectory. Verify the isolated Worker endpoint by calling `GET /api/messages`: without a token it must return 401; with the token it should return `{ok:true,messages:[]}` at first. **Never share the token in a browser/mobile app.**
6. Set **Base44 server secrets** `IFUND_MAIL_WORKER_URL` (the actual HTTPS Cloudflare Worker origin, ending in `/`) and `IFUND_MAIL_API_TOKEN` (same value used by the Worker). Test `ifundDomainMail` with a real admin: list/get/mark-read must work; all non-admin accounts must receive 403.
7. Send a real external test email to each address. Verify Cloudflare's delivery status, D1 row, stored original in private R2, one inbox entry, readable plain-text content, correct status after Mark read, and **no duplicates on retries**. Send an email with HTML/script markup: it must render as plain text. Check unexpected recipients are rejected. Confirm existing notifications still work.
8. Only after tests, merge and publish the **Base44 live website**. The Android app packages a frontend snapshot, so build and distribute a **new APK**, then log in and verify the same mailbox from both live web and installed Android. Do not assume a web deploy updates previously installed APKs.

## Credentials and boundaries

- Never store `MAIL_API_TOKEN` in GitHub, frontend source, browser storage, APKs, or public logs.
- Keep inbound HTML inert; never render it directly as HTML. Attachment bytes are retained privately in R2; the first UI has no attachment download.
- Email viewing is admin-only. No agent/background mailbox access or automatic replies.
- This feature **receives** email. Sending/replying from @interplanetaryfund.com is a separate provider configuration, not yet complete.
- Cloudflare may have usage-based costs outside free quotas. This workflow must not create paid resources or subscriptions without approval.

## Rollback

Restore the previous Mail Routing rules and MX records if live receipt fails; keep a backup of prior DNS and existing mail destinations. Disable the `addresses` routing for the new Worker or revert the deployment, but **do not destroy D1/R2** until mail and retention are reviewed. Revert the website/APK release if the inbox regression affects users.
