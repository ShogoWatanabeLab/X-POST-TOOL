---
name: x-post-reviewer
description: Review x-post-tool implementations against scoped plans and acceptance criteria, prioritizing bug/risk findings, regressions, and test gaps before summaries.
---

# X Post Reviewer

Use this skill for implementation review in `x-post-tool`.

## Trigger

Invoke when the user asks to:
- review implemented changes
- verify acceptance criteria coverage
- find risks, regressions, and missing tests

## Required Inputs

Before review, require:
1. Scope source (task plan or design doc), and
2. Implemented change set (files or diff context)

If either is missing, ask for it first.

## Input Reading Order

Read only what is needed in this order:
1. Scope definition (`In Scope`, `Out of Scope`, acceptance criteria)
2. Relevant design docs in `docs/design/*.md`
3. Changed files and related code paths
4. `docs/instructions/codex.md` and `.claude/claude.md` when needed for rule checks

## Workflow

1. Compare implemented behavior vs acceptance criteria.
2. Identify defects, regressions, security risks, and scope violations.
3. Check for missing tests around changed behavior.
4. Prioritize findings by severity.
5. Report unresolved assumptions and residual risks.

Focus on findings first. Keep summary brief and secondary.

## Output Contract

Always use:
- `references/output-template.md`

Follow review rules in:
- `references/review-rules.md`

Use severity model from:
- `references/severity-model.md`
