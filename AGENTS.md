# AGENTS.md

This worktree is for the perler beads blueprint project.

For ordinary single-conversation development, read the short current context first:

- `docs/agent-workflow/current-context.md`

## Workflow Documents

Read these only before running coordinated multi-agent work:

- `docs/agent-workflow/local-agent-orchestrator-design.md`
- `docs/agent-workflow/main-agent-design.md`
- `docs/agent-workflow/sub-agents-design.md`
- `docs/agent-workflow/claude-code-deepseek.md`

Runtime coordination records live in the main project folder:

```text
D:\vibecoding_project\perlerbeads_blueprint_exchange\.agent-work\
```

## Main Rule

The main orchestrator coordinates work but does not implement product code.

Developer agents implement scoped tasks. Tester agents verify results. Failed tests go back to the original developer agent. Fixes go back to the original tester agent. After a repaired task passes, the original developer writes a short lesson note.

## Claude Code External Executor

Claude Code can be used as an external developer or tester executor for small, scoped tasks.

Use project-level Claude Code subagents from:

```text
.claude/agents/
```

Do not store API keys in this repository. If using DeepSeek through Claude Code, configure credentials locally with environment variables or local Claude settings.

## Current Feature Context

Keep detailed current feature notes in `docs/agent-workflow/current-context.md`.
