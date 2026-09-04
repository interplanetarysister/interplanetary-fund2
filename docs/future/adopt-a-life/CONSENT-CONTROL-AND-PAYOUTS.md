# Adopt a Life — Consent, Control, and Payouts

> FUTURE ONLY. This records the approved product direction. Any payout, e-signature, custody, tax, KYC, sanctions, money-transmission, prepaid-card, or unclaimed-property behavior must be validated against applicable law/provider requirements before implementation.

## 1. Account owner controls withdrawal timing

The owner of the Interplanetary Fund account that creates/controls the Adopt a Life profile determines **when a withdrawal is requested**.

For a human profile created on behalf of another individual, that control does not eliminate the profile subject's required consent protections described below.

## 2. Human profile created on behalf of another person

A separate consent/authorization document is required when an account owner creates a human Adopt a Life profile on behalf of another individual and controls that profile.

Required sequence:

1. Account owner selects/attests: **the individual agreed to allow me to create and control an Adopt a Life profile on their behalf**.
2. Before the creator may begin adding that person's profile details or photos, the profile subject must sign the required consent/authorization document.
3. The signed record is retained with the profile/account audit record.
4. The profile may then be completed and published according to the applicable rules.
5. The profile may receive donations even if a verified/usable withdrawal method has not yet been established.
6. **Withdrawals remain blocked** until the required signed profile-consent record is submitted/accepted and a usable payout method is on file with the profile subject's signed approval.

The future implementation should make these states explicit rather than relying on UI-only checks.

Suggested state model:

```text
DRAFT_LOCKED_PENDING_SUBJECT_CONSENT
→ CONSENT_SIGNED_PROFILE_EDITING_ALLOWED
→ PROFILE_ACTIVE_DONATIONS_ALLOWED
→ PAYOUT_PENDING_METHOD_AUTHORIZATION
→ PAYOUT_ENABLED
```

A profile can be in `PROFILE_ACTIVE_DONATIONS_ALLOWED` while still being unable to withdraw.

## 3. Payout-method approval for proxy human profiles

When an account owner controls a human profile created for another person:

- the account owner decides when to initiate a permitted withdrawal;
- the payout destination must be a usable supported method;
- the profile subject must sign approval identifying/authorizing the payout method before withdrawals are enabled;
- changing the payout destination should require new subject authorization unless future legal/product documentation expressly establishes a safe equivalent;
- account control must not silently permit the creator to redirect funds to an unapproved payout destination.

The signed authorization should be tamper-evident, auditable, timestamped, and attributable to the signer.

**E-signature provider is not yet selected.** DocuSign is a candidate, not a requirement. The implementation should support a provider-neutral electronic-signature record if practical.

## 4. Self-controlled profiles

For a person who opts their own Interplanetary Fund account into Adopt a Life:

- the account holder is the profile owner/controller;
- no separate "created on my behalf" consent form is required;
- payout setup still must meet applicable provider/legal requirements;
- the account holder controls withdrawal timing.

## 5. Receiving donations before payout setup

Adopt a Life must support receiving donations before the recipient/account has completed payout-method setup, subject to lawful processor/platform holding rules.

The UI must make the distinction clear:

- **donations enabled** does not necessarily mean **withdrawals enabled**;
- balances that cannot yet be withdrawn must be clearly identified;
- the platform must not promise availability before the payout requirements are satisfied.

## 6. No-bank-account payout requirement

Lack of a traditional bank account must not, by itself, prevent an otherwise eligible recipient from being able to receive their funds when a lawful/provider-supported alternative exists.

Interplanetary Fund **does not provide, issue, purchase, mail, or own reloadable cards for recipients**.

A recipient may obtain their **own compatible reloadable/prepaid card**. Interplanetary Fund may provide informational guidance about card types/providers known to support the required payout/funding method.

Requirements:

- recipient obtains the card independently;
- compatibility is checked before it is accepted as a payout method;
- Interplanetary Fund does not guarantee or imply permanent endorsement of any third-party card/provider;
- payout/payment credentials should be handled through the appropriate payment provider rather than unnecessarily stored by Interplanetary Fund;
- for proxy human profiles, the subject's signed payout-method authorization also applies to a reloadable/prepaid-card destination;
- architecture remains extensible for additional lawful non-bank payout options later.

## 7. Identity-verification scope

The product direction is **not** to independently verify every profile subject's actual identity merely because an Adopt a Life profile exists.

Interplanetary Fund should perform identity/KYC/KYB or related verification when required by law, payment/payout provider requirements, tax/reporting rules, sanctions/financial controls, or another mandatory compliance obligation.

Public-facing language must not claim that Interplanetary Fund verified the truth of profile facts unless it actually did.

## 8. Liability-allocation intent

The intended contractual model is:

- the account owner is responsible for the truthfulness/authorization of profiles and campaigns they create;
- account owners sign appropriate waivers/representations/indemnity terms covering false or unauthorized profile/campaign content;
- approved businesses/nonprofits creating profiles for others are accountable through the organization account and submitted organization information (including EIN where applicable);
- Interplanetary Fund is intended to host/facilitate the submitted information and payment experience rather than independently certify every factual assertion.

**Legal review required:** contracts/waivers cannot be assumed to eliminate statutory duties or all potential liability for Interplanetary Fund, its developers, owners, processors, or affiliates. Final documents must prioritize lawful protection of Interplanetary Fund and its developers/owners without making unenforceable promises.
