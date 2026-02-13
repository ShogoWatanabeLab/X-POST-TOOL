# Review Rules

## Core Priorities
1. Findings first: bugs, behavioral regressions, security risks, and missing tests.
2. Evidence-based: tie each finding to file path and line.
3. Scope-aware: detect both missing in-scope work and out-of-scope additions.
4. No implementation rewrite unless requested; review quality is primary.

## Required Coverage
- Functional correctness against acceptance criteria
- Error handling and edge cases
- Auth/authorization and data access boundaries
- Input validation and unsafe data paths
- Test adequacy for changed behavior

## Reporting Order
1. High severity findings
2. Medium severity findings
3. Low severity findings
4. Open questions and assumptions
5. Brief change summary

If no findings exist, state that explicitly and note residual risk/test gaps.
