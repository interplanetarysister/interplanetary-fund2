# Adopt a Life — Product Rules

> FUTURE ONLY. These are recorded product decisions for later implementation. They do not change production behavior.

## 1. Core product distinction

Interplanetary Fund will support two fundamentally different giving modes:

1. **Purpose-based giving — Campaigns**: money is given toward a campaign/purpose.
2. **Purposeless giving — Adopt a Life**: money is given in support of a person or eligible organization-managed animal profile without requiring a stated spending purpose.

A giver may not attach spending restrictions, conditions, stipulations, or control rights to either type of gift within Interplanetary Fund. A note/message is not a restriction.

## 2. Who can be adopted

- Any eligible person may opt into Adopt a Life.
- Volunteers may be adopted and must be a searchable profile type/filter within Adopt a Life.
- Homelessness, hardship, illness, volunteering, or another special category is not required for a person to be eligible.
- The feature is about supporting the individual, not requiring proof that the individual deserves support.

## 3. User opt-in and single-profile rule

Any ordinary Interplanetary Fund user may opt into Adopt a Life from account/settings.

When enabled:

- the user's normal profile becomes/contains their Adopt a Life profile experience;
- an **Adopt Me!** visual frame is shown around the profile image;
- a small, prominent **Adopt Now** donation button appears near the top of the profile;
- the profile uses the standardized Adopt a Life detail form and standardized presentation layout;
- the layout should remain simple, branded/stylized, easy to navigate, and easy to donate from.

Each ordinary user may have **one Adopt a Life profile** associated with their user account.

## 4. Public identity/display model

Prefer screen names as the public identity donors see and donate toward.

- Public giving views display the profile subject's screen name by default.
- Legal identity should not be publicly exposed merely because it exists in internal records.
- Additional real-world identity information is shown publicly only if the individual voluntarily includes it in the public portion of their profile/campaign or disclosure is legally required.
- Internally, every profile must still have a stable platform identifier so transactions never depend on display-name uniqueness.
- The platform should collect/verify legal identity only when required by applicable law, payment/payout providers, tax obligations, fraud controls required by law/provider rules, or another mandatory compliance obligation.

The product should not imply that Interplanetary Fund independently verified the factual truth of a person's story merely because the profile is hosted.

## 5. Standard profile structure

Adopt a Life profiles use a standardized, simple form and standardized layout. The future form should support at least:

- screen name/public identity;
- profile photo and permitted media;
- biography/about information;
- optional circumstances/background;
- interests;
- volunteer designation where applicable;
- organization relationship where applicable;
- voluntary updates;
- support/follow controls;
- Adopt Now action;
- appropriate public disclosure about who controls the account/profile when the profile is created on behalf of another person.

Exact fields remain a documentation/UI-design task and should prioritize simplicity, dignity, privacy, and easy donation.

## 6. Human vs animal profile types

Human and animal Adopt a Life experiences must be visually and structurally clear and distinct.

For organization-managed profiles, the organization determines whether each managed profile is a human profile or animal profile using the allowed profile types.

**Individuals do not create Adopt a Life profiles for their own individual animals/pets.** An individual seeking financial help for an animal must create a normal purpose-based campaign.

Animal Adopt a Life profiles are therefore an organization-managed capability for approved organizations such as animal shelters/rescues, not a general pet-profile feature for ordinary users.

## 7. Organizations do not receive purposeless Adopt a Life donations

To donate to an organization itself, the organization must create a campaign.

An organization may manage Adopt a Life profiles for approved individual people/animals, but its own unrestricted/general fundraising belongs in Campaigns.

Example:

```text
Shelter / Nonprofit
├── Campaign → donate to organization/purpose
└── Adopt a Life
    ├── individual profile
    ├── individual profile
    └── volunteer/animal profile as applicable
```

## 8. Discovery

Adopt a Life discovery should support browsing/searching people to support, including a specific **Volunteers** option/filter.

Future discovery should support appropriate categories and local/community discovery without requiring recipients to expose precise addresses.

## 9. Following and updates

Following a campaign/profile signs the follower up for voluntary updates delivered inside Interplanetary Fund to the user's inbox/notification experience.

Updates are voluntary. Supporters can also interact with appropriate campaign/profile updates by hearting them.

## 10. Relationship to campaign limits

The currently decided campaign-account limits must remain visible as a cross-feature dependency:

- without an active subscription: maximum **1 live campaign** at a time;
- users may pause and unpause campaigns as needed;
- without an active subscription: maximum **2 campaign drafts + 1 live campaign = 3 campaign records total**;
- an active subscription may permit additional campaign capacity according to the subscription rules implemented elsewhere.

An Adopt a Life profile is not itself counted as a campaign unless a future explicit decision changes that rule.
