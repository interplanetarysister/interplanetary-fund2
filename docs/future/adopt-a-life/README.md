# Adopt a Life — Future Feature

> **Status: FUTURE ONLY.** This branch records the Adopt a Life design for later implementation. Nothing here should activate, modify, or become a dependency of current production behavior until explicitly approved.

## Branch relationship

```text
main
└── future
    ├── fully-managed-campaigns
    └── adopt-a-life
```

Adopt a Life and Fully Managed Campaigns are independent sibling future features. Neither may require, inherit, activate, or depend on the other.

## Core product model

Interplanetary Fund will distinguish two giving relationships:

- **Campaigns:** donate for a purpose.
- **Adopt a Life:** give in support of a particular life without requiring a spending purpose.

Adopt a Life is not a campaign category. A person does not need to manufacture a campaign reason, prove hardship, state a spending plan, set a deadline, or promise how the money will be used in order to be supported.

Givers may not attach spending restrictions or stipulations to either Campaign donations or Adopt a Life gifts within Interplanetary Fund.

## Current decided rules

The detailed documents in this directory are authoritative for implementation. The current decision set includes:

- anyone eligible may opt their own account into one Adopt a Life profile;
- enabling it adds an **Adopt Me!** frame around the profile photo and a small **Adopt Now** donation action near the top of the standardized profile;
- volunteers can be adopted and must be discoverable/searchable as volunteers;
- screen names are the default public identity;
- Interplanetary Fund does not independently verify actual identity/profile facts unless required by law, payment/payout providers, tax/compliance rules, or another mandatory obligation;
- user/account owners are responsible for submitted profile/campaign content under future protective terms/waivers, subject to legal review;
- an account owner may create/control a human profile for another person only through the required signed consent workflow;
- for proxy human profiles, signed subject consent is required before details/photos may be added;
- profiles may receive donations before withdrawal setup is complete where lawful/provider-supported;
- the account owner/controller determines when a withdrawal is requested once withdrawal is enabled;
- proxy-human withdrawal requires a usable payout method plus signed approval of that payout destination by the profile subject;
- Interplanetary Fund does **not** provide reloadable cards; recipients without bank accounts may obtain their own compatible reloadable/prepaid card and use it where supported;
- ordinary users get one Adopt a Life profile;
- only admin-approved businesses/nonprofits may manage multiple Adopt a Life profiles;
- those entities apply for approval and provide a rough estimate of how many profiles they expect to support at one time;
- organization-created human and animal profile types must be unmistakably distinct;
- approved animal shelters/rescues may manage animal Adopt a Life profiles;
- ordinary individuals who need support for their own animal/pet use a Campaign instead;
- homeless shelters/housing organizations may manage consenting human profiles under the additional privacy/service protections already recorded;
- an organization that wants donations for itself must create a Campaign;
- following a campaign/profile subscribes the user to voluntary updates delivered within Interplanetary Fund's inbox/notification experience;
- community interaction occurs through the Community forum and hearts/reactions on updates;
- there is no general user-to-user private messaging;
- a short customizable donation thank-you is the narrow messaging exception;
- an existing donor account can receive that thank-you in its inbox;
- a non-user donor may be prompted after donating to create a giver account, after which a personalized thank-you can be delivered;
- donors may support anonymously; public identity is normally the screen name unless the donor voluntarily exposes more information or disclosure is legally required;
- friend relationships/lists are hidden from other users by default;
- without a subscription, a user may have 1 live campaign and 2 drafts (3 campaign records total), and may pause/unpause campaigns; subscription rules may grant more capacity;
- Adopt a Life itself does not consume a Campaign slot under the current decision;
- reports temporarily suspend the reported account under the recorded early-platform moderation model;
- suspended accounts may continue receiving donations but cannot withdraw;
- malicious/unfair/excessive reporters may themselves be suspended;
- the suspension ladder, admin proof/reasoning requirements, final just-cause review, 10-day response period, and subsequent 60-day ownership-proof period are recorded in the moderation specification;
- proposed ban fees and eventual handling/retention of abandoned/unclaimed funds are recorded as desired policy but **must not be implemented until legal/compliance review confirms a lawful mechanism**.

## Documentation map

### Product behavior

- [`PRODUCT-RULES.md`](./PRODUCT-RULES.md) — profile behavior, one-profile rule, screen names, volunteers, standardized layout, human/animal distinction, search, following, campaign limits.
- [`GIVING-AND-CAMPAIGN-BOUNDARIES.md`](./GIVING-AND-CAMPAIGN-BOUNDARIES.md) — purpose-based vs purposeless giving, no giver restrictions, organization campaign requirement, animal boundary, campaign capacity, and the separate future "Buy a Neighbor a Basket" concept.

### Consent, account control, payouts

- [`CONSENT-CONTROL-AND-PAYOUTS.md`](./CONSENT-CONTROL-AND-PAYOUTS.md) — proxy-human consent, pre-profile signature gate, withdrawal control, payout authorization, receiving before withdrawal setup, reloadable cards, identity-verification scope, liability-allocation intent.

### Organizations

- [`ORGANIZATION-PROFILES.md`](./ORGANIZATION-PROFILES.md) — approved business/nonprofit multi-profile applications, EIN/entity responsibility intent, animal shelters, homeless shelters, volunteers, admin authority.

### Communication and privacy

- [`COMMUNICATIONS-PRIVACY-AND-FOLLOWING.md`](./COMMUNICATIONS-PRIVACY-AND-FOLLOWING.md) — no general DMs, inbox updates, limited thank-you messaging, anonymous giving, screen names, hidden friend relationships, community-first interaction.

### Moderation

- [`MODERATION-AND-SUSPENSIONS.md`](./MODERATION-AND-SUSPENSIONS.md) — automatic early-platform suspension on report, suspension ladder, malicious reporting, admin evidence/reasoning, final evaluation, withdrawal holds, and legally blocked fund-disposition proposals.

### Future engineering organization

- [`IMPLEMENTATION-MAP.md`](./IMPLEMENTATION-MAP.md) — suggested records, state machines, permissions/capabilities, flows, module boundaries, feature flags, and implementation invariants.

### Documents/forms still needing creation

- [`DOCUMENTATION-REQUIRED.md`](./DOCUMENTATION-REQUIRED.md) — consolidated list of required consent forms, organization applications, waivers/terms, giver disclosures, payout documents, moderation forms, abandonment/refund documents, privacy/safety policies, and technical specs.

## Human profiles created on behalf of another person

This is a distinct controlled flow, not ordinary self-opt-in.

```text
Creator/controller starts profile
→ attests individual agreed to profile creation under creator's control
→ required consent document is signed
→ only then profile details/photos unlock
→ profile can be activated and receive support
→ withdrawals remain disabled until usable payout method + subject-signed payout authorization
→ controller determines when to initiate an enabled withdrawal
```

The e-signature provider is not yet selected. DocuSign is a possible provider, but the future design should remain provider-neutral where practical.

## Animal vs human Adopt a Life

The distinction must be obvious in data and UI.

Approved animal organizations may create animal Adopt a Life profiles. Supporting an animal does not transfer custody, ownership, or legal adoption rights.

An ordinary person seeking help with expenses for their own animal creates a Campaign instead.

## Organization relationship

Approved organizations may have both:

```text
Organization
├── Campaign → donations to organization/purpose
└── Adopt a Life
    ├── consenting individual
    ├── volunteer
    └── animal, when the approved organization type permits it
```

Organization-level fundraising remains Campaign-based.

## Homeless shelters / housing programs

Approved shelters/housing/outreach organizations may help consenting people create/manage Adopt a Life profiles. Participation cannot be required to receive services. Sensitive location/case information must remain protected. Becoming housed does not automatically make the person ineligible for continued support.

## Liability and factual verification direction

The intended future contractual model places responsibility for submitted content and authorization on the account owner/controller and, for approved multi-profile organizations, on the organization/entity associated with the account and its submitted EIN/entity records where applicable.

Interplanetary Fund is intended to host/facilitate submitted information rather than certify every factual claim.

However, **no waiver, EIN record, disclaimer, or contract should be assumed to eliminate non-waivable legal obligations or prevent every claim against Interplanetary Fund, its owners, or developers.** Protective documents must be professionally reviewed before implementation.

## Moderation/legal implementation lock

The user has defined a detailed desired suspension/account-funds policy. It is fully recorded, including the eventual desired handling of unresolved funds after account termination.

The following may not be implemented merely because they are documented:

- moderation/resource fees charged after a permanent ban;
- declaring funds legally abandoned based only on an internal deadline;
- transferring unresolved donor/recipient funds into an Interplanetary Fund-owned account;
- forfeiting donor refund rights.

Those require jurisdiction-specific legal/compliance/payment review and an approved written procedure first. The branch intentionally records the desired product outcome without falsely treating it as already lawful.

## Future sibling concept recorded but not part of Adopt a Life

A possible third future branch has been recorded for **Buy a Neighbor a Basket**: recipient selects a pickup store, giver pays through Interplanetary Fund, Interplanetary Fund facilitates the store pickup order, and the recipient receives a message when paid/ready.

It must remain separate from Adopt a Life and must not be implemented by allowing giver restrictions on gifts.

## Product objective

Adopt a Life creates a giving relationship where someone can discover a person or eligible organization-managed animal, learn about that life, and decide simply:

**I want to support this life.**
