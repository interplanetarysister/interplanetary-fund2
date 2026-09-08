# FundForge (`fundforge-ai`) Recovery Audit

**Audit date:** 2026-08-22
**Source repository:** `interplanetarysister/fundforge-ai`
**Source commit audited:** `f4d24a7c752846e1d60bbb28a6c800765cccafc1` (main)
**Target:** `interplanetarysister/interplanetary-fund2`
**Recovery branch:** `audit/recover-fundforge-unique-2026-08-22`
**Status:** REVIEW REQUIRED — no recovered item is merged into production by this branch.

## Purpose

Determine whether `fundforge-ai` contains any project-relevant feature, rule, workflow, schema field, agent behavior, integration, UI behavior, or implementation detail that is not represented elsewhere in the current Interplanetary Fund repository family.

The deletion decision must be based on evidence, not repository name or apparent duplication.

## Repository-family verification

Seven repositories were verified under `interplanetarysister`:

1. `fundforge-ai` — old FundForge/Kindred-era Base44 application.
2. `interplanetary-fund2` — current user-facing Base44 application and current production application source of truth.
3. `InterplanetaryFund` — authoritative Convex backend / agent runtime.
4. `interplanetary-fund-backend` — explicitly marked legacy/reference; its README says not to delete it until unique production-relevant capabilities are migrated or intentionally retired.
5. `interplanetary-fund` — older full-stack Convex/Base44 implementation retained as historical reference.
6. `interplanetaryfund-base44` — later Base44 snapshot.
7. `Admin-software` — separate generic Electron administration product; not part of Interplanetary Fund.

`fundforge-ai` and `interplanetaryfund-base44` contain numerous identical Base44 files/configuration blobs, establishing that they are closely related snapshots. `fundforge-ai` stopped receiving changes in July 2026; `interplanetaryfund-base44` continued into August, and `interplanetary-fund2` is the current application repository.

## Executive finding

**`fundforge-ai` is not safe to delete without preserving the recovered material below.**

The repository is obsolete as a production source, but it contains several feature surfaces and implementation rules that are not present in the current repository under the same functionality. The current application has often superseded these with newer architecture, but the old requirements/details are still valuable and must not silently disappear.

### Recovered items requiring review

| Area | Finding | Classification | Recovery |
|---|---|---|---|
| Saved campaigns | Persistent per-user campaign bookmarks with SavedCampaign entity, hook, page and button | UNIQUE / NOT FOUND in current app | Recovered source |
| Campaign comparison | Persistent local comparison selection, max 3, side-by-side comparison rows | UNIQUE / NOT FOUND in current app | Recovered source |
| Donor leaderboard | All-time/month/year donor ranking, top 20, most-generous and most-supportive views | UNIQUE / NOT FOUND in current app | Recovered source |
| Help Center | Searchable articles, categories, popularity voting, contact-support form | UNIQUE lineage; current app does not expose equivalent Help route | Recovered source |
| Support tickets | SupportTicket schema with open/closed status | UNIQUE / NOT FOUND in current app | Recovered source |
| Help article feedback | helpful_yes/helpful_no counters and five article categories | UNIQUE / NOT FOUND in current app | Recovered schema + Help UI |
| Generic chat assistant | Persistent session chat, four quick questions, campaign context, human-support escalation | UNIQUE implementation; current Mission/AI architecture is a later replacement | Recovered source |
| Recommendation rules | Personalized recommendations based on followed/donated campaign categories, then trending fallback, max five | Older implementation; current Recommendation/Intelligence architecture supersedes it | Recovered source for rule review |
| Donor thank-you automation | Trigger exactly when Donation changes to paid; invoke backend thank-you function; include donation summary link | UNIQUE explicit workflow rule | Recovered source |
| Donation email templates | Campaign-created, donation receipt, milestone reached, ending-soon templates | Older communication implementation; current comms system supersedes but exact template semantics are not present | Recovered source |
| Wix payment integration | Wix checkout-session construction and RS256 webhook verification; pending donation matched by checkout ID and marked paid | UNIQUE integration not found in current app | Recovered source |
| Legacy Campaign fields | `short_description`, `description`, `faq`, `tags`, `seo_content`, `social_captions`, `press_release`, `donor_thank_you`, `is_featured`, `shares`, and legacy verification fields | UNIQUE old schema fields; some concepts have newer replacements, others are not currently represented | Recovered schema |
| Legacy Donation fields | `donor_email`, `summary_url`, `currency`, `platform`, `anonymous`, `checkout_id`, `status` | UNIQUE old payment/receipt metadata; some are replaced by newer payment architecture | Recovered schema |

## Agent/rule audit

A repository-wide search of the FundForge source found no separate `base44/agents` directory or dedicated agent-description files. The important AI behavior in this repository is implemented as ordinary backend functions/UI, especially:

- `chat-assistant`
- `getRecommendations`
- campaign/email helper behavior

Therefore there is **no FundForge agent description that must be migrated as a missing agent definition**. The behavioral prompts/rules embedded in the recovered functions are nevertheless preserved because they may contain useful product intent.

## Feature details that must not be lost

### Saved campaigns

The old implementation:

- authenticates the current user;
- loads up to 500 SavedCampaign records;
- stores a local Set cache for responsive UI;
- creates/deletes SavedCampaign records on toggle;
- stores `campaign_title` as a denormalized convenience field;
- exposes a Saved Campaigns page ordered by save time;
- provides a bookmark button and success feedback.

The current app has `FollowedCampaign`, but following is not the same as bookmarking. The recovered save behavior should therefore remain available for deliberate future product review.

### Comparison

The old implementation has a concrete product rule: **maximum three campaigns**. Selection is persisted in `localStorage` under `kindred_compare`, synchronized across components with listeners, and compared on category/status/goal/raised/progress/backers/updates/creator/trust/verified. This is a real user-facing comparison capability, not merely a placeholder.

### Donor leaderboard

The old leaderboard:

- excludes anonymous donations;
- aggregates donor totals after currency conversion;
- supports All Time / This Month / This Year;
- ranks the top 20 donors;
- shows a top-three podium;
- separately calculates Most Generous (largest single gift) and Most Supportive (number of campaigns supported).

The old implementation contains stale `Kindred` branding and should not be copied blindly into production. The product rules are the recoverable asset.

### Help / support

The old Help Center has five categories:

- Getting Started
- Creating Campaigns
- Donating
- Payouts
- Account & Security

Articles can be searched by question/answer, opened inline, ranked by helpful votes, and users can submit a support ticket. Required ticket fields are name, email and message; subject is optional. New tickets default to `open`.

### Generic chat assistant

The old assistant was intentionally concise and action-oriented (2–4 sentences), helped with campaign discovery, FAQs, campaign creation, donation explanation, and account troubleshooting, and escalated unresolved issues to `/help`. It injected the five highest-raised active campaigns into context. This behavior is distinct from the current Mission Control/Campaign Coach architecture and should be treated as historical product intent rather than a production implementation to merge directly.

### Recommendation logic

The old recommendation function is explicit enough to preserve as a behavioral reference:

1. Require authentication.
2. Load campaigns, followed campaigns and donations.
3. Determine categories represented by campaigns the user followed or donated to.
4. Prefer active campaigns in those categories that the user has not already interacted with and has not dismissed.
5. Sort by amount raised.
6. Fill remaining slots with trending active campaigns.
7. Label personalized results with a category-interest reason and fallback results as `Trending now`.
8. Return at most five recommendations.

The current repository has a richer Recommendation/Intelligence system, so this is **not** an instruction to rebuild the old function.

### Donor thank-you workflow

This is a particularly important recovered rule:

- trigger on a Donation **update**;
- only execute when new status is `paid` and old status was not `paid`;
- invoke `send-donor-thankyou` using the donation ID;
- the function skips unpaid donations and donations without an email;
- it loads campaign context when available;
- it uses a campaign-specific `donor_thank_you` message when present, otherwise a default impact sentence;
- it sends a donation-summary link.

The trigger condition and once-per-transition semantics should be preserved if the current communication architecture implements the same outcome.

### Wix payments

The old payment path is not found in the current application:

- checkout uses Wix Payments API;
- minimum donation was `$0.50`;
- checkout session is tied to the campaign;
- a pending Donation is created before redirect;
- `checkout_id` links the pending donation to the external payment;
- Wix webhook JWT is verified using `WIX_PAYMENTS_WEBHOOK_PUBLIC_KEY` and RS256;
- `wix.ecom.v1.order_approved` is the payment event;
- the webhook finds the pending donation by checkout ID;
- only non-paid records are updated;
- donor name/email are taken from billing/buyer data;
- campaign raised amount is incremented by the approved order amount.

This is preserved for review rather than assumed to be a desired future payment provider.

## Legacy schema deltas worth retaining

The old Campaign schema contained these fields that the current Campaign schema does not contain under the same names:

- `short_description`
- `description`
- `faq`
- `tags`
- `seo_content`
- `social_captions`
- `press_release`
- `donor_thank_you`
- `is_featured`
- `shares`
- `verified`
- `verification_status`
- `verification_date`

The current Campaign schema instead contains newer fields such as `summary`, `goal_amount`, `raised_amount`, `donor_count`, `end_date`, geolocation, `cashapp_tag`, permanent `ai_profile`, `story_versions`, and outreach controls. This confirms a **schema evolution**, not a simple omission. The old fields are preserved here so their product intent can be consciously mapped or retired.

The old Donation schema contained:

- `donor_email`
- `summary_url`
- `currency`
- `platform`
- `anonymous`
- `checkout_id`
- `status` (`pending` / `paid`)

The current Donation schema has a newer payment model with recurring status, payment method, institutional clearing, and withdrawal linkage. The old fields remain preserved because they encode historical receipt/payment behavior.

## Deliberately NOT recovered as production code

The following were inspected and classified as superseded, duplicated, or stale rather than automatically promoted:

- old Base44 boilerplate and configuration;
- generic UI primitives already present in later snapshots;
- old `Follow` entity, because current `FollowedCampaign` is a richer successor with notification preferences, pinning, archiving and strict RLS;
- old `sendCampaignEmail` branding/HTML as-is, because it is stale `Kindred` branding and current communication infrastructure is newer;
- old FundForge/Kindred route structure as production routing, because the current application has a materially different architecture and route map;
- old generic recommendations as a replacement for the current Intelligence/Recommendation architecture.

## Review gate

**Do not merge this recovery branch automatically.** Review each recovered item and classify it as:

1. restore/modernize,
2. map to an existing current feature,
3. preserve as historical specification only, or
4. intentionally retire.

Only after review should any recovered implementation be moved into a normal feature branch.

## Deletion recommendation

After this recovery branch/PR is preserved and reviewed, `fundforge-ai` can be deleted as a production repository **provided no external service, deployment, Base44 integration, webhook, secret, or automation still references it**.

GitHub documents that some personally owned deleted repositories can be restored within 90 days, but deletion should still be treated as destructive and should not be used as the backup strategy.
