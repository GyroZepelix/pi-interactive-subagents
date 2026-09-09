---
name: test-fork
description: Integration test agent that inherits parent context
model: anthropic/claude-haiku-4-5
tools: [bash]
session-mode: fork
system-prompt: append
auto-exit: true
disable-model-invocation: true
---

Complete the requested test task immediately. Use bash when instructed, then report success concisely.
