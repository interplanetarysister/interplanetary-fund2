# Future Feature: Fully Managed Campaigns

> STATUS: FUTURE DESIGN ONLY — DORMANT / NOT IMPLEMENTED
>
> This records the agreed product concept only. It must not change production behavior, routes, schemas, payments, agents, outreach, deployment, or current campaign requirements until the project owner explicitly authorizes implementation.

## 1. Purpose and isolation
Fully Managed Campaigns let Interplanetary Fund create and completely operate a campaign on behalf of someone who cannot or does not want to manage campaign technology after initial enrollment. Intended accessibility includes incarcerated people, elderly people, rural/technologically disconnected people, people traveling or living abroad, people in severe poverty or limited-infrastructure regions, and others unable to practically operate an online campaign.

The beneficiary does not need an Interplanetary Fund user account, bank account, or continuing technology access.

This is an optional module. Standard campaigns and unrelated features must bypass it with no extra workflow, validation, fields, dependencies, runtime cost, or coupling. Other systems may deliberately enter/access it only for an explicitly fully-managed campaign.

## 2. Roles — never conflate or infer
- Beneficiary: person/people the campaign helps.
- Campaign Operator: Interplanetary Fund, operating through a designated managed/admin context.
- AI Manager: authorized automation operating within verified facts, agreement and policy.
- Admin: human approval/escalation authority.
- Authorized Representative: optional person with specifically granted authority.
- Payout Destination: approved method/location for a distribution; not necessarily a bank account or another person.
- Emergency/Backup Contact: contact-only role by default; zero financial rights.
- Alternate/Successor Payout Designation: optional explicit and separately verified designation where legally permissible.

A managed campaign may support different beneficiaries without fabricating user identities. Do not impersonate beneficiaries or create fake accounts.

## 3. Initial intake + controlling management agreement
The standardized first-contact questionnaire/agreement is intended to supply enough information that routine beneficiary interaction afterward is unnecessary. Capture at minimum:
- applicant and beneficiary identity/details and relationship if applicant differs from beneficiary;
- consent/authority to create and completely manage the campaign on the beneficiary's behalf;
- verified legal residence/jurisdiction used for applicable abandonment/unclaimed-funds handling;
- purpose, reasoning, facts, situation, story and relevant individual details;
- requested funding goal and intended use of funds;
- supporting facts/documents where appropriate;
- privacy/publication choices and facts that may or may not be made public;
- campaign start/approval context and fundraising deadline;
- renewal/extension options and authorization boundaries;
- requested withdrawal intervals/milestones;
- payout agreement, payout preferences and practical access limitations;
- whether a bank account exists (bank account is NOT required);
- usable non-bank/institutional/cash-access methods;
- receipt and correspondence preferences, including physical mail;
- managed-service fee terms;
- list of supporters/organizations the applicant believes may voluntarily share or endorse the campaign, with available contact information;
- emergency/backup contact used when the beneficiary cannot be reached or a deposit cannot be completed;
- optional explicit alternate/successor payout designation, separately from emergency-contact status;
- baseline outreach authorization and optional enhanced-outreach preferences/authorization;
- communication restrictions, accessibility needs and offline/institutional constraints;
- signatures/acceptance and required acknowledgements.

Preserve the accepted intake/agreement as an immutable, versioned controlling record. AI may improve presentation but must never silently change beneficiary-supplied facts, authority, payout terms, fee terms, deadlines or contractual terms. Material changes require an auditable authorized amendment.

## 4. Administrative review and decision
No campaign activates solely because an intake was received. Admin reviews identity/authority, factual/supporting information as appropriate, payout feasibility, agreement, applicable restrictions and required compliance checks.

If approved, create the campaign in the designated Interplanetary Fund managed/admin context and identify the beneficiary relationship accurately. If declined, retain appropriate decision/audit records without activating a campaign.

## 5. Approval package and campaign-location information
Once approved, send the beneficiary/authorized recipient an approval response appropriate to their communication method. For offline beneficiaries, mail a physical package containing as applicable:
- approval confirmation;
- campaign name;
- public campaign identifier;
- short/public link;
- printable/shareable QR code;
- Interplanetary Fund app and website information;
- simple instructions for telling other people how to find and support the campaign;
- campaign deadline;
- withdrawal schedule;
- management/fee terms;
- instructions for requesting adjustments or asking admin questions;
- appropriate contact/correspondence instructions.

The goal is for a person with no technology access to be able to hand, mail, read or relay enough information for others to locate the campaign.

## 6. Complete AI management after initial input
After approval, AI is intended to manage the routine campaign lifecycle without beneficiary technology interaction: draft/publish presentation from approved facts, maintain campaign content, prepare appropriate updates, monitor progress, perform authorized baseline promotion/outreach, handle routine campaign administration, maintain records, prepare scheduled withdrawals and identify issues requiring escalation.

AI must use existing verified information before requesting anything new. Beneficiary questions should be extremely rare.

Required escalation path:
AI -> Admin review/approval -> Beneficiary or Authorized Representative

If AI believes a new question is necessary, it drafts the question and reason for asking. Admin reviews it first. Only an approved question may be mailed/communicated to someone who cannot access the technology. The response is recorded, verified as appropriate, and becomes usable campaign information. AI cannot invent missing facts, expand authority, independently amend the agreement, or impersonate the beneficiary.

Requests from the beneficiary for adjustments/questions go directly to admin rather than requiring them to operate campaign technology.

## 7. Managed-service economics
This is a distinct fully-managed service, not merely the standard campaign fee under another name.

Agreed future-design intent: roughly 30% of an amount being withdrawn for complete management, covering operating expenses and effort by Interplanetary Fund and various approved participants/services involved in operating the campaign. The management allocation comes from the withdrawal amount, not automatically from each incoming donation.

Example: $4,000 withdrawn under a 30% agreement -> $1,200 managed-service allocation + $2,800 beneficiary distribution, before any separately applicable and correctly disclosed processor treatment.

The actual agreement/rate, calculation basis, participant/service allocations and interaction with processor costs must be explicit, server-authoritative, auditable and disclosed. Never double-charge or ambiguously combine standard platform fees, managed-service fees and processor fees. Preserve fee snapshots and a ledger showing gross withdrawal, each applicable allocation/cost and beneficiary net.

## 8. Withdrawal intervals, distributions and mailed receipts
The initial agreement establishes requested/approved withdrawal intervals or milestones. Future implementation should automatically prepare distributions according to those terms, subject to verification/administrative controls and any legally required holding/clearing period.

Each distribution must produce a durable transaction/accounting record and receipt/statement showing the applicable calculation without exposing unnecessary sensitive identifiers. Where physical correspondence is selected/necessary, mail receipts/statements at the agreed withdrawal intervals.

A beneficiary may request an authorized change to the schedule through admin; AI must not independently rewrite the agreement.

## 9. Bank account NOT required — cash/non-bank access is foundational
A bank account must never be a qualification requirement for this feature. Intake must determine how the beneficiary can actually receive/use funds.

Subject to jurisdiction, verification, provider availability and applicable rules, future architecture should be capable of approved methods such as:
- mailed check where practically usable;
- approved prepaid/debit disbursement method;
- compliant cash-pickup/remittance method;
- mobile wallet where available;
- direct payment to an approved expense/provider at beneficiary direction;
- facility-approved inmate/trust-account deposit;
- other compliant non-bank disbursement mechanisms.

Ask practical questions such as whether the beneficiary can cash a check, securely receive mail, use a card, travel to a pickup point, access a phone/mobile wallet, or receive funds through an institution. Do not merely store a `no bank account` checkbox.

Support authorized split disbursements when permissible (for example different approved destinations/purposes). Each component is independently recorded and receipted. Payout methods must use authorized provider/institution mechanisms; no unauthorized withdrawals or bypasses.

## 10. Emergency/backup contact — strict boundary
The emergency/backup contact exists so Interplanetary Fund has someone to contact when it cannot reach the beneficiary or cannot get a scheduled deposit/distribution to them. The contact can help re-establish communication or obtain updated instructions from the beneficiary.

Emergency-contact status gives ZERO entitlement to campaign funds. The emergency contact never receives funds merely because the beneficiary is unreachable.

Only an explicit alternate/successor payout designation made during signup (or a later properly authorized amendment), combined with the required verification and legal permissibility, can create a possible right for another person to receive funds under the specified circumstances. Never infer that designation from emergency-contact status.

## 11. Fundraising deadline, renewal and jurisdiction-based abandonment
The campaign fundraising deadline and the legal abandonment/unclaimed-property period are different clocks and must never be conflated.

The initial contract states the campaign deadline and renewal/extension options. AI cannot extend contractual authority on its own. Renewal follows the agreement and any required beneficiary/admin process.

For funds that cannot be delivered, there is no universal hard-coded abandonment period. Determine the required period/process from the verified legal residence/jurisdiction of the person who signed up/beneficiary as applicable to the legal relationship and funds. Maintain jurisdiction/rule provenance and escalate to admin well before the applicable deadline. Do not dispose of or redirect funds merely because a campaign ended.

## 12. Supporter/endorser list
The questionnaire requests people or organizations the applicant believes would share and/or endorse the campaign. Store these as prospective supporter leads, not as assumed endorsements or automatic marketing consent.

AI/admin may use them only through future-authorized, compliant outreach. Never publicly claim an endorsement until actually established. Maintain outreach/contact history and opt-out/suppression state where applicable.

## 13. Baseline outreach and optional improved outreach
Complete management includes authorized baseline campaign outreach/promotion. AI monitors progress relative to the campaign's goal and desired pace.

If donations are not arriving as much or as quickly as hoped, the system may identify an optional improved/enhanced outreach pathway. The intake/agreement should explain the option and any associated terms. Additional cost, scope or authority cannot be silently activated. Activation follows the original authorization or an approved amendment.

Future outreach should integrate through the platform's authorized outreach infrastructure and official/authorized publishing mechanisms; unavailable integrations should fail safely into approved manual/admin workflows rather than impersonation or unauthorized access.

## 14. Offline correspondence system
Offline access must be first-class, not a fallback after web/app design.

Maintain an auditable correspondence ledger for mailed approvals, questions, responses, receipts, renewal documents, notices and other authorized communications. Give correspondence a campaign-linked identifier (for example a correspondence ID and optionally QR/barcode) so returned paperwork can be reliably associated without exposing sensitive campaign/payment identifiers.

Operational lifecycle:
Application -> Agreement -> Verification -> Approval/Decline -> Campaign -> Approval Package -> Correspondence -> Supporters -> Outreach -> Donations -> Withdrawal Schedule -> Distributions -> Receipts -> Renewal/Closure/Unclaimed-Funds Handling

## 15. Campaign end/renewal behavior
Before the fundraising deadline, the system should identify the upcoming end state according to the agreement: renewal/extension process, final scheduled distribution, continued authorized handling of remaining funds, or campaign closure. Closing public fundraising does not erase accounting, correspondence, payout, receipt, audit or unclaimed-funds obligations.

## 16. Auditability and safeguards
Future implementation must maintain auditable records for agreement versions, approvals, AI/admin actions, correspondence, supporter outreach, campaign changes, donations, fee snapshots, withdrawal calculations, payout attempts, payout-method changes, receipts, renewal and abandonment/unclaimed-funds actions.

Use least-privilege/OBO-style authorization and explicit agent permissions. AI/admin actions must not create fake beneficiary identities, expose credentials, bypass payment verification or silently change payout destinations. Sensitive credentials remain server-side/secrets-managed. Payment/distribution confirmation must be provider/server authoritative rather than trusting a client-side success signal.

Minimize and access-control sensitive beneficiary information, including inmate identifiers, addresses, medical information, case information, victim/witness information and financial details. Public campaign content must contain only information authorized/appropriate for publication.

## 17. Compliance gate before future implementation
This document is product design, not a determination that every described activity/payout is legal everywhere. Before enabling a jurisdiction/use case, evaluate applicable identity/KYC requirements, fundraising representations, vulnerable-person protections, incarceration/facility rules, guardianship/authority, sanctions/international transfers, tax/reporting, money transmission/payment-service rules, unclaimed property, privacy, communication/marketing rules and payout-method restrictions.

Compliance should determine available options rather than making the entire feature depend on a bank account or internet access.

## 18. Future architecture boundary and bypassability
When implementation is explicitly authorized, build this as an optional bounded module.

Recommended boundary:
- explicit campaign mode/type: `fully_managed`;
- feature/configuration gate OFF by default until separately authorized;
- isolated interfaces for intake/agreement, verification, managed campaign operations, correspondence, outreach policy, managed fee calculation and disbursement policy;
- existing campaign/payment/outreach/agent systems enter those interfaces only when `fully_managed` applies;
- standard campaigns never require managed-campaign fields or steps;
- other features can deliberately query/access managed-campaign capabilities through narrow interfaces without importing its internal workflow;
- no managed-campaign route/schema/payment/agent/deployment requirement exists merely because this specification exists;
- preserve existing functionality rather than rebuilding unrelated systems.

Future branch organization should be conceptualized as:
`main` -> `future` -> isolated `future/<feature>` branches.

This feature is `future/fully-managed-campaigns`. Unrelated future features must branch independently from the common future baseline, not from this feature's details, so concepts do not intermingle.

## 19. Explicit non-implementation rule
Recording or improving this specification does NOT authorize implementation. Do not merge it into current production behavior, activate it, create production schemas, alter current fee/withdrawal logic, enable agents/outreach, contact beneficiaries/supporters, create provider accounts, or deploy anything from this concept until the project owner explicitly authorizes an implementation phase.
