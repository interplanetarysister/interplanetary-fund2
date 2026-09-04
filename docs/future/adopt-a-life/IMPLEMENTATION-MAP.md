# Adopt a Life — Future Implementation Map

> FUTURE ONLY. This is an architecture guide, not production code. It organizes the decided behavior into implementable modules while keeping Adopt a Life independent from current production and sibling future features.

## 1. Module boundary

Adopt a Life should be implemented as a feature-gated module that reuses shared Interplanetary Fund services through clean interfaces without changing campaign semantics.

Suggested future boundary:

```text
features/adopt-a-life/
├── profiles
├── consent
├── organizations
├── discovery
├── giving
├── payouts
├── following
├── thank-you
└── moderation-integrations
```

No implementation should require Fully Managed Campaigns.

## 2. Core records

Names are illustrative; implementation may adapt them to the existing schema.

### AdoptLifeProfile

Key concepts:

- stable profile ID;
- public screen name;
- subject kind: `HUMAN` or `ANIMAL`;
- human discovery subtype/category such as `VOLUNTEER` where applicable;
- owner/controller account ID;
- optional subject-user ID when the subject has their own Interplanetary Fund account;
- optional organization ID for approved organization-managed profiles;
- control mode: `SELF`, `PROXY_HUMAN`, `ORGANIZATION_HUMAN`, `ORGANIZATION_ANIMAL`;
- profile status;
- public fields/media;
- consent status;
- payout-enabled status;
- created/updated/audit metadata.

Ordinary user constraint: one Adopt a Life profile per user account.

### ProfileConsent

For human profiles made on behalf of another person:

- profile ID;
- subject/signatory reference;
- controller/account owner reference;
- signed creation/control authorization document reference;
- signature provider/method;
- signature timestamp;
- document hash/version;
- status/revocation fields.

Profile details/photos remain locked until required consent is signed.

### PayoutAuthorization

- profile ID;
- payout destination/provider reference;
- compatibility status;
- subject authorization/signature reference for proxy human profiles;
- approved timestamp;
- replaced/revoked timestamp;
- audit metadata.

### OrganizationProfilePrivilege

- organization account ID;
- EIN where applicable;
- organization type;
- requested profile types;
- estimated simultaneous profile count;
- application document reference;
- admin decision;
- approved capacity/limits if any;
- status and audit trail.

### AdoptLifeGift

Must remain semantically distinct from CampaignDonation even if both use the same underlying payment/ledger infrastructure.

- giver/donor reference where available;
- anonymous/public-display choice;
- public donor screen-name snapshot where applicable;
- profile destination;
- amount/payment references;
- unrestricted/purposeless-support type;
- processor/fee/ledger fields;
- refund/chargeback state;
- created timestamp.

No donor-restriction field should create spending control.

### FollowSubscription

- follower account;
- profile/campaign target;
- update delivery enabled;
- inbox/notification preferences;
- created/ended timestamp.

### ThankYouMessage

Donation-linked, limited communication only:

- donation/gift reference;
- sender/profile/campaign controller;
- recipient donor account if created/available;
- short customizable thank-you content;
- inbox-delivery status;
- no conversation-thread capability.

### Report / Suspension / AdminReview

Shared moderation records should support the suspension rules in `MODERATION-AND-SUSPENSIONS.md`, including report evidence, valid/invalid status, malicious-report review, suspension count/duration, withdrawal hold, admin reasoning, just-cause response, and final disposition.

## 3. Profile state machine

Recommended human proxy flow:

```text
NEW
→ CONSENT_REQUIRED
→ CONSENT_SIGNED
→ PROFILE_EDITABLE
→ PROFILE_ACTIVE
→ PAYOUT_SETUP_PENDING
→ PAYOUT_ENABLED
```

Important independent capabilities:

- `can_publish_profile`
- `can_receive_donations`
- `can_withdraw`
- `can_edit_profile`

A profile can receive donations while `can_withdraw = false`.

## 4. Self-opt-in flow

```text
Settings
→ Enable Adopt a Life
→ create/activate single user AdoptLifeProfile
→ standardized profile setup
→ profile shows Adopt Me! frame
→ small Adopt Now button near top
→ payout setup may occur before or after donations as permitted
```

## 5. Proxy-human flow

```text
Controller creates profile
→ clicks attestation that subject agreed to profile creation/control
→ system generates/sends required consent document
→ subject signs
→ only then unlock details/photos
→ controller completes standardized profile
→ profile may receive donations
→ payout remains disabled until usable payout method + subject-signed payout authorization
→ controller may initiate withdrawals once payout is enabled
```

## 6. Organization flow

```text
Business/nonprofit applies for multi-profile privilege
→ submits entity/EIN/app details + estimated profile count
→ admin approves
→ organization gains allowed profile-management capability
→ each profile chooses explicit human/animal type
→ required subject consent applies to humans
→ organization-level fundraising remains Campaigns
```

Only approved organization accounts may create multiple Adopt a Life profiles.

## 7. Animal flow

```text
Approved animal organization
→ create ORGANIZATION_ANIMAL profile
→ standardized animal profile
→ Adopt Now support
```

Ordinary user's pet/animal fundraising:

```text
User needs support for their animal
→ Campaign
```

Do not route ordinary pet fundraising into Adopt a Life.

## 8. Discovery

At minimum, future search/filter design must be able to distinguish:

- people;
- volunteers;
- organization-managed human profiles;
- organization-managed animal profiles;
- privacy-safe local/community discovery.

Human and animal results must be unmistakably differentiated.

## 9. Screen-name architecture

Use stable internal IDs for financial/account correctness.

Use screen names as default public identity.

Legal/payment identity data, where required, stays in protected provider/compliance records and is not automatically rendered on public Adopt a Life pages.

## 10. Giving routing

```text
Donate to purpose/organization
→ Campaign donation path

Support specific human/eligible organization animal without required purpose
→ Adopt a Life gift path
```

Neither path accepts giver-imposed spending restrictions.

## 11. Following and communication routing

```text
Follow
→ subscribe to voluntary updates
→ updates delivered to IF inbox/notifications

Heart update
→ public/community interaction

Donate
→ optional short thank-you
→ existing donor account: inbox
→ non-user donor: optional giver-account creation prompt
→ after account creation: thank-you can be delivered to inbox
```

Do not create general user-to-user DM threads.

## 12. Payout routing

Payout adapter must be destination/provider-neutral.

Supported future destination classes may include:

- bank account;
- recipient-obtained compatible reloadable/prepaid card;
- other lawful/provider-supported non-bank methods later.

Interplanetary Fund does not issue cards.

For proxy human profiles, a usable destination alone is insufficient; required subject-signed payout authorization must also be satisfied.

## 13. Suspension capability model

Do not represent suspension as a single destructive boolean. Track capabilities separately.

Example:

```text
can_receive_donations = true
can_withdraw = false
can_post = false
account_access = SUSPENDED
```

This supports the decided rule that suspended accounts may continue receiving donations while withdrawals are blocked.

## 14. Feature flags / rollout

Before any future launch:

- global Adopt a Life feature flag;
- organization multi-profile flag/permission;
- animal profile capability flag;
- proxy-human profile capability flag;
- moderation-policy activation only after legal/operational approval;
- minors/vulnerable-person categories disabled until separate safeguarding approval.

## 15. Hard implementation invariants

1. Adopt a Life is not a campaign category.
2. No stated purpose is required.
3. Donor cannot attach spending restrictions.
4. Ordinary user has one Adopt a Life profile.
5. Only approved businesses/nonprofits may manage multiple profiles.
6. Ordinary individuals use campaigns for their own animal/pet fundraising.
7. Human proxy profile details/photos stay locked until signed subject consent.
8. Donations may precede payout setup where lawful/provider-supported.
9. Proxy-human withdrawal requires a usable payout method plus subject-signed authorization.
10. Account owner/controller determines withdrawal timing once withdrawals are enabled.
11. Interplanetary Fund does not issue reloadable cards.
12. Screen name is default public identity; internal financial records use stable IDs.
13. No general private user messaging.
14. Thank-you message is a narrow donation-linked exception.
15. Following delivers voluntary updates to the Interplanetary Fund inbox/notification experience.
16. Suspended accounts can receive donations but cannot withdraw under the currently decided moderation model.
17. Fund abandonment/retention and ban-fee behavior must remain blocked until legally approved.
