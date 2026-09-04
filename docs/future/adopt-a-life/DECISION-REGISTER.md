# Adopt a Life — Decision Register

> **FUTURE ONLY — AUTHORITATIVE DECISION INDEX.** This file records the product decisions currently settled for Adopt a Life and points implementation toward the detailed specifications in this directory. It does not authorize production implementation.

## 1. Giving model

- Interplanetary Fund has two distinct giving modes:
  - **Campaigns = donations for a purpose.**
  - **Adopt a Life = purposeless support for a particular life.**
- A giver may not attach restrictions, stipulations, spending conditions, or control rights to either type of giving inside Interplanetary Fund.
- An organization that wants donations for itself must create a Campaign.
- Adopt a Life support is directed toward an individual person or an eligible organization-managed animal profile.
- An ordinary individual wanting support for their own animal/pet creates a Campaign, not an animal Adopt a Life profile.
- The separate future concept involving a giver buying a neighbor a basket/store pickup is not Adopt a Life and belongs on its own future sibling branch if pursued.

Detailed source: `GIVING-AND-CAMPAIGN-BOUNDARIES.md`.

## 2. Who may have an Adopt a Life profile

- Any eligible person may opt into Adopt a Life; financial hardship, homelessness, illness, volunteering, or another special status is not required.
- Volunteers are explicitly eligible.
- Adopt a Life discovery must provide a way to search specifically for volunteers.
- An ordinary user may have only **one** Adopt a Life profile.
- An Adopt a Life profile does not consume one of the user's Campaign slots.
- Approved organizations may manage multiple profiles only after application and admin approval.

Detailed sources: `PRODUCT-RULES.md`, `ORGANIZATION-PROFILES.md`.

## 3. Self-created user profile experience

- Adopt a Life is enabled from user/account settings.
- The user's normal profile gains the standardized Adopt a Life experience rather than requiring an unrelated second public account page.
- The profile photo receives an **Adopt Me!** frame.
- A small, easy-to-find **Adopt Now** donation action appears near the top of the profile.
- Profile details use a standardized form and standardized layout with Interplanetary Fund styling.
- The experience must remain simple, easy to navigate, and easy to donate through.

Detailed source: `PRODUCT-RULES.md`.

## 4. Screen-name-first public identity

- The preferred public identity is the person's **screen name**.
- Donors are supporting the publicly presented person/profile rather than being promised that Interplanetary Fund certified every real-world biographical claim.
- Legal identity is not public by default.
- Additional identity information is public only when the individual intentionally includes it or disclosure is legally required.
- Internally, transactions use stable account/profile identifiers rather than trusting screen-name uniqueness.
- Interplanetary Fund does not independently verify actual identity or profile facts merely because a profile exists, except where required by law, payment/payout providers, tax/compliance rules, or another mandatory obligation.
- The platform must not claim facts are verified when they are not.

Detailed sources: `PRODUCT-RULES.md`, `CONSENT-CONTROL-AND-PAYOUTS.md`, `COMMUNICATIONS-PRIVACY-AND-FOLLOWING.md`.

## 5. Human profile created on behalf of another person

This is a separate controlled workflow.

- The account owner/controller creates the profile on behalf of another human.
- The creator must select/attest that the individual agreed to allow the profile to be created **under the creator's control**.
- A separate human-profile authorization document is required.
- The profile subject must sign that document **before the creator may begin adding the subject's details or photos**.
- Once consent is signed, the profile may be completed and, when otherwise eligible, may receive donations.
- Donations may be received before withdrawal setup is complete where legally/provider permitted.
- The account owner/controller determines when an enabled withdrawal is initiated.
- Withdrawals stay blocked until a usable payout method exists and the profile subject has signed approval authorizing that payout destination.
- Changing the payout destination should require renewed subject authorization unless a later approved process provides an equivalent safeguard.
- The e-signature implementation must remain provider-neutral where practical. DocuSign is a candidate, not a requirement.

Detailed source: `CONSENT-CONTROL-AND-PAYOUTS.md`.

## 6. Non-bank payout decision

- A traditional bank account is not intended to be mandatory when a lawful/provider-supported alternative is available.
- Interplanetary Fund **does not issue, purchase, mail, or provide reloadable/prepaid cards**.
- A recipient obtains their own compatible reloadable/prepaid card.
- Interplanetary Fund may provide informational guidance listing cards/providers known to work with the supported payout mechanism.
- Compatibility must be checked before accepting the card as a payout destination.
- Interplanetary Fund should not guarantee that a third-party card will always remain compatible.
- Payment/payout credentials should be handled through the appropriate provider rather than unnecessarily stored by Interplanetary Fund.

Detailed source: `CONSENT-CONTROL-AND-PAYOUTS.md`.

## 7. Animal profiles

- Human and animal Adopt a Life profile types must be unmistakably different in UI and data.
- Eligible animal profiles are an organization-managed feature for approved shelters/rescues or equivalent authorized animal organizations.
- The organization selects/manages the allowed profile type.
- Financial support of an animal is not legal adoption and does not transfer ownership, custody, or decision-making authority.
- An ordinary person's personal animal is supported through a Campaign instead.

Detailed sources: `PRODUCT-RULES.md`, `ORGANIZATION-PROFILES.md`.

## 8. Animal shelters and organizations

Approved animal organizations may have both:

```text
Animal Shelter
├── Campaign → donate to the organization/purpose
└── Adopt a Life
    ├── Animal profile
    ├── Animal profile
    └── Volunteer profile
```

General shelter support is a Campaign. Individual animal/volunteer support is Adopt a Life.

Detailed source: `ORGANIZATION-PROFILES.md`.

## 9. Homeless shelters / housing-support organizations

- Approved homeless shelters, transitional-housing programs, outreach organizations, and related eligible organizations may manage multiple consenting human Adopt a Life profiles.
- These organizations may also manage volunteer profiles.
- The shelter/organization itself receives donations only through a Campaign.
- A person's receipt of shelter, food, housing assistance, case management, or other services may not depend on joining Adopt a Life.
- Participation must be voluntary.
- Sensitive sleeping location, room/bed, domestic-violence location, case-management, medical, immigration, and similar sensitive information must not be automatically exposed.
- Becoming housed does not automatically end the person's Adopt a Life profile or recurring supporter relationship.

Detailed source: `ORGANIZATION-PROFILES.md` and the safeguarding documents still listed as required.

## 10. Multi-profile businesses/nonprofits

- Ordinary users remain limited to one Adopt a Life profile.
- Multiple-profile capability is reserved for admin-approved businesses/nonprofits or other approved organizations.
- The organization must submit an application.
- The application includes organization/entity information, EIN where applicable, intended profile categories, purpose, and a rough estimate of how many people/animals it expects to help obtain sponsorship/support at any one time.
- Admin decides whether to grant multiple-profile privileges and may later suspend/revoke them.
- The intended contractual model places responsibility for organization-created profiles and submitted information on the controlling organization/entity, subject to enforceability and non-waivable legal duties.
- Required organization documents must prioritize lawful protection of Interplanetary Fund, its owners, developers, administrators, and applicable service providers.

Detailed source: `ORGANIZATION-PROFILES.md`, `DOCUMENTATION-REQUIRED.md`.

## 11. Liability / verification direction

- Account owners are intended to accept contractual responsibility for profiles/campaigns they create and for authorization of proxy-created profiles.
- Approved organizations managing profiles for others are intended to accept responsibility through their legal/entity account and submitted organization records/EIN where applicable.
- Interplanetary Fund's intended role is to host/facilitate submitted profile information and the giving experience rather than independently certify every factual claim.
- Appropriate waivers, representations, authorization terms, and indemnity language are required before implementation.
- These documents **must not claim to eliminate duties or liability that cannot legally be waived**.
- Final legal documents require professional review before implementation.

Detailed sources: `CONSENT-CONTROL-AND-PAYOUTS.md`, `ORGANIZATION-PROFILES.md`, `DOCUMENTATION-REQUIRED.md`.

## 12. Following, updates, community, and messaging

- Following a Campaign or applicable Adopt a Life profile signs the follower up for voluntary updates inside Interplanetary Fund.
- Updates are delivered to the platform inbox/notification experience.
- Followers may heart/react to appropriate updates.
- General user-to-user private messaging is not provided.
- Broader communication takes place through the Community forum and public/update interactions.
- A short customizable donation thank-you is the narrow messaging exception.
- If the donor is already an Interplanetary Fund user, the personalized thank-you may be delivered to the donor's inbox.
- If the donor is not a user, after donation completion they may be prompted to create a giver/supporter account so the personalized thank-you can be delivered to their inbox.
- This exception does not create an unrestricted private chat channel.

Detailed source: `COMMUNICATIONS-PRIVACY-AND-FOLLOWING.md`.

## 13. Anonymous giving and friend privacy

- Donors may support anonymously.
- The public/default donor identity is the screen name.
- Other users see only voluntarily public identity information unless disclosure is legally required to an appropriate party.
- Payment/compliance systems may retain legal/payment identity privately where required.
- Friend lists/relationships are hidden from other users by default.

Detailed source: `COMMUNICATIONS-PRIVACY-AND-FOLLOWING.md`.

## 14. Campaign limits

Without an active subscription:

- maximum **1 live Campaign** at a time;
- maximum **2 Campaign drafts** plus the 1 live Campaign;
- maximum **3 Campaign records total** under this rule;
- users may pause and unpause Campaigns as needed.

An active subscription may provide additional Campaign capacity under the separately defined subscription rules.

Detailed sources: `PRODUCT-RULES.md`, `GIVING-AND-CAMPAIGN-BOUNDARIES.md`.

## 15. Early-platform reporting and suspension policy

Until the platform has enough users/activity for a different moderation model:

- reporting a user automatically places that account into temporary suspension;
- the suspended account may continue receiving donations;
- withdrawals are disabled during suspension;
- admin receives the report reason/evidence for review;
- screenshots are a preferred evidence form;
- admin can revoke a suspension or impose stronger enforcement when justified;
- admin must record reasoning;
- malicious, unfair, or excessive reporters may themselves be suspended;
- repeated reports by the same user against the same target must be surfaced for malicious-report review.

Suspension ladder:

| Valid suspension | Duration |
|---|---:|
| 1 | 10 minutes |
| 2 | 24 hours |
| 3 | 48 hours |
| 4 | 72 hours |
| 5+ | add 24 hours each time |
| Final tier | 10 days |

At the final stage, if the suspensions are valid, the user must provide a written just-cause evaluation explaining the situation to admin. Admin decides restoration/revocation/continued enforcement/ban and records reasoning.

Detailed source: `MODERATION-AND-SUSPENSIONS.md`.

## 16. Final suspension, ownership proof, fees, and unresolved funds

Desired policy is fully recorded, but portions are **LEGAL-REVIEW BLOCKED**:

- If the required final response is not provided within 10 days, the desired policy is loss/forfeiture of account access, followed by an additional 60-day period to prove account ownership and claim remaining funds through an eligible payout process.
- If ultimately permanently banned, the desired policy may assess additional resource/moderation fees for suspensions, but **only if legally approved and only under a defined disclosed schedule**.
- After the additional 60 days, the desired policy is to determine whether the property legally meets applicable abandonment/unclaimed-property standards.
- Funds may not simply be declared abandoned because an internal clock expired.
- The desired eventual result, where legally permitted, is transfer of qualifying unresolved funds to an Interplanetary Fund-owned account only after all applicable legal requirements are satisfied.
- Donors with available contact information should receive legally appropriate notice if the recipient/account holder is unable to obtain the funds.
- Donors should be informed of the approved amount/time/procedure for requesting eligible refunds/returns.
- After the lawful donor claim/refund period, unresolved funds are handled only as legally permitted.
- The exact donor refund-request window is still unresolved and requires legal/payment determination.

These provisions require jurisdiction-specific unclaimed-property, payment, consumer, charitable-fund, contract, notice, and other legal/compliance review before implementation.

Detailed source: `MODERATION-AND-SUSPENSIONS.md`.

## 17. Documentation backlog remains required

The feature is **not documentation-complete for implementation**. `DOCUMENTATION-REQUIRED.md` is the single consolidated backlog and currently lists required documents/forms/specifications including:

- proxy-human Profile Creation & Control Authorization;
- subject Payout Method Authorization;
- consent revocation/control-change form;
- multi-profile organization application;
- organization responsibility/indemnity agreement;
- animal organization authority agreement;
- homeless/housing safeguarding addendum;
- Adopt a Life account-owner and recipient/controller terms;
- public-profile/media consent;
- giver disclosures and anonymous-giving disclosure;
- prepaid/reloadable-card compatibility disclosure;
- payout/withdrawal requirements;
- electronic-signature standard;
- reporting, admin-review, just-cause, malicious-reporting, ban, ownership-proof, and suspension-fee documents;
- held-fund/unclaimed-property procedures;
- 10-day and 60-day notices;
- donor unresolved-funds notice and refund form;
- final disposition of unclaimed funds policy;
- privacy/public-identity policy;
- minor/vulnerable-person safeguards;
- homelessness/domestic-violence sensitive-location standard;
- photo/media safety/removal procedure;
- final product specification;
- exact standardized profile fields;
- UI/UX specification;
- data/state model;
- permissions matrix;
- payment/ledger specification;
- discovery/search/volunteer specification;
- inbox/following/thank-you specification;
- moderation state machine;
- lifecycle/edge-case specification;
- implementation-boundary/feature-flag plan.

Detailed source and status tracking: `DOCUMENTATION-REQUIRED.md`.

## 18. Implementation isolation

Nothing in this register changes current production behavior.

Adopt a Life remains a future-only sibling feature under the neutral future architecture and must remain independently implementable from Fully Managed Campaigns or other future concepts.
