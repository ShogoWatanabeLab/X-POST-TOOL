---
name: task-scope-planner
description: Analyze x-post-tool requirements, decide the next executable tasks, and fix in-scope vs out-of-scope boundaries before implementation. Use for requests like "要件整理", "次何をやるか", and "どこまでやるか".
---

# Task Scope Planner

Use this skill only for `x-post-tool` planning requests.

## Trigger

Invoke when the user asks to:
- clarify development requirements
- choose what to do next
- define implementation scope for the current iteration

## Input Reading Order

Read sources in this order, and stop when you have enough signal:
1. `docs/design/*.md`
2. `docs/instructions/codex.md`
3. `.claude/claude.md`

Do not bulk-read unrelated files. Load only extra files needed to resolve uncertainty.

## Workflow

1. Extract goals, constraints, and non-functional requirements.
2. Break work into candidate tasks at implementation-ready granularity.
3. Prioritize tasks with MVP-first ordering.
4. Define `In Scope` and `Out of Scope` for this iteration.
5. Add acceptance criteria per task.
6. Check dependencies and execution order (DB -> API -> UI where relevant).
7. Surface risks and open questions.

If information is missing or contradictory, ask clarifying questions first.
Do not silently assume high-impact decisions.

## Output Contract

Always output using the template in:
- `references/output-template.md`

Always apply decision rules in:
- `references/decision-rules.md`

When choosing what to read and when to ask, follow:
- `references/input-sources.md`

At the end of the output, include a handoff prompt that explicitly invokes:
- `$x-post-implementer`
