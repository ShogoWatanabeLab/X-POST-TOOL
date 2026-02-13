# Implementation Rules

## Scope Discipline
1. Implement only tasks listed as In Scope.
2. Do not add speculative features.
3. If new requirements appear, stop and ask for re-scoping.

## Technical Guardrails
1. Respect `docs/design/*.md` as primary specification.
2. Follow `docs/instructions/codex.md` and `.claude/claude.md` coding rules.
3. Keep TypeScript strict; avoid `any`.
4. Add input validation and auth checks where required.
5. Include robust error handling for network/DB/external API boundaries.

## Change Strategy
1. Prefer minimal, targeted diffs.
2. Preserve existing architecture and naming conventions.
3. Separate business logic from UI where feasible.
4. Add or update tests for behavior changes when test harness exists.

## Escalation Conditions
Ask questions before continuing if:
- acceptance criteria are ambiguous
- source docs conflict
- security-sensitive behavior is undefined
- a task requires schema/API contract changes not in scope
