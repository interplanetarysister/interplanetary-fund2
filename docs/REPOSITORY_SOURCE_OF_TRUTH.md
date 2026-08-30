# Interplanetary Fund — Repository Source-of-Truth Guide

**Effective:** 2026-08-30

This document tells application agents what belongs in this repository and where authoritative backend/frontend responsibilities currently live. It is an evidence document, not permission to infer deployment state.

## Current verified repository topology

The current `interplanetarysister/interplanetary-fund2` source is a **React + Vite** application using the Base44 SDK/Vite plugin. Its `package.json` contains React, React DOM, Vite, and `@base44/sdk` / `@base44/vite-plugin`; it does not establish a Next.js application.

The current `interplanetarysister/interplanetary-fund-backend/README.md` identifies that repository as the **authoritative backend and operations system**, including Convex functions, canonical business state, admin/agent runtime, security, treasury, payments, scheduled jobs, and operational integrations.

The current `interplanetarysister/InterplanetaryFund/README.md` identifies that repository as the **authoritative user-facing React/Vite frontend**. Because that creates an application-repository overlap with this repository, agents must inspect the current migration/deployment contract before deciding which frontend source is publishable. Do not resolve the overlap by assumption.

`interplanetarysister/interplanetary-fund` is identified by both current repository READMEs as migration/reference material and must not become a second production backend without an explicit current decision.

## Ownership rules

- **`interplanetarysister/interplanetary-fund2`**: the React/Vite application currently visible here, including its existing Base44-backed application layer, user-facing screens, application entities/configuration, and application-specific workflows.
- **`interplanetarysister/interplanetary-fund-backend`**: authoritative backend/operations according to its current repository contract. This includes canonical backend state, Convex functions, admin/agents, security, treasury, payments, scheduled jobs, and operations.
- **`interplanetarysister/InterplanetaryFund`**: authoritative frontend according to its current repository contract. Any work that affects the publishable frontend must reconcile this repository against that source rather than silently maintaining competing frontend products.
- **`interplanetarysister/interplanetary-fund`**: migration/reference only until every unique capability is reconciled.

A PR must target the repository that actually owns the change. Cross-repository behavior must use an explicit contract and must be verified at both ends.

## Mandatory no-guessing rule

**Never guess.** Before changing behavior, establish:

1. the exact current repository/branch/head;
2. the owning repository and current source-of-truth contract;
3. the actual caller and implementation;
4. the relevant schema/configuration;
5. the deployment/runtime state when the change affects production;
6. existing review/audit findings and their exact-head applicability.

If any required fact is unavailable, record it as **UNKNOWN / REQUIRES VERIFICATION** and stop that part of the change until evidence is obtained. Never infer a deployment, provider configuration, schema, credential, runtime capability, agent behavior, or review result from naming, stale documentation, or chat history.

## Evidence precedence

Use evidence in this order:

1. Controlled runtime/deployment state for the environment being changed.
2. Current source in the repository that owns the capability.
3. Current schema/configuration and executable tests/workflows.
4. Current issue/PR acceptance criteria and review findings.
5. Historical/reconstructed documentation.
6. Chat recollection.

Historical feature material is evidence/specification until reconciled with current source/runtime.

## Backend boundary

The authoritative backend must retain one canonical live identity for business-critical state assigned to it: users, campaigns, donations, permissions, agent state, treasury, payments, administrative state, and scheduled backend behavior. Application repositories may consume or bridge that state but must not silently create a competing production database or authoritative workflow.

## Base44 boundary

This repository currently contains Base44 SDK/plugin integration. That fact alone does **not** prove that Base44 is the production system of record, deployment target, or backend authority. Agents must inspect the current deployment and cross-repository contract before making that claim.

## Convex boundary

Convex backend behavior belongs to the authoritative backend repository identified above. When an application change depends on Convex:

- inspect the backend source and deployed environment before changing production behavior;
- do not delete or overwrite deployed functionality merely because it is absent from this repository;
- verify the actual function/schema/cron topology before modifying callers;
- for concurrency defects, identify the shared write records and competing execution paths before changing retries;
- validate concurrency, idempotency, claiming, duplicate prevention, and recovery in controlled Development before Production promotion.

## Role-specific workflow

The Convex Builder Agent workflow is not a universal application workflow. Agents must use the role-specific workflow appropriate to the repository and capability. When a task crosses the backend boundary, the authoritative backend's workflow requirements also apply.

## Historical material

Historical audits, recovered features, stale PRs, and old implementation plans must never be copied into production merely because they exist. Reconcile them against the current source and runtime first.

## Continuity

When a decision materially changes repository ownership, frontend/backend boundaries, deployment architecture, agent roles, or source-of-truth rules:

1. update this document;
2. update affected role-specific instructions;
3. update the authoritative repository documentation when applicable;
4. record the decision in the durable project archive.
