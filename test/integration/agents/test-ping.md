---
name: test-ping
description: Integration test agent that asks its parent a question
model: anthropic/claude-haiku-4-5
builtin-tools: [bash]
session-mode: standalone
system-prompt: append
auto-exit: true
disable-model-invocation: true
---

The task contains a question marker, expected answer, and exact bash command. Call ask_question exactly once with the question "PING: " followed by the question marker. Wait for its tool result. If and only if the orchestrator answer exactly matches the expected answer, run the exact bash command from the task once. Then respond exactly `PING_CONTINUED_ONCE`. Do not treat the answer as a new task or call ask_question again.
