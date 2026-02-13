# Decision Rules

## Core Rules
1. MVP first: prioritize the smallest path that delivers user-visible value.
2. Decision completeness: leave no critical decisions to the implementer.
3. Scope clarity: explicitly separate `In Scope` and `Out of Scope`.
4. Safety and compliance: include auth, RLS, secrets, and validation requirements when relevant.
5. Dependency order: enforce prerequisite sequencing (typically DB -> API -> UI).

## Priority Heuristics
Use this precedence when ordering tasks:
1. Blocking prerequisites (schema, auth, contracts)
2. Critical path implementation
3. Validation and error handling
4. Tests for high-risk logic
5. Secondary improvements

## Task Granularity Standard
Each task must be executable by one implementer without hidden decisions.
Each task must include:
- purpose
- implementation scope
- non-scope
- acceptance criteria
- dependencies
- estimate

## Ambiguity Handling
If key requirements are missing or contradictory:
1. Stop task finalization.
2. Ask targeted clarification questions.
3. Resume planning only after answers are available.

Do not proceed with high-impact assumptions.

## Estimation Guidance
Use rough effort labels:
- `S`: <= half day
- `M`: 1-2 days
- `L`: 3-5 days

If confidence is low, annotate estimate with assumptions.

