---
name: ifund-content-writes
description: Authorized, auditable IFund account context and owner-reviewed content drafts for all user-facing agents.
---

# IFund account context and content-writing skill

## Scope
Use 'getAgentAccountContext' before making claims about connections, campaign focus, external publication status, or other current account facts. This function returns only the authenticated member's account data and intentionally excludes raw connection credentials and private financial values. Distinguish provider-confirmed posting from queued, prepared or manually shared posts. Use 'liked_and_saved_posts' only when returned from the current PostInterest-backed account view; older unrecorded likes cannot be inferred. A member's likes and saves are private and do not authorize agents to manipulate engagement.

For content creation use 'manageAgentContentDraft' with mode='create', a 'kind' from the supported list and a properly scoped 'payload'. The function creates **a proposal**, not a post or a campaign modification. Revisions and cancellation use mode='revise'/'cancel' and the returned draft ID. The member can edit draft text in the AI review panel; destination/campaign/blog/thread identifiers are immutable during revision. Use mode='list' to inspect the member's own drafts. Never claim a draft was published.

## Kinds and existing approved actions
- social_post: content, optional media_url/campaign_id. After explicit owner approval, 'createSocialPost' publishes on IFund.
- campaign_update: title, content, optional media_url/media_type. After approval 'postCampaignUpdate' publishes **inside IFund only**; it does not silently cross-post.
- campaign_changes: title, summary, story, category, goal_amount, cover_image_url, end_date, location, ai_profile or status. Changes must be owner-approved; a full current campaign snapshot is preserved and passed to 'saveCampaign'.
- external_post: content plus target 'campaign_id' and 'connection_id'. Owner-approved application calls 'createDistributedPost' to stage an external publishing draft; actual provider publishing remains a separate approval/consent action through 'publishPost'.
- blog_entry: blog_id, title, body, optional summary/entry_id. Owner-approved application saves through 'manageBlog'; publishing the article remains separately controlled.
- discussion_post: community_id, title, content, optional category. Owner-approved application uses 'createDiscussionPost' after membership check.
- discussion_reply: post_id and content. Owner-approved application uses 'postDiscussionReply' after membership check.
- profile_update: optional display_name, bio, focus_campaign_ids, priority_campaign_id, show_posts and show_communities. Approval applies through 'managePublicProfile'.

## Tool boundaries
- **Agents may NOT call 'applyAgentContentDraft'**. It is intentionally absent from all agent tool configurations. Only the logged-in owner's human-facing review panel may apply a draft after displaying its exact content and destination.
- Do not request payment access or move funds. Never set or fabricate provider permissions, donation totals, public engagement, or campaign outcomes.
- Account creation/repair must continue via 'requestManagedConnectionAction'; do not bypass subscription, user OBO consent, login/approval, ownership or provider capability checks.
- Use the content tool with only the author's account. The client's 'source_agent' metadata is informative, not an authorization grant.
- Never write directly to Campaign, SocialPost, DistributedPost or Account entities to evade existing backend functions.
- Treat reports of 'applied' as verified only when the existing canonical function confirmed it. Failed/partially failed drafts require reconciliation, not blind retries. Preserve record IDs and evidence.
- Maintain accessible human-facing copy and use IFund's standard simple Connect -> Confirm -> Return UX.
- Draft tool availability is determined by live Base44 agent tool registration and runtime permissions, not by this markdown file alone.

## Operational steps
1. Read fresh owner/campaign/connection context.
2. Confirm owner and destination records in the canonical functions.
3. Draft or revise. Report draft ID and where the member can review it.
4. Allow owner to review/approve from the IFund agent page; never auto-approve the agent's own suggestion.
5. Re-check result status and report whether the action was applied, prepared for separate publication, denied or uncertain.
