# Adopt a Life — Future Feature

> Status: FUTURE ONLY. This document records a possible future Interplanetary Fund feature. It must not activate, modify, or become a dependency of current production behavior.

## Branch relationship

Intended conceptual hierarchy:

```text
main
└── future
    ├── fully-managed-campaigns
    └── adopt-a-life
```

Adopt a Life and Fully Managed Campaigns are independent sibling future features. Neither feature may require, inherit, activate, or depend on the other. Each must remain separately implementable.

## Core concept

Adopt a Life is a profile-based giving system. Instead of requiring a campaign tied to a specific fundraising reason, goal, emergency, purchase, or project, supporters can discover a particular person or animal and choose to financially support that life directly.

The central interaction is:

**I learned about this life → I care about this life → I want to give to this life.**

A recipient is not required to justify the donation with a specific spending purpose. Their voluntarily shared profile and story may inspire another person to support them.

## Individual profiles

Individuals may have Adopt a Life profiles containing information they choose to share, such as:

- name or approved public identity
- profile image and other approved media
- biography/life story
- interests and personal details they voluntarily disclose
- circumstances or background they voluntarily disclose
- updates
- community/approximate location where appropriate
- support/follow options
- donation options

The system should support people creating their own profiles and, subject to consent and verification safeguards, profiles initiated on behalf of another person.

The profile is not required to state a fundraising reason, spending plan, target amount, or campaign goal.

## Giving model

Adopt a Life should use the applicable Interplanetary Fund donation infrastructure while remaining a distinct product experience from campaigns.

Support should include:

- one-time donations
- recurring support
- direct support of the selected profile
- transparent identification of who receives or legally controls the funds
- the platform's applicable payment, fee, accounting, audit, fraud-prevention, and withdrawal safeguards

The product language should emphasize supporting the individual or animal rather than funding a required purpose.

## Discovery and local community

Users should be able to browse and search Adopt a Life profiles, including discovering people and participating organizations in their community.

Local discovery must protect privacy. Precise residential addresses or unnecessary exact location data should not be publicly exposed. City, community, neighborhood, region, or another deliberately approximate location may be used where appropriate and consented to.

Discovery may eventually include relevant filters and categories while avoiding systems that unfairly rank human worthiness.

## Animal profiles

Animals may have individual Adopt a Life profiles.

Animal shelters, rescues, and other authorized caretakers may create and manage profiles for animals in their care. A supporter could financially support a particular animal even when they cannot physically adopt it.

An animal profile may include:

- name
- photos/media
- species and relevant descriptive information
- story/background
- shelter/rescue/caretaker relationship
- updates
- support options
- adoption information when appropriate

The authorized organization or caretaker remains responsible for the animal and receives/manages funds according to the applicable platform and legal rules.

## Shelter and nonprofit structure

Organizations may maintain their normal Interplanetary Fund fundraising presence while also maintaining separate Adopt a Life profiles beneath their organization.

Example:

```text
Evergreen Animal Shelter
├── Donate to the Shelter
└── Adopt a Life
    ├── Buddy — Dog
    ├── Luna — Cat
    ├── Max — Dog
    └── Sarah — Volunteer
```

A shelter's general donations and support directed toward a particular life must remain distinguishable in records and user experience.

The same parent/associated-profile architecture could eventually support other eligible organizations such as community nonprofits, food banks, senior-support programs, schools, rescue organizations, homelessness organizations, and other charitable/community programs.

## Volunteers and people who donate their time

Participating organizations may, with the person's consent, create or associate Adopt a Life profiles for volunteers, caregivers, or other people whose time and contribution inspire supporters to give directly to them.

This allows the feature to recognize not only people experiencing hardship but also people contributing significant time or service to others.

An organization must not publicly create a support profile for an identifiable adult volunteer without the required consent/approval.

## Following and relationships

Adopt a Life should support an ongoing connection rather than only a single transaction.

Future functionality may allow supporters to:

- follow a profile without donating
- receive voluntary profile updates
- donate occasionally
- establish recurring support
- see appropriate updates from the supported person, animal, or managing organization

This should remain support-oriented and must not require recipients to continually prove hardship or justify ordinary spending to retain supporters.

## Consent, identity, verification, and fund custody

These are foundational requirements, not optional later enhancements.

The system must distinguish roles such as:

- profile subject
- profile creator
- verified recipient
- authorized organization/caretaker
- fund custodian/controller
- guardian when applicable

A profile initiated for another adult should require the subject's appropriate approval before public discoverability or receipt of support in their name, except for any narrowly defined future legal/authorized cases that undergo dedicated review.

Verification should reduce impersonation, fraudulent fundraising, unauthorized exposure, and misdirection of funds without unnecessarily preventing legitimate recipients from participating.

## Minors and vulnerable people

Profiles involving minors require a substantially stricter guardian, privacy, verification, visibility, communication, and safeguarding model before this feature could be implemented.

The system must prevent public exposure of sensitive information that could create physical, financial, stalking, trafficking, exploitation, or other safety risks.

Future implementation must define eligibility, guardian authority, fund custody, moderation, reporting, removal, and emergency safety procedures before minor profiles are enabled.

## Privacy and dignity principles

Adopt a Life should not require recipients to publicly disclose trauma, diagnoses, financial hardship, exact addresses, or other sensitive information simply to qualify for support.

Recipients should control appropriate portions of their public story and visibility. Information required privately for identity, payment, fraud, legal, or safety verification should not automatically become public profile information.

The feature should avoid turning poverty, vulnerability, or personal hardship into a competition for attention.

## Profile management and lifecycle

Future design should account for:

- subject-controlled editing where appropriate
- organization-managed animal profiles
- delegated/profile-assisted management with authorization
- consent withdrawal
- profile pausing or removal
- change of organization/caretaker
- recipient/fund-destination changes requiring re-verification
- deceased-person and deceased-animal handling
- duplicate/impersonation reporting
- moderation and appeals
- retention of necessary financial/audit records after public removal

## Separation from campaigns

Adopt a Life is not merely another campaign category.

Campaign model:

**Support this goal, event, project, need, or purpose.**

Adopt a Life model:

**Support this person or animal.**

A person or organization may eventually use both systems, but neither should require the other. Adopt a Life must not silently impose campaign requirements such as mandatory goals, deadlines, target amounts, or stated spending purposes.

## Future implementation boundaries

This specification records the concept only.

Until explicitly approved for implementation:

- do not expose Adopt a Life in production navigation
- do not create production database dependencies for it
- do not change existing campaign behavior for it
- do not alter current donation or withdrawal behavior solely for it
- do not require current features to know about it
- do not merge Fully Managed Campaign requirements into it
- do not make Fully Managed Campaigns depend on it

When implementation is eventually authorized, shared platform services may be reused through clean interfaces, but Adopt a Life should remain modular and independently deployable/enableable wherever practical.

## Product objective

Adopt a Life creates a second major giving relationship within Interplanetary Fund: people can support a life because that person or animal matters to them, without requiring the recipient to manufacture a conventional fundraising campaign first.
