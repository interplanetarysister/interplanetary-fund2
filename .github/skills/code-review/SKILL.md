Interplanetary Fund — Code Review Skill

Purpose

Perform rigorous, production-focused code reviews for the Interplanetary Fund codebase.

The goal is not merely to identify syntax problems. Reviews must protect the application's architecture, security, data integrity, user experience, performance, maintainability, and approved product behavior while minimizing unnecessary changes.

Core Principles

1. Understand before changing
   
   - Inspect the relevant files, imports, dependencies, data flow, and surrounding architecture before recommending changes.
   - Do not assume that an apparently unused or unusual implementation is incorrect without tracing how it is used.

2. Protect existing functionality
   
   - Never recommend a rewrite simply because another implementation looks cleaner.
   - Preserve working behavior unless there is a demonstrated reason to change it.
   - Identify regressions and unintended side effects.

3. Follow the project's architecture
   
   - Respect established patterns, abstractions, hooks, services, components, entities, and backend boundaries.
   - Avoid introducing duplicate systems when an existing system can be extended safely.

4. Security first
   
   - Check authentication and authorization boundaries.
   - Check ownership and permission enforcement.
   - Check exposed secrets, API keys, credentials, tokens, and sensitive data.
   - Check server-side validation rather than relying solely on client-side controls.
   - Check payment, webhook, database, and external-integration boundaries carefully.

5. Data integrity is mandatory
   
   - Verify that frontend assumptions match backend/entity schemas.
   - Check reads, writes, mutations, queries, and validation.
   - Identify missing fields, inconsistent field names, unsafe defaults, race conditions, and destructive operations.
   - Preserve backward compatibility when practical.

6. Type safety
   
   - Prefer accurate types over "any".
   - Do not silence TypeScript errors without understanding the underlying problem.
   - Identify unsafe casts, nullable-data mistakes, and mismatched API contracts.

7. User experience matters
   
   - Review loading, empty, success, and error states.
   - Check navigation, buttons, forms, dialogs, authentication states, and mobile behavior.
   - Ensure users receive useful feedback when an operation succeeds or fails.
   - Check accessibility where relevant.

8. Performance matters
   
   - Identify unnecessary network requests, repeated queries, expensive renders, excessive bundle usage, and inefficient database operations.
   - Avoid premature optimization.
   - Prioritize measurable or clearly significant performance problems.

9. AI must remain assistive unless explicitly authorized
   
   - AI recommendations must not silently perform consequential actions.
   - Actions involving money, publishing, external communication, account changes, or irreversible operations should require the appropriate authorization/approval flow.

10. Credit and resource efficiency
    
    - Prefer focused, high-impact changes.
    - Avoid redundant refactors.
    - Do not modify unrelated files merely for stylistic consistency.
    - When working with AI builders or automated coding agents, produce concise implementation instructions with clear scope.

Review Procedure

Before approving a change:

1. Establish Context

Inspect:

- Repository structure
- Relevant source files
- Related components
- Backend functions
- Entity/data schemas
- Authentication and authorization
- Configuration and environment usage
- Existing tests
- Related integrations

Determine what the code is supposed to accomplish before judging how it accomplishes it.

2. Trace the Full Flow

For user-facing functionality, trace:

"User action → UI → validation → API/backend → database/external service → response → UI state"

For payments, trace:

"User action → checkout/payment provider → webhook → backend validation → database → resulting user/campaign state"

For authentication and permissions, trace:

"Identity → session → authorization → resource ownership → permitted operation"

3. Review for Defects

Look for:

- Runtime errors
- Logic errors
- Broken imports
- Incorrect assumptions
- Race conditions
- Null/undefined failures
- Schema mismatches
- Authentication bypasses
- Authorization failures
- Data leaks
- Payment inconsistencies
- Duplicate operations
- Incorrect state transitions
- Broken navigation
- Missing error handling
- Missing loading states
- Mobile/layout failures
- Accessibility problems
- Performance regressions
- Security vulnerabilities

4. Review Integration Boundaries

Pay special attention to:

- Stripe/payment processing
- Webhooks
- Authentication
- Database operations
- External APIs
- OAuth/social integrations
- Email and communication systems
- AI services
- File uploads
- User-generated content

Never assume an external request is trustworthy merely because it originates from the application.

5. Review Product Alignment

Verify that implementation matches approved Interplanetary Fund behavior.

Do not introduce new product behavior simply because it seems useful.

When a requested implementation conflicts with an established product principle, flag the conflict before changing the architecture.

6. Verify Before Declaring Success

Do not claim that a problem is fixed merely because code was edited.

Where available, use:

- Type checking
- Linting
- Unit tests
- Integration tests
- Build verification
- Runtime testing
- Relevant browser/mobile testing

If verification cannot be performed, explicitly state what was and was not verified.

Severity Levels

Classify findings using:

CRITICAL

Security vulnerability, unauthorized access, financial/data-loss risk, destructive production failure, or a defect that can compromise the system.

HIGH

Major broken functionality, serious data integrity issue, authentication/authorization problem, payment problem, or significant production regression.

MEDIUM

Meaningful functional, UX, performance, maintainability, or reliability issue that should be addressed.

LOW

Minor defect, technical debt, or maintainability concern with limited immediate impact.

INFORMATIONAL

Observation, optional improvement, or clarification that does not represent a defect.

Review Output

For every finding, provide:

- Severity
- File and location
- Problem
- Why it matters
- Recommended fix
- Verification method

Prioritize findings by severity and user/business impact.

Do not bury critical issues beneath stylistic observations.

Code Change Rules

When asked to implement fixes:

1. Fix confirmed problems first.
2. Keep the scope limited to the identified issue.
3. Preserve existing working behavior.
4. Avoid unrelated refactoring.
5. Follow existing project conventions.
6. Re-check affected dependencies after modifications.
7. Run appropriate verification.
8. Report exactly what changed and what was verified.

Never change production behavior solely to make code aesthetically cleaner.

Final Review Gate

Before declaring a change ready:

- [ ] No known CRITICAL findings remain.
- [ ] No known HIGH findings remain unless explicitly accepted.
- [ ] Authentication and authorization were reviewed.
- [ ] Data/schema contracts were reviewed.
- [ ] Payment/webhook behavior was reviewed when applicable.
- [ ] Error and loading states were reviewed.
- [ ] Mobile behavior was considered.
- [ ] Relevant tests/build/type checks were run when available.
- [ ] No unrelated functionality was unnecessarily changed.
- [ ] The implementation matches approved Interplanetary Fund product behavior.
- [ ] Remaining limitations are explicitly documented.

Golden Rule

Do not optimize for the amount of code changed. Optimize for correctness, safety, maintainability, and preservation of the Interplanetary Fund product.
