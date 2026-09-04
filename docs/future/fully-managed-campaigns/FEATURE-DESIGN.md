# Fully Managed Campaigns — Retained Feature Design

> STATUS: FUTURE DESIGN ONLY — DORMANT / NOT IMPLEMENTED
>
> This companion document preserves the feature-design recommendations developed during product discussion, subordinate to and incorporating the project owner's later clarifications in `README.md`. Where an earlier recommendation differs from a later owner decision, the later owner decision controls. Nothing here authorizes implementation.

## 1. Product framing: “Managed on Their Behalf”
Treat Fully Managed Campaigns as a broad “campaigns on behalf of” capability rather than an inmate-only subsystem. Incarcerated beneficiaries are an important first use case, but the same foundation should serve elderly beneficiaries, people without reliable internet or banking, rural/remote communities, people abroad, people experiencing severe poverty, hospitalized or otherwise inaccessible beneficiaries, and others who cannot practically operate a campaign themselves.

A future public-facing concept may communicate the idea simply: a legitimate beneficiary can provide the initial information and authority, and Interplanetary Fund can handle the technology and ongoing campaign work for them.

## 2. Campaign service levels / extensible model
Preserve an architecture capable of distinguishing campaign-management levels without forcing all campaigns into this workflow:
- Standard campaign: creator manages the campaign under ordinary platform rules.
- AI-assisted campaign: creator retains control while authorized AI performs selected work.
- Fully managed campaign: Interplanetary Fund/admin + authorized AI operate the campaign on the beneficiary's behalf under a management agreement.

Only `fully_managed` belongs to this feature branch's active design scope. The other levels are architectural context, not authorization to implement them here.

## 3. Sponsored/managed ownership model
Do not model the admin account as the actual beneficiary. The public campaign may be operated by an Interplanetary Fund managed/admin context, but internal records should preserve the true relationship among beneficiary, operator, representative, payout destination, emergency contact, successor designation and AI manager.

This makes authorization, accounting, auditing and future compliance substantially clearer and prevents the system from falsely presenting an offline beneficiary as the technology account operating the campaign.

## 4. AI-created campaign package
Using the approved intake, AI should eventually be capable of producing a complete campaign draft/package, including:
- campaign story/presentation based only on supplied/verified facts;
- funding purpose and goal;
- appropriate milestones where useful;
- public disclosures appropriate to the management arrangement;
- campaign title and shareable description;
- future updates based on verified developments;
- appropriate presentation choices for the beneficiary's situation.

The source intake remains authoritative. AI optimizes communication, not facts.

## 5. Beneficiary transparency
The public experience should make it understandable that the campaign is being managed on another person's behalf rather than concealing that relationship. Where appropriate, distinguish the beneficiary from the campaign operator and explain that Interplanetary Fund is providing managed campaign services.

Do not unnecessarily expose sensitive circumstances, institutional identifiers or private contact information in order to provide that transparency.

## 6. Purpose/use-of-funds structure
The system should be capable of recording and presenting approved intended uses of funds. Depending on beneficiary circumstances and applicable rules, examples may include legal/advocacy expenses, communication/commissary where permitted, family support, education/vocational needs, medical/accessibility needs, reentry costs, housing/transportation/employment preparation, or other legitimate campaign purposes.

These are examples, not a restricted universal list. AI must not invent a use or redirect funds outside the controlling agreement.

## 7. Managed-service value description
The managed-service allocation should correspond to actual managed work rather than being presented as an unexplained ordinary platform charge. Potential managed work includes AI campaign creation and maintenance, verification, correspondence, campaign promotion, administrative work, payment/distribution administration, compliance work, recordkeeping and approved participant/service effort.

The owner decision controls the economic model: roughly 30% is taken from the amount withdrawn under the management agreement. The system should nevertheless preserve enough accounting detail to explain what the managed service is and maintain an internal ledger of relevant allocations/costs where appropriate.

## 8. Campaign performance intelligence
AI should eventually monitor fundraising performance against the campaign goal, remaining time and desired pace. It can use this to improve ordinary authorized management and identify when enhanced outreach may be useful.

Performance monitoring should not create an automatic right to charge more, change the contract, contact new people without authorization, or alter the beneficiary's facts. Enhanced outreach remains optional under the controlling agreement/amendment process.

## 9. Verified-information memory for each campaign
Maintain a campaign-specific verified-information record so AI can answer routine campaign questions and prepare updates without repeatedly contacting the beneficiary. Distinguish:
- beneficiary-supplied original facts;
- administratively verified/accepted facts;
- public campaign wording generated from those facts;
- later authorized updates/amendments;
- uncertain/unverified information that AI must not present as fact.

This supports the goal of extremely rare beneficiary questions.

## 10. Admin question queue
When AI encounters a material information gap it cannot safely resolve, it should not contact the beneficiary automatically. Create a proposed-question item containing the missing information, why it matters, what the AI already checked and the proposed wording. Admin can approve, edit, decline or resolve it internally.

Only an approved unresolved question proceeds to the beneficiary/representative using their authorized communication channel.

## 11. Physical correspondence as a peer channel
Design correspondence so mail can function as a genuine interface to the campaign system rather than a manual exception. Outbound documents should be generated from the campaign record; inbound responses should be associated with the correct campaign and reviewed before updating verified information.

Correspondence IDs/QR/barcodes can reduce manual matching while avoiding public exposure of sensitive internal identifiers.

## 12. Share kit for people without technology
The approval package should function as an offline share kit. In addition to the campaign link and QR code, use simple instructions explaining how a supporter can search by campaign name, visit the website, use the app, scan the code or relay the campaign information to someone else.

Where useful, future versions could include printable mini-cards/flyers containing only public campaign information so the beneficiary or supporters can distribute them without needing to design anything themselves.

## 13. Support-network activation
The initial supporter list can seed outreach, but the system should preserve relationship context (for example family, friend, organization, advocate) and record whether the person actually agreed to share or endorse. This makes AI outreach more relevant while preventing assumed endorsements.

A future campaign dashboard for admin could show prospective supporters, contacted supporters, confirmed sharers/endorsers, declined/opted-out contacts and follow-up status.

## 14. Non-bank payout decisioning
Instead of treating payout as one bank-account field, future implementation should use a payout-options decision layer. Based on jurisdiction, institution, identity verification and practical access, it can determine which approved methods are actually usable for the beneficiary and present those choices for administrative/beneficiary authorization.

The objective is a genuine cash-access pathway for financially disconnected people, not simply nominal support for “no bank account.”

## 15. Direct-to-purpose and split distributions
When requested, lawful and supported, the system should be capable of paying an approved expense/provider directly or splitting a scheduled distribution among multiple approved destinations. Examples might include an institutional account plus a separate approved expense.

Every split component remains attributable to the same withdrawal event and receives its own status, transaction reference and receipt/accounting entry.

## 16. Failed payout recovery
A failed deposit/distribution should enter a recovery workflow rather than immediately changing recipients. Preserve the funds, record the failure, attempt authorized recovery steps, use the emergency contact only to help re-establish communication when necessary, and obtain verified beneficiary instructions for a changed destination.

Emergency contact remains financially powerless unless a separate explicit successor/alternate designation controls under the agreed conditions.

## 17. Renewal preparation
Before the campaign deadline, AI can prepare an administrative renewal/closure recommendation using campaign status, remaining need, remaining funds and the original agreement. It may prepare renewal paperwork or a final-distribution/closure package, but it cannot grant itself additional management authority.

## 18. Immutable provenance and versioning
Preserve provenance from intake through public presentation. Future reviewers should be able to determine which intake response or approved amendment supports a material campaign statement, payout instruction, deadline or management term. Generated wording may evolve; source authority should remain traceable.

## 19. Admin operational workspace
When eventually implemented, admin should have a dedicated managed-campaign workspace rather than mixing offline managed cases into ordinary user-account assumptions. Useful views include:
- pending applications/reviews;
- active managed campaigns;
- AI questions awaiting approval;
- correspondence awaiting action;
- upcoming withdrawals;
- failed/blocked payouts;
- receipts/mail due;
- approaching deadlines/renewals;
- jurisdiction/unclaimed-funds escalations;
- outreach performance and optional enhancement candidates.

This is an interface concept only and does not authorize building it now.

## 20. Lifecycle state model
A future explicit state machine can prevent ambiguous ownership and automation. Candidate conceptual states include:
`draft_intake -> submitted -> admin_review -> approved/declined -> campaign_preparation -> active -> withdrawal_due -> payout_processing -> active -> renewal_due -> renewed/closing -> closed`,
with separate exception states for `information_needed`, `payout_blocked`, `contact_lost`, and `unclaimed_funds_review`.

State names are illustrative; implementation should adapt them to the eventual architecture rather than forcing today's code to adopt them.

## 21. Accessibility principle
The feature should be designed around the hardest-access cases first. A person should be capable of successfully participating with physical paperwork and a reachable payout mechanism even if they never open the website or app. Digital access should improve convenience, not determine eligibility.

## 22. Safety and trust principle
The system should protect beneficiaries from both accidental AI drift and human/third-party misuse. Use explicit authority, verification, immutable records, least privilege, sensitive-data minimization, audit trails and admin escalation. AI should automate workload, not replace the legal/financial authority established by the agreement.

## 23. Future integration principle
Fully Managed Campaigns should reuse existing Interplanetary Fund capabilities through narrow contracts where sensible—campaign presentation, donation intake, payment records, outreach infrastructure, audit logging and agent authorization—without making those systems depend on the managed-campaign module.

The managed module owns its specialized intake, agreement, correspondence, management authority and payout-policy orchestration. Existing systems remain independently usable.

## 24. Non-implementation boundary
All descriptions in this companion document are retained future design. They may inform a later implementation plan only after explicit owner authorization. They must not be interpreted by agents or developers as current work orders, migration requirements, production TODOs or permission to modify today's application.
