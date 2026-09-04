# Adopt a Life — Moderation, Reporting, Suspensions, and Fund Holds

> FUTURE ONLY. This file records the desired moderation policy discussed for Interplanetary Fund. Several fund-forfeiture, fee, abandonment, notice, refund, and account-termination provisions are **LEGAL-REVIEW BLOCKED** and must not be implemented until counsel/compliance confirms the lawful procedure in every applicable jurisdiction.

## 1. Report effect while the platform is small

Until the platform has enough users/activity to justify a different moderation model, reporting a user should automatically place the reported account into a temporary suspension state.

During suspension:

- the user/account may continue receiving donations;
- withdrawals are blocked;
- applicable posting/account privileges are suspended according to the future enforcement implementation;
- funds already held remain tracked to the account and must not disappear or be reassigned merely because a report was filed.

## 2. First suspension

First suspension duration: **10 minutes**.

Workflow:

1. report is submitted;
2. reported account is automatically suspended;
3. reporter provides a reason;
4. report/reason is sent to admin review;
5. admin requests/receives proof from the reporter where appropriate; screenshots are a preferred evidence format;
6. unless admin intervenes, the account returns online after 10 minutes.

Admin may revoke the suspension earlier, extend/escalate it when permitted by policy, or permanently ban the account where justified and lawfully allowed.

Admin actions must include recorded reasoning.

## 3. Suspension ladder

The desired suspension progression is:

| Valid suspension count | Duration |
|---|---:|
| 1 | 10 minutes |
| 2 | 24 hours |
| 3 | 48 hours |
| 4 | 72 hours |
| 5 and onward | add 24 hours for each additional suspension |
| Final ladder duration | 10 days maximum/final suspension |

After the fourth suspension, each additional valid suspension increases the duration by 24 hours until the suspension duration reaches **10 days**. The 10-day suspension is the final suspension tier before the required final account review/evaluation process.

The implementation should calculate this deterministically and keep a complete suspension history.

## 4. Admin powers and evidence

Admin must be able to:

- see report history, reporter, reported user, timestamps, reasons, and submitted evidence;
- request proof from the reporter;
- review screenshots and other allowed evidence;
- revoke an invalid suspension;
- reinstate a user;
- escalate valid enforcement;
- impose a permanent ban where justified;
- record a mandatory reason for each manual decision;
- preserve relevant audit records.

## 5. Malicious, unfair, or excessive reporting

Users who report other users unfairly, maliciously, or excessively may themselves be suspended.

Repeated reports against the same target by the same reporter must be surfaced prominently for malicious-reporting review. Under the desired rule, if the reports are determined to be malicious/repetitive abuse, the reporting user is suspended rather than allowing reports to be used as a harassment mechanism.

Admin should be able to invalidate malicious reports so they do not count against the target's valid suspension ladder.

## 6. Final/just-cause evaluation

If the account reaches the final suspension stage and the suspensions are determined to have been valid, the account holder is required to complete a **just-cause evaluation**.

The account holder submits a written response to admin explaining what occurred and why the account should be restored/retained.

Admin reviews the response and decides whether to:

- revoke/clear the final enforcement;
- restore the account with conditions if lawful/appropriate;
- continue suspension;
- permanently ban/terminate the account.

The decision and reasoning must be documented.

## 7. No response after final review request

Desired rule: if the account holder does not provide the required response within **10 days**, they forfeit access to the account.

This should be implemented as an account-access/claim state, not immediate appropriation of funds.

After that point, the desired process gives the account holder **60 additional days** to provide acceptable proof of account ownership and claim/receive remaining funds through an eligible payout process.

Exactly what constitutes acceptable ownership proof requires a future documented standard.

## 8. Additional fees after a permanent ban

Desired policy: when an account is ultimately permanently banned, additional moderation/resource-mitigation fees may be assessed for the suspensions that required platform resources.

These fees apply **only when the account is permanently banned**, not merely because a temporary suspension occurred.

**LEGAL-REVIEW BLOCKED:** the amount, calculation, disclosure, authorization, enforceability, consumer-law treatment, charity/donation implications, payment-provider treatment, and whether such fees may lawfully be deducted from held funds must be established before implementation. No code should invent or charge these fees without an approved schedule and legal basis.

## 9. Funds after the additional 60-day ownership-claim period

The desired product direction is to determine, after the additional 60-day period, whether the remaining property/funds legally meet the applicable standard for abandonment/unclaimed property.

**Critical implementation rule:** Interplanetary Fund must not automatically declare funds abandoned or transfer them to itself merely because the internal deadline passed.

Before any transfer, the platform must determine and follow applicable unclaimed-property/escheat, money-transmission, processor, consumer-protection, charitable-funds, contract, notice, and jurisdiction-specific requirements.

Only if counsel/compliance confirms that the funds can lawfully become Interplanetary Fund property under the applicable circumstances may that transfer occur.

## 10. Donor notice/refund opportunity after lawful abandonment determination

If the lawful process reaches a point where Interplanetary Fund may retain otherwise unclaimed funds, the desired donor process is:

- identify donors for whom valid contact information is available;
- notify them that the account holder did not complete the required process to obtain the remaining funds;
- tell each affected donor the applicable amount/transaction information needed for the notice;
- tell them the legally/contractually approved timeframe and procedure for requesting return/refund of eligible funds;
- process valid refund requests according to processor/legal constraints;
- after the approved claim/refund window, handle unresolved funds only as lawfully permitted.

The **length of the donor refund-request window has not yet been decided** and must be specified in future legal/payment documentation.

**LEGAL-REVIEW BLOCKED:** the desired concept that unclaimed donor funds ultimately become Interplanetary Fund property must not be treated as enforceable until counsel confirms the lawful mechanism and required disclosures/notices.

## 11. Separation of receiving and withdrawing

Across every suspension state, the system must model these separately:

- `can_receive_donations`
- `can_withdraw`
- `can_post_or_manage_public_content`
- `account_access_state`

A report/suspension may block withdrawals and account privileges while still permitting donations to arrive, as decided above. Financial balances must remain auditable throughout enforcement.
