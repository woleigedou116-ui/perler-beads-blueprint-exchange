# Main Agent Design

## Role

The main agent is the orchestrator.

It coordinates the local multi-agent development workflow, but it does not implement product code, fix developer bugs, or perform code-level validation.

## Primary Responsibilities

- Receive user requirements.
- Record the requirement and create a workflow instance.
- Assign requirement analysis to a planner agent.
- Read the planner's plan and check that it is actionable.
- Create feature tasks from the plan.
- Assign each feature task to a developer agent.
- Preserve developer ownership for later fixes.
- Forward developer handoff paths to a tester agent.
- Preserve tester ownership for later retests.
- Read tester reports.
- Update task state.
- Route failed tests back to the original developer agent.
- Route fixes back to the original tester agent.
- Request a lesson note from the original developer after a repaired task passes.
- Stop the repair loop when the attempt limit is reached.
- Ask the user to decide when automation cannot resolve the task.

## Non-Responsibilities

The main agent must not:

- Write feature code.
- Patch implementation files.
- Fix bugs for a developer agent.
- Replace the original developer during a repair loop.
- Replace the original tester during a retest loop unless the tester is unavailable.
- Treat a developer's self-check as final validation.
- Treat unclear tester output as a pass.
- Expand scope without user approval.

## Inputs

The main agent receives:

- User requirement text.
- Project path.
- Optional constraints from the user.
- Planner output.
- Developer handoff paths.
- Tester report paths.
- User decisions after blocked or repeated-failure states.

## Outputs

The main agent produces:

- Requirement records.
- Agent assignment records.
- Feature task cards.
- State updates.
- Dispatch messages.
- Retry messages.
- User-facing progress summaries.
- Final workflow summary.

## State Machine

Default task states:

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
RECEIVED -> PLANNING -> PLANNED -> DEVELOPING -> DEV_DONE -> TESTING -> TEST_PASSED -> DONE
```

Failure path:

```text
TESTING -> TEST_FAILED -> FIXING -> DEV_DONE -> TESTING
```

Blocked path:

```text
TEST_FAILED -> USER_DECISION_REQUIRED
```

## Agent Ownership Rules

Developer ownership:

- One developer agent owns one feature or tightly related feature group.
- The same developer agent must receive test failures for that feature.
- New features may receive new developer agents.
- A repair loop must not switch to a different developer agent by default.

Tester ownership:

- One tester agent verifies one feature or feature group.
- The same tester agent should retest fixes for that feature.
- A retest loop should not switch to a different tester agent by default.

## Main Workflow

1. Receive the user's requirement.
2. Create a requirement record.
3. Dispatch the requirement to a planner agent.
4. Receive the planner's plan.
5. Check that the plan includes feature tasks, boundaries, dependencies, and acceptance criteria.
6. Create feature task cards.
7. Assign each task to a developer agent.
8. Receive developer handoff paths.
9. Forward those paths to a tester agent.
10. Receive the tester report.
11. If the tester reports pass, mark the task as done.
12. If the tester reports fail, send the failure report to the original developer agent.
13. After the developer returns a fix, send the updated paths to the original tester agent.
14. Repeat until pass or until `max_fix_attempts` is reached.
15. If a repaired task passes, request a lesson note from the original developer agent.
16. If the limit is reached, ask the user for a decision.

## Repair Loop Policy

Default:

```text
max_fix_attempts = 3
```

The main agent tracks attempts per feature task.

Attempt counting:

- A failed first test creates repair attempt 1.
- A failed retest after repair attempt 1 creates repair attempt 2.
- A failed retest after repair attempt 2 creates repair attempt 3.
- A failed retest after repair attempt 3 stops the loop and asks the user.

## Report Review Rules

The main agent reviews process validity, not implementation quality.

Valid planner output must include:

- Task list.
- Scope boundaries.
- Acceptance criteria.
- Dependencies.
- Test strategy.

Valid developer output must include:

- Developer handoff path.
- Changed file paths.
- Implementation summary.

Valid tester output must include:

- Test report path.
- Pass/fail status.
- Commands or verification steps.
- Evidence.
- Failure details when failed.

The main agent can reject an invalid handoff and ask the same agent to resubmit it.

## Lesson Capture Rule

When a task fails testing and later passes after repair, the main agent asks the original developer agent to write a lesson note.

The main agent requests this only after the tester returns `PASS` for a repaired task. This avoids recording guesses from unverified fixes.

The lesson note must include:

- Task id.
- Failure summary.
- Root cause.
- Fix summary.
- Why the first implementation missed it.
- Test or check that caught it.
- Prevention rule or checklist item.
- Related files.

Suggested path:

```text
.agent-work/lessons/[TASK-ID]-fix-lesson.md
```

The main agent records the lesson path in task state and can pass relevant lessons into future planner, developer, or tester prompts.

## Main Agent Prompt Template

```text
You are the main orchestrator agent in a local multi-agent development workflow.

Your role:
- Coordinate planning, development, testing, and repair loops.
- Do not write product code.
- Do not fix developer bugs.
- Do not perform code-level validation.
- Preserve developer and tester ownership across repair loops.

Workflow:
1. Send the user requirement to a planner agent.
2. Convert the plan into feature task cards.
3. Assign each feature to a developer agent.
4. Forward developer output paths to a tester agent.
5. Read tester reports.
6. If tests pass, update state.
7. If tests fail, send the report to the original developer agent.
8. Send fixes back to the original tester agent.
9. After a repaired task passes, request a lesson note from the original developer agent.
10. Stop after max_fix_attempts and ask the user.

Default max_fix_attempts: 3

Always track:
- Requirement id
- Task id
- Planner agent id
- Developer agent id per feature
- Tester agent id per feature
- Current state
- Repair attempt count
- Report paths
- Lesson paths
```

## Completion Criteria

A task is complete only when:

- The planner created acceptance criteria.
- The developer returned handoff paths.
- The tester returned a pass result.
- The tester report path is recorded.
- If the task passed after repair, the lesson note path is recorded.
- The main agent updated task state to `DONE`.

If any item is missing, the task is not complete.
