# Claude Code + DeepSeek Executor Notes

This project can use Claude Code as an external executor in the local multi-agent workflow.

## Project Agents

Project-level Claude Code agents live in:

```text
.claude/agents/
```

Available roles:

- `planner`
- `developer`
- `tester`
- `reviewer`

## DeepSeek Environment

Do not commit API keys.

Set DeepSeek variables in PowerShell before launching Claude Code:

```powershell
$env:ANTHROPIC_BASE_URL="https://api.deepseek.com/anthropic"
$env:ANTHROPIC_AUTH_TOKEN="<your-deepseek-api-key>"
$env:ANTHROPIC_MODEL="deepseek-v4-pro"
$env:ANTHROPIC_DEFAULT_OPUS_MODEL="deepseek-v4-pro"
$env:ANTHROPIC_DEFAULT_SONNET_MODEL="deepseek-v4-pro"
$env:ANTHROPIC_DEFAULT_HAIKU_MODEL="deepseek-v4-flash"
$env:CLAUDE_CODE_SUBAGENT_MODEL="deepseek-v4-flash"
$env:CLAUDE_CODE_EFFORT_LEVEL="max"
```

Then start Claude Code from the worktree:

```powershell
cd D:\vibecoding_project\perlerbeads_blueprint_exchange\.worktrees\feature-mard-coco-mvp
claude
```

## Non-Interactive Executor Calls

The orchestrator can call Claude Code in print mode for a scoped task:

```powershell
claude --agent developer -p "Read .agent-work task context from the main project and implement the scoped task." --permission-mode acceptEdits
```

For tester work:

```powershell
claude --agent tester -p "Read the task card and developer handoff, then verify and report PASS or FAIL." --permission-mode dontAsk
```

## Workflow Rule

Claude Code developer executors should return a handoff. The orchestrator then routes that handoff to a tester. If tests fail, the same developer executor should receive the failure report for repair when possible.
