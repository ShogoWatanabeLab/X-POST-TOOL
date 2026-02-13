---
name: x-post-implementer
description: Implement x-post-tool features from a scoped task plan. Follow design docs, coding/security rules, and execute only in-scope tasks with verifiable completion criteria.
---

# X Post Implementer

Use this skill for implementation work in `x-post-tool`.

## Trigger

Invoke when the user asks to:
- implement tasks from a plan
- write code based on `docs/design/*.md`
- execute scoped development work with acceptance criteria

## Required Inputs

Before coding, require either:
1. A scoped task plan (preferred), or
2. A feature request + target design doc path(s)

If scope or acceptance criteria are missing, ask clarifying questions first.

## Input Reading Order

Read only what is needed in this order:
1. Relevant `docs/design/*.md`
2. `docs/instructions/codex.md`
3. `.claude/claude.md`
4. Existing code files directly related to the target tasks

## Workflow

1. Confirm target tasks and in-scope boundaries.
2. Map each task to concrete file-level changes.
3. Implement tasks in dependency order.
4. Apply validation, auth checks, and error handling as required.
5. Run available checks/tests for changed behavior.
6. Report what was implemented, what was not, and why.

Never implement items marked Out of Scope unless the user explicitly re-scopes.

## Output Contract

Always use:
- `references/output-template.md`

Follow rules in:
- `references/implementation-rules.md`

Use validation checklist from:
- `references/definition-of-done.md`

At the end of implementation output, include a handoff prompt that explicitly invokes:
- `$x-post-reviewer`
