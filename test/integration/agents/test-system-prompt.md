---
name: test-system-prompt
description: Integration test agent with profile-defined system prompt
model: anthropic/claude-haiku-4-5
tools: [bash]
session-mode: standalone
system-prompt: replace
auto-exit: true
disable-model-invocation: true
---

You are an integration-test agent. Always begin your final response with CUSTOM_PROMPT_ACTIVE. Execute an explicitly requested bash command before responding.
