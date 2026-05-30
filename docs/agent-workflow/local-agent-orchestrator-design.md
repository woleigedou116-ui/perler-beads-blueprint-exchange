# Local Agent Orchestrator Design

## Purpose

This document defines a repeatable local-folder workflow for multi-agent software development.

The first version is intentionally protocol-first. The orchestrator uses available sub-agent tools to coordinate planning, development, testing, and repair loops. External executors such as DeepSeek connected to Claude Code can be added later as execution backends without changing the core process.

## Core Principle

The orchestrator coordinates work but does not implement features.

The orchestrator accepts requirements, delegates planning, assigns development, routes completed work to testing, reviews test reports, updates task state, and asks the user for a decision when the automated loop fails too many times.

The orchestrator does not:

- Write feature code.
- Fix developer bugs.
- Perform first-pass code validation.
- Replace the responsible developer agent during a repair loop.
- Replace the responsible tester agent during a retest loop unless the original tester is unavailable.

## Roles

### User

The user provides requirements and makes decisions when the automated process reaches a limit.

The user decides:

- Whether a requirement should proceed.
- Whether to continue after repeated failures.
- Whether to change scope, split work, abandon work, or escalate.

### Orchestrator

The orchestrator is the main coordinator.

Responsibilities:

- Receive user requirements.
- Create a requirement record.
- Assign the requirement to a planner agent.
- Review the planner's output for completeness.
- Create feature tasks from the plan.
- Assign each feature task to a developer agent.
- Forward developer output paths to the tester agent.
- Review tester pass/fail results and report paths.
- Route failures back to the original developer agent.
- Route fixes back to the original tester agent.
- Track repair attempts.
- Stop the loop when the repair limit is reached.
- Ask the user for a decision when needed.

The orchestrator may reject invalid handoffs, for example when a developer or tester returns missing paths, unclear status, or an unusable report.

### Planner Agent

The planner agent converts a user requirement into an executable plan.

Responsibilities:

- Clarify the intended outcome from the requirement text.
- Split work into feature tasks.
- Define each task's scope.
- Define out-of-scope items.
- Define acceptance criteria.
- Recommend test strategy.
- Identify dependencies between tasks.
- Recommend task difficulty.
- Recommend whether tasks can run in parallel.

The planner does not write code or run tests.

### Developer Agent

A developer agent owns one feature or one tightly related feature group.

Responsibilities:

- Implement the assigned feature.
- Stay within the task scope.
- Avoid unrelated refactors.
- Avoid modifying files outside the allowed scope unless the task requires it and the handoff explains why.
- Return changed file paths.
- Return implementation notes.
- Return optional self-check results.
- Fix failures reported by the tester for that same feature.

Important rule: the developer agent that implemented a feature is responsible for fixing that feature during the repair loop.

New feature work can receive a new developer agent. Bug repair for an existing feature returns to the original developer agent.

### Tester Agent

A tester agent validates developer output against the planner's acceptance criteria.

Responsibilities:

- Receive developer output paths from the orchestrator.
- Read the relevant task card and acceptance criteria.
- Run or create appropriate tests.
- Perform manual verification when automated tests are not enough.
- Produce a pass/fail result.
- Produce a test report path.
- Produce failure details when the test fails.
- Retest fixes from the original developer agent.

The tester does not edit feature code.

Important rule: retests should go back to the original tester agent so the same verification context is preserved.

## Default State Machine

Each feature task moves through these states:

```text
RECEIVED
PLANNING
PLANNED
DEVELOPING
DEV_DONE
TESTING
TEST_FAILED
FIXING
TEST_PASSED
DONE
USER_DECISION_REQUIRED
BLOCKED
```

Happy path:

```text
RECEIVED
  -> PLANNING
  -> PLANNED
  -> DEVELOPING
  -> DEV_DONE
  -> TESTING
  -> TEST_PASSED
  -> DONE
```

Repair path:

```text
TESTING
  -> TEST_FAILED
  -> FIXING
  -> DEV_DONE
  -> TESTING
```

Failure limit path:

```text
TEST_FAILED
  -> USER_DECISION_REQUIRED
```

## Repair Loop Limit

Default:

```text
max_fix_attempts = 3
```

Interpretation:

- First test failure: send the failure report to the original developer agent.
- Second test failure: send the new failure report to the original developer agent.
- Third test failure: send the new failure report to the original developer agent.
- If testing still fails after the third repair attempt, stop the loop and ask the user what to do.

Possible user decisions:

- Continue with another repair attempt.
- Split the task into smaller tasks.
- Ask the planner to revise the plan.
- Escalate to a stronger model or higher reasoning level.
- Abandon the task.
- Accept a partial result.

## Suggested Local Folder Structure

The workflow can be recorded inside the project root under `.agent-work/`.

```text
.agent-work/
  config.json
  requirements/
  plans/
  tasks/
  agents/
  handoffs/
    dev/
    test/
  reports/
  logs/
  decisions/
  lessons/
  templates/
```

Directory purpose:

```text
requirements/  User requirements received by the orchestrator.
plans/         Planner outputs.
tasks/         Feature task cards created from plans.
agents/        Agent assignment records.
handoffs/dev/  Developer handoffs and changed-file lists.
handoffs/test/ Tester handoffs and test reports.
reports/       Summary reports for user review.
logs/          Dispatch, retry, and state transition logs.
decisions/     User or orchestrator decisions.
lessons/       Lessons captured from verified bug fixes.
templates/     Reusable prompt and handoff templates.
```

## Requirement Flow

1. The user gives the orchestrator a requirement.
2. The orchestrator records the requirement.
3. The orchestrator creates or selects a planner agent.
4. The planner returns a plan with task boundaries and acceptance criteria.
5. The orchestrator reviews the plan for completeness.
6. The orchestrator creates feature task cards.
7. The orchestrator assigns each feature task to a developer agent.
8. A developer implements the feature and returns handoff paths.
9. The orchestrator forwards the paths to the tester agent.
10. The tester tests the feature and returns result paths.
11. The orchestrator updates state based on the test result.
12. If the task fails, the orchestrator sends failure details to the original developer agent.
13. The original developer fixes the issue and returns updated paths.
14. The orchestrator sends the updated paths to the original tester agent.
15. The loop continues until the task passes or the repair limit is reached.
16. If a repaired task passes, the original developer writes a lesson note.

## Developer Assignment Rules

Create a new developer agent when:

- A new requirement arrives.
- The plan contains a new independent feature.
- A feature group is sufficiently separate from existing work.
- Parallel development is useful and file ownership can be separated.

Reuse the existing developer agent when:

- Fixing test failures for its own feature.
- Continuing the same feature after review.
- Applying small changes to the same feature scope.

Do not assign one developer agent to every feature by default. Agent ownership should match feature ownership.

## Tester Assignment Rules

Create a new tester agent when:

- A new feature requires a distinct testing context.
- A separate test strategy is needed.
- Parallel testing is useful and independent.

Reuse the existing tester agent when:

- Retesting a fix for the same feature.
- Continuing verification for the same task.
- Comparing a repair against previous failures.

## Handoff Contracts

### Planner Output

The planner must return:

```text
plan path
task list
task dependencies
acceptance criteria
recommended test strategy
parallelization notes
risk notes
open questions, if any
```

### Developer Output

The developer must return:

```text
developer handoff path
changed file paths
implementation summary
self-check result, if any
known risks
```

The orchestrator forwards these paths to the tester without performing code-level validation.

### Tester Output

The tester must return:

```text
test report path
pass/fail status
commands run
test evidence
failure details, if failed
reproduction steps, if failed
recommended next action
```

The orchestrator reviews this report to decide whether to mark the task done, return it to the original developer, or ask the user for a decision.

### Lesson Output

When a task fails testing and later passes after repair, the original developer must return:

```text
lesson note path
failure summary
root cause
fix summary
why the first implementation missed it
test that caught it
prevention rule or checklist item
related files
```

The lesson is captured only after the tester confirms that the repair passes.

## Orchestrator Review Rules

The orchestrator checks process quality, not code correctness.

The orchestrator checks:

- Does the planner output include task boundaries and acceptance criteria?
- Did the developer return the required paths?
- Did the tester return a clear pass/fail result?
- Does a failed test include enough information for the developer to act?
- Is the current repair attempt count below the limit?
- Is user input required?

The orchestrator may reject invalid reports and ask the same agent to resubmit.

Examples of invalid reports:

- Tester says "passed" but did not run or describe any verification.
- Developer says "done" but returns no changed paths.
- Failure report says "it failed" without logs, commands, or reproduction steps.
- Planner creates vague tasks without acceptance criteria.

## Lesson Capture After Bug Fixes

When a task fails testing and later passes after a developer repair, the original developer agent must write a short lesson note.

Purpose:

- Preserve the cause of the failure.
- Make future developer agents less likely to repeat the same mistake.
- Improve planner and tester prompts over time.
- Build a lightweight local knowledge base for the project.

The lesson note should be written only after the tester confirms that the repair passed. Failed repair attempts can be referenced, but the final lesson should be based on a verified fix.

Suggested path:

```text
.agent-work/lessons/TASK-001-fix-lesson.md
```

The orchestrator records the lesson path in the task state. For later similar tasks, the orchestrator can pass relevant lesson notes to the planner, developer, or tester as extra context.

## Prompt Templates

### Planner Prompt

```text
You are the planner agent in a local multi-agent development workflow.

Requirement:
[requirement]

Your job:
- Convert the requirement into executable feature tasks.
- Define task scope and out-of-scope items.
- Define acceptance criteria for each task.
- Recommend testing strategy.
- Identify dependencies and possible parallel work.
- Do not write code.
- Do not modify files.

Return:
1. Plan path or plan content
2. Task list
3. Acceptance criteria
4. Test strategy
5. Dependencies
6. Risks
7. Open questions, if any
```

### Developer Prompt

```text
You are the developer agent responsible for one feature in a local multi-agent development workflow.

Task:
[task card]

Rules:
- You own this feature until it passes testing or the orchestrator stops the task.
- Stay within the assigned scope.
- Do not perform unrelated refactors.
- Do not assume you are the only agent in the project.
- If tests later fail, you will receive the failure report and must repair your own implementation.

Return:
1. Developer handoff path
2. Changed file paths
3. Implementation summary
4. Self-check result, if any
5. Known risks
```

### Tester Prompt

```text
You are the tester agent in a local multi-agent development workflow.

Task:
[task card]

Developer output paths:
[paths]

Your job:
- Validate the developer output against the acceptance criteria.
- Run appropriate tests.
- Add or perform focused verification if needed.
- Do not edit feature code.
- Return a clear pass/fail result.

Return:
1. Test report path
2. Pass/fail status
3. Commands run
4. Evidence
5. Failure details, if failed
6. Reproduction steps, if failed
7. Recommended next action
```

### Repair Prompt

```text
You are the original developer agent for this feature.

The tester found a failure.

Original task:
[task card]

Failure report:
[test report path or content]

Attempt:
[attempt number] of [max_fix_attempts]

Rules:
- Repair your own implementation.
- Do not expand scope.
- Do not replace the test strategy.
- Return updated changed-file paths and a repair handoff.
- Wait for the original tester to confirm the repair before writing a lesson note.

Return:
1. Repair handoff path
2. Changed file paths
3. Fix summary
4. Self-check result, if any
5. Known risks
```

### Lesson Capture Prompt

```text
You are the original developer agent for this feature.

Your repair has passed retesting.

Original task:
[task card]

Failure report:
[test report path or content]

Passing retest report:
[retest report path or content]

Your job:
- Write a short lesson note so future agents avoid this mistake.
- Base the lesson on the verified passing fix.
- Do not change code.

Return:
1. Lesson note path
2. Failure summary
3. Root cause
4. Fix summary
5. Why the first implementation missed it
6. Test or check that caught it
7. Prevention rule or checklist item
8. Related files
```

## External Executor Adapter

DeepSeek connected to Claude Code can be treated as a developer executor.

Initial suitable work:

```text
S0: mechanical edits
S1: local feature implementation
S2: bounded feature implementation with clear acceptance criteria
```

Avoid using external lower-cost executors for:

```text
Planning
Architecture decisions
Final process decisions
Cross-cutting refactors
High-risk security, auth, payment, or migration work
```

Adapter contract:

```text
input: task card, allowed scope, project path, return contract
output: developer handoff path, changed file paths, implementation summary, self-check result
```

Future command shape:

```text
agentctl dispatch TASK-003 --executor deepseek-claudecode
```

## First Implementation Strategy

Version 1 should use Markdown records and available sub-agent tools.

The orchestrator should:

- Create task cards.
- Spawn planner, developer, and tester agents.
- Preserve agent identity across repair and retest loops.
- Track repair attempts.
- Request a lesson note after repaired tasks pass.
- Record reports in `.agent-work/` when operating inside a real project.

No CLI is required for version 1.

Version 2 can add a CLI such as `agentctl` after the protocol has been tested on real project work.

Potential commands:

```text
agentctl init
agentctl intake "requirement text"
agentctl plan REQ-001
agentctl dispatch TASK-001
agentctl test TASK-001
agentctl status
agentctl report TASK-001
```

## Open Design Choices

These can be decided after one or two trial runs:

- Whether each feature gets a dedicated tester agent or a shared tester agent.
- Whether the planner agent should be reused across related requirements.
- Whether `.agent-work/` should be committed to git or kept local.
- Whether DeepSeek-ClaudeCode should be invoked manually first or through a CLI adapter.
- Whether max repair attempts should be 2 or 3 for normal work.

## Recommended Defaults

```text
max_fix_attempts: 3
capture_lessons_after_verified_repairs: true
planner: one per requirement
developer: one per feature or feature group
tester: one per feature during first trials
orchestrator_develops_code: false
orchestrator_reviews_code_directly: false
tester_edits_code: false
developer_runs_final_validation: false
```

## Summary

This workflow turns local multi-agent development into a repeatable handoff system.

The orchestrator controls state and responsibility. The planner creates the work plan. Developer agents own features. Tester agents own verification. Failed tests return to the original developer and original tester until the repair limit is reached. When the loop fails repeatedly, the user decides what happens next.
