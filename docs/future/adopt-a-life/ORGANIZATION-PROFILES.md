# Adopt a Life — Organization-Managed Profiles

> FUTURE ONLY. This defines later organization capabilities and does not authorize current production behavior.

## 1. Multiple-profile privilege

Ordinary users have one Adopt a Life profile.

Entities allowed to create/control **multiple Adopt a Life profiles** must be approved businesses/nonprofits accepted by Interplanetary Fund admin.

Before multiple-profile capability is enabled, the entity must submit an application for review.

The application must include at least:

- organization/legal/business name;
- organization type;
- EIN where applicable;
- account/controller information required by law/provider/platform rules;
- purpose for using multiple Adopt a Life profiles;
- categories of profiles the organization expects to manage (human, animal, volunteer as applicable);
- rough estimate of how many people/animals it expects to help obtain sponsorship/support at any given time;
- required representations, waivers, authorizations, and responsibility/liability acknowledgments;
- admin approval/rejection decision and audit record.

Exact document/form creation is still required and is tracked in `DOCUMENTATION-REQUIRED.md`.

## 2. Human and animal types are explicit

The organization must choose an allowed profile type for each created profile. Human and animal adoption experiences must be clearly distinguishable in the interface and data model.

Examples:

- human individual;
- volunteer;
- shelter resident/participant;
- animal under an approved animal organization's care.

The organization cannot make an animal profile look like a human profile or vice versa.

## 3. Animal shelter/rescue model

Approved animal shelters/rescues may manage multiple animal Adopt a Life profiles.

```text
Animal Shelter
├── Campaign → donate to shelter/purpose
└── Adopt a Life
    ├── Animal A
    ├── Animal B
    └── Volunteer (human type)
```

A donor who wants to support the organization itself does so through an organization campaign.

An ordinary individual who wants money to help with their own individual animal/pet creates a normal campaign rather than an animal Adopt a Life profile.

Animal financial support does not transfer custody, ownership, adoption rights, or decision-making authority.

## 4. Homeless shelter/housing-support model

Approved homeless shelters, transitional-housing programs, outreach programs, and related organizations may manage multiple human Adopt a Life profiles for consenting participants.

```text
Community Shelter
├── Campaign → donate to shelter/purpose
└── Adopt a Life
    ├── Participating Person A
    ├── Participating Person B
    └── Volunteer
```

The person, not homelessness itself, is what supporters are supporting.

Becoming housed must not automatically end an Adopt a Life profile or recurring support relationship.

Participation must not be required as a condition of receiving shelter, meals, services, case management, or other assistance.

## 5. Volunteers

Approved organizations may create/manage Adopt a Life profiles for volunteers when the volunteer has provided the required consent.

Volunteers are a first-class searchable Adopt a Life category. Supporters may intentionally search for volunteers to support.

## 6. Organization donations remain campaigns

Organizations do not use an Adopt a Life profile to collect general organization donations.

To donate to the organization, the organization creates a campaign.

This preserves the two-mode model:

- organization/purpose → Campaign;
- particular person/eligible organization-managed animal → Adopt a Life.

## 7. Responsibility for organization-created profiles

The intended contractual allocation is that the approved organization/account owner is responsible for profiles it creates, its authorization to create them, and submitted factual content.

For nonprofits/businesses creating profiles on behalf of others, the organization's submitted legal/business identity and EIN (where applicable) should be associated with that responsibility record.

Public and contractual materials should make clear that Interplanetary Fund hosts/facilitates submitted profile information and does not independently guarantee the truth of profile content unless a specific fact has actually been verified.

**Legal review required:** identifying an organization or EIN as the responsible entity does not automatically prevent claims against Interplanetary Fund or guarantee that a donor could recover from that organization. Final terms must be drafted/reviewed for enforceability and lawful risk allocation.

## 8. Admin authority

Admin must be able to:

- approve/reject organization multi-profile applications;
- limit or suspend multi-profile privileges;
- view the estimated/current number of managed profiles;
- require updated documentation;
- revoke organization authorization;
- audit who created/controls each profile;
- prevent further profile creation without necessarily destroying existing financial/audit records.
