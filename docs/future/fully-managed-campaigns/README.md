# Future Feature: Fully Managed Campaigns

> STATUS: FUTURE DESIGN ONLY — DORMANT / NOT IMPLEMENTED
>
> This document records an approved product concept. It must not change production behavior, create routes, alter schemas, modify payment logic, enable agents, or create deployment requirements until a separate implementation decision is explicitly made.

## 1. Purpose and isolation

Fully Managed Campaigns allow Interplanetary Fund to operate a fundraising campaign on behalf of a beneficiary who cannot or does not wish to manage the technology after initial enrollment. Intended accessibility includes, without limitation, incarcerated people, elderly people, rural or technologically disconnected individuals, people traveling or living abroad, people in areas of severe poverty or limited financial infrastructure, and others who cannot practically operate a conventional online campaign.

This feature is optional and isolated. Standard campaigns and every unrelated Interplanetary Fund feature must bypass it without additional dependencies, validation, data requirements, UI steps, or runtime cost. Future systems may access this module only when a campaign is explicitly classified as fully managed.

## 2. Core operating model

The beneficiary completes one standardized intake/questionnaire and management agreement. After approval, Interplanetary Fund creates and operates the campaign through a designated managed/admin context. The beneficiary does not need an Interplanetary Fund user account or continuing technology access.

Keep these roles separate in all future data and authorization designs:
- Beneficiary — person or people the campaign exists to help.
- Campaign Operator — Interplanetary Fund.
- AI Manager — authorized automation operating within approved facts and policy.
- Authorized Representative — optional person with specifically granted authority.
- Payout Destination — approved method/location for a distribution.
- Emergency Contact — contact-only role by default; no financial rights.
- Alternate/Successor Payout Designation — optional, explicit, separately verified designation when legally permissible.

Never infer one role from another.

## 3. Intake and controlling agreement

The initial packet should capture at minimum:
- identity and beneficiary information;
- legal residence/jurisdiction;
- campaign purpose, reasoning, facts, circumstances and relevant individual details;
- requested funding goal;
- supporting information/documentation where appropriate;
- campaign deadline;
- renewal/extension choices and authorization boundaries;
- requested withdrawal intervals;
- payout agreement and payout preferences;
- whether the beneficiary has a bank account;
- available non-bank access methods;
- privacy, consent and communication preferences;
- authorization for Interplanetary Fund to manage the campaign;
- managed-service fee agreement;
- supporter/endorser leads the applicant believes may voluntarily share or endorse the campaign;
- emergency contact information;
- optional explicit alternate/successor payout designation, kept separate from emergency contact status;
- preferences/authorization concerning optional enhanced outreach.

Preserve the accepted intake and agreement as an immutable/versioned controlling record. AI may improve campaign presentation but must not silently alter underlying beneficiary-supplied facts, authority, payout terms or contractual terms.

## 4. Approval and campaign creation

Applications require administrative review before activation. Review should cover identity, factual/supporting information as appropriate, payout arrangement, management agreement, applicable restrictions and required compliance checks.

If approved, AI may create the campaign using only approved/verified information. The public campaign may state that it is managed by Interplanetary Fund while accurately identifying the beneficiary relationship.

If declined, retain appropriate administrative/audit records without creating an active managed campaign.

## 5. Approval information package for offline beneficiaries

After approval, provide the beneficiary with information they can use without accessing the platform. Where physical correspondence is the selected/necessary method, mail an approval package containing as applicable:
- campaign name;
- public campaign identifier;
- short/public campaign link;
- printable QR code;
- Interplanetary Fund website and app information;
- simple instructions for telling other people how to locate the campaign;
- campaign deadline;
- agreed withdrawal schedule;
- management terms/fee disclosure;
- instructions for requesting changes or contacting administration.

## 6. AI management and human escalation

After approval, AI is intended to manage routine campaign operations with minimal beneficiary interaction, including future-authorized campaign presentation, updates, routine administration, performance monitoring and baseline outreach.

Escalation path:
AI -> Admin -> Beneficiary/Authorized Representative

AI should exhaust existing verified information before asking the beneficiary a question. Beneficiary questions should be extremely rare. When new information is genuinely required, AI prepares the proposed question for administrative review. Only after admin approval may it be mailed or otherwise communicated to an offline beneficiary. Returned information is recorded and, where appropriate, added to the verified campaign record.

No autonomous AI action may expand contractual authority or invent facts.

## 7. Managed-service economics

Fully Managed Campaigns use a distinct managed-service agreement rather than silently inheriting the economics of ordinary campaigns.

Current future-design intent: approximately 30% for complete campaign management, covering the expenses and effort associated with operating the campaign and participating services/people. The agreed managed-service amount is assessed from funds being withdrawn rather than automatically taking the percentage from each incoming donation.

Example only: a $4,000 withdrawal under a 30% agreement produces a $1,200 managed-service allocation and $2,800 beneficiary distribution before any separately applicable and properly disclosed payment-processing treatment.

The exact agreement, percentage/rate, calculation basis, processor-fee interaction and allocation must be explicit, auditable and disclosed before implementation. Avoid duplicated or ambiguous fees. Maintain a ledger sufficient to account for managed-service allocations and beneficiary distributions.

## 8. Withdrawals, intervals and receipts

The initial agreement establishes requested/approved withdrawal intervals or milestones. Future implementation should support scheduled distributions and appropriate exceptional/admin-approved changes.

Each withdrawal should generate an auditable calculation and receipt/account statement. When physical correspondence is the beneficiary's selected/necessary communication method, receipts/statements should be mailed at the agreed interval.

## 9. No-bank-account requirement

A bank account must NOT be required to qualify for a Fully Managed Campaign. Non-bank access is a foundational requirement, not a later enhancement.

Subject to jurisdiction, identity verification, provider availability and applicable rules, future payout architecture should be capable of supporting appropriate options such as:
- mailed checks where usable;
- approved prepaid/debit disbursement methods;
- compliant cash-pickup/remittance services;
- mobile-wallet methods where available;
- direct payment of an approved expense/provider when authorized by the beneficiary;
- facility-approved inmate/trust-account deposits;
- other compliant non-bank disbursement mechanisms.

The intake should determine practical access constraints, including ability to cash checks, receive secure mail, access a disbursement card, reach a pickup location, use a phone/mobile wallet, or receive funds through an institution.

Support future split disbursements when permitted and authorized, with each component independently recorded and receipted.

## 10. Emergency contact and payout rights

Emergency/backup contact is a communication role only by default. The emergency contact is used when Interplanetary Fund cannot reach the beneficiary or cannot complete a scheduled deposit, to help re-establish contact or obtain updated instructions from the beneficiary.

An emergency contact NEVER receives campaign funds merely because they are the emergency contact.

Funds may potentially be directed to an alternate/successor only when the beneficiary explicitly designated that arrangement during enrollment (or through another properly authorized later process), the triggering circumstances match the agreement, and the transfer is legally permissible and properly verified.

AI must never infer payout rights from emergency-contact status.

## 11. Campaign deadlines, renewal and abandonment/unclaimed funds

Campaign fundraising deadline and legal abandonment/unclaimed-property deadline are separate concepts and must be tracked independently.

The agreement includes the campaign deadline and renewal/extension options. AI must not independently extend contractual authority beyond the agreement. Renewal/extension should follow the authorization/process established by the agreement and applicable rules.

For undeliverable/unclaimed funds, do not hard-code a universal abandonment period. Determine the applicable period and required handling from the beneficiary's verified legal residence/jurisdiction and the rules applicable to the particular funds/relationship. Escalate to administration well before a statutory deadline. Jurisdictional requirements must be verified before automating disposition of funds.

## 12. Supporters and endorsements

The intake asks for supporters/organizations the beneficiary believes may voluntarily share or endorse the campaign. Treat these as potential outreach leads, not automatic consent to marketing or endorsement. Outreach must comply with applicable communication/consent requirements and must not represent someone as an endorser unless that status is actually established.

## 13. Outreach and optional enhancement

Baseline AI-managed outreach is part of the managed campaign concept. AI may monitor campaign performance against the campaign's goals/timeline.

If results are materially below the desired pace, the system may identify optional enhanced outreach. Any additional service, cost or authorization must follow the original agreement or obtain the required subsequent authorization. AI must not silently add charges or materially expand outreach authority.

## 14. Offline correspondence ledger

Future implementation should support a correspondence ledger for beneficiaries without reliable technology access. Each outbound/inbound item should be associated with the campaign and auditable. A correspondence identifier, QR code or barcode may be used operationally to associate returned paperwork with the correct campaign record.

The intended record lifecycle is:
Application -> Agreement -> Verification -> Campaign -> Correspondence -> Supporters -> Outreach -> Donations -> Withdrawal Schedule -> Distributions -> Receipts -> Renewal/Closure

## 15. Compliance and safeguards before implementation

This document is product design, not a determination that every described payout or management activity is permitted everywhere. Before enabling jurisdictions/use cases, future implementation must evaluate applicable requirements involving identity verification, fundraising representations, vulnerable beneficiaries, incarceration/facility rules, guardianship/authority, sanctions/international transfers, tax/reporting, money transmission/payment services, unclaimed property, privacy and payout methods.

Sensitive information such as inmate identifiers, precise addresses, medical information, case information, victim/witness information and financial details should be minimized, access-controlled and never exposed merely because it was collected during intake.

## 16. Future architecture boundary

When implementation is eventually authorized, build this as an optional module rather than a core dependency.

Recommended boundary:
- explicit campaign mode/type: fully_managed;
- feature flag/configuration gate, OFF by default until separately authorized;
- isolated domain/service interfaces for intake, management agreements, correspondence and managed disbursement policy;
- existing campaign/payment/outreach/agent systems interact through narrow interfaces only when fully_managed is selected;
- standard campaigns never require managed-campaign fields or workflow;
- no managed-campaign route, schema migration, payment behavior, agent permission or deployment requirement should be introduced merely by keeping this design document.

Future features should branch independently from the common `future` parent/staging concept rather than from this feature branch. Do not use this branch as the base for unrelated future features.

## 17. Explicit non-implementation rule

Recording this specification does NOT authorize implementation. Do not merge it into production behavior, activate it, create production data structures, modify existing fee logic, change withdrawal behavior, enable outreach, contact beneficiaries/supporters, or deploy anything from this concept until the project owner explicitly authorizes an implementation phase.
