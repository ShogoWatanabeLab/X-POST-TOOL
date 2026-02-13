# Input Sources and Discovery Rules

## Objective
Read only the minimum sources needed to produce a decision-complete task and scope plan.

## Source Priority
1. `docs/design/*.md`
- Primary source for feature requirements and acceptance expectations.
2. `docs/instructions/codex.md`
- Implementation behavior and coding expectations for Codex outputs.
3. `.claude/claude.md`
- Project-wide architecture, standards, and delivery policy.

## Discovery Procedure
1. Scan design docs to identify:
- target feature(s)
- required inputs/outputs
- constraints, errors, and security requirements
2. Cross-check implementation constraints from instruction files.
3. Detect conflicts or missing facts that block concrete planning.
4. If blocked, ask concise clarification questions before planning.

## Do Not
- Do not read the entire repository by default.
- Do not invent product decisions when source files are silent.
- Do not output implementation details unrelated to the requested scope decision.

## Missing Information Policy
Ask questions first if any of these are missing:
- target feature or user outcome
- completion boundary ("done" definition)
- constraints that change architecture/security
- timeline/priority that affects task ordering

