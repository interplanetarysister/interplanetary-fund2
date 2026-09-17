# InvokeLLM Security Inventory

**Baseline:** `main` at `208eeff30ef70f792cc28bfb72b4e2c2d05dbaa9`  
**Scope:** repository-wide inventory required by Issue #250.  
**Status:** inventory slice; migration is not complete.

## Classification rules

- **Migrated:** caller routes through `src/lib/secureLLM.js` and preserves bounded input/output/error contracts.
- **Direct / unresolved:** caller invokes `base44.integrations.Core.InvokeLLM` or `base44.asServiceRole.integrations.Core.InvokeLLM` directly.
- **Exempt:** direct invocation is retained only with a documented security rationale and equivalent controls.
- **Blocked:** migration requires an unresolved runtime/provider/schema dependency.

## Current findings

| Call site | Current evidence | Classification | Required next action |
|---|---|---|---|
| `src/lib/secureLLM.js` | Central gateway calls `base44.integrations.Core.InvokeLLM` after prompt/data separation and response validation. | Gateway | Keep as the only approved low-level model boundary; add runtime/provider timeout and schema evidence. |
| `src/components/campaigns/AICoach.jsx` | Imports `secureInvokeLLM`. | Migrated candidate | Verify runtime output schema, timeout, retry, and stale-UI behavior. |
| `src/components/analytics/ReportsPanel.jsx` | Imports `secureInvokeLLM`. | Migrated candidate | Verify caller authorization/privacy and structured output handling. |
| `src/components/platform/KnowledgePanel.jsx` | Imports `secureInvokeLLM`. | Migrated candidate | Verify untrusted knowledge-source isolation and output bounds. |
| `src/components/comms/ComposeMessage.jsx` | Imports `secureInvokeLLM`. | Migrated candidate | Verify recipient/privacy boundaries, output validation, and duplicate/retry behavior. |
| `src/components/campaigns/AIStoryGenerator.jsx` | Imports `secureInvokeLLM` and `wrapUntrustedData`. | Migrated candidate | Verify campaign-owner scope, prompt-injection defenses, and output persistence bounds. |
| `base44/functions/analyzeGrantApplication/entry.ts` | Direct `sr.integrations.Core.InvokeLLM` call found on current `main`. | Direct / unresolved | Migrate through the secure gateway or document a reviewed exemption with schema, timeout, and privacy evidence. |
| `base44/functions/generateIntelligence/entry.ts` | Direct `base44.asServiceRole.integrations.Core.InvokeLLM` calls found on current `main`. | Direct / unresolved | Split trusted instructions from untrusted opportunity/campaign data; add bounded structured output and failure semantics. |
| `base44/functions/runOutreachAgent/entry.ts` | Direct `sr.integrations.Core.InvokeLLM` call found on current `main`. | Direct / unresolved | Review recipient targeting, consent, private-data scope, duplicate side effects, and gateway migration. |
| `base44/functions/postCampaignUpdate/entry.ts` | Direct `base44.integrations.Core.InvokeLLM` call found on current `main`. | Direct / unresolved | Migrate or document exemption; verify campaign-owner authorization and publication idempotency. |
| `base44/functions/generateDistributionContent/entry.ts` | Direct `base44.integrations.Core.InvokeLLM` call found on current `main`. | Direct / unresolved | Migrate or document exemption; verify platform consent, output schema, and retry/duplicate publish behavior. |

## Required completion evidence

1. Search the exact current head and record every model invocation, including indirect wrappers.
2. For each call site, record auth context, trusted vs untrusted inputs, output schema, timeout/cancellation, retry/idempotency semantics, and privacy boundary.
3. Migrate each direct call or record a reviewed exemption; no silent direct-call exceptions.
4. Add executable adversarial coverage for hostile text/markup/Unicode, oversized/nested input, malformed output, provider failure/timeout, replay, and stale UI state.
5. Reconcile hosted authorization/RLS and tenant isolation before declaring the inventory complete.

This document intentionally does **not** claim that direct call sites are safe or migrated. It is a source-grounded queue artifact for Issue #250 and PR #247 review.
