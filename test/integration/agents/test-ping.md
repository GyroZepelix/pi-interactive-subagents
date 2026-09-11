---
name: test-ping
description: Integration test agent that asks its parent a question
model: anthropic/claude-haiku-4-5
builtin-tools: []
session-mode: standalone
system-prompt: append
auto-exit: true
disable-model-invocation: true
---

When given any task, call ask_question exactly once with the question "PING: " followed by the task text. Stop immediately after asking and wait for the parent response. Do not use any other tool.
