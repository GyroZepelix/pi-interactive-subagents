# Verification: Detect subagent completion without screen scraping and fix AGY SSH login

Work item: `261112-1059-detect-subagent-completion-without-screen-scraping-and-fix-agy-ssh-login`
Date: 2026-11-12

## Environment

- macOS, tmux (shared default server, run from an SSH-tagged pane), Node test runner, AGY CLI 1.5.6.
- Base commit `b4e1ca2`; all changes unstaged in the working tree plus this untracked item directory. No unrelated changes.
- Mode direct; assurance medium (inherited from `plan.md`).
- Provenance: T01-T04 were implemented by the parent session before the Implement run. The Implement run re-ran every planned check and the required review over the complete working-tree diff, so the earlier unreviewed evidence is superseded by the rows below.
- The Implement run executed inside a Pi subagent. Its `PI_SUBAGENT_*` variables (allowlist) make unrelated discovery unit tests fail with `agent not in allowlist`, so checks ran with every `PI_SUBAGENT_*` variable unset (`env -u ...`), matching a normal parent session.

## Commands and checks

| Check | Result | Evidence |
| --- | --- | --- |
| `npm test` | Pass | 296 pass, 0 fail (baseline before the change: 290). |
| `npm run test:integration` run 1 | 19 of 20 | Failure: `applies the profile-defined system prompt` (120 s wait for `CUSTOM_PROMPT_ACTIVE`). The child finished and its result reached the parent; the child model did not start its reply with the marker. Unchanged code path. |
| Isolated rerun of that test | Pass 2 of 2 | `node --test --test-name-pattern="applies the profile-defined system prompt" test/integration/subagent-lifecycle.test.ts`, about 13 s each. |
| `npm run test:integration` run 2 | 19 of 20 | Failure: `keeps focus on the active surface` (focus moved to an operator `nvim` pane in the shared tmux server). Unchanged code path. |
| Isolated rerun of that test | Pass 2 of 2 | `node --test --test-name-pattern="keeps focus on the active surface" test/integration/tmux-surface.test.ts`. |
| New integration tests | Pass in both full runs | Narrow-pane wrapped sentinel (12-column pane, about 1.1 s); completion file after `clear` (about 3 s). |
| Earlier evidence: negative control (narrow-pane test with `-J` reverted) | Fails as expected | Parent session: timed out at 60 s without `-J`; passes in about 1.2 s with the fix. |
| Earlier evidence: manual AGY auth check | Pass | Parent session: from an SSH-tagged pane, `env -u SSH_CONNECTION -u SSH_CLIENT -u SSH_TTY agy --print ...` returned `SUCCESS` with `silent auth succeeded`. |
| Earlier evidence: AGY stdin check | Recorded | `< /dev/null` did not shorten the 60 s login wait (basis for D3). |
| `git diff --check` | Pass | Clean. |

## Requirement coverage

| Requirement | Evidence | Status |
| --- | --- | --- |
| R1 | `completionSuffix` at all 5 sites (`index.ts` Claude launch, Pi launch, Pi resume; `buildAgyCommand` for AGY launch and resume), each with a fresh launch id via `prepareSubagentDoneFile`; bash unit test checks file content and temp-file removal; integration done-file test. | Met |
| R2 | Unit tests: done file finishes without screen reads and is deleted; `.exit` wins in the same tick; unparsable content returns 1. `watchSubagent` passes `doneFile`; model-chain targets reach `watchSubagent`. | Met |
| R3 | Integration narrow-pane test plus negative control. | Met |
| R4 | Unit test asserts the `env -u ...` prefix; manual AGY auth check. | Met |
| R5 | Unit test: not-logged-in message, raw `providerError`, no OAuth URL, non-auth errors unchanged; `classifyExhaustion` input unchanged. | Met |
| R6 | Existing unit and integration suites pass; sentinel stripping, Claude Stop hook, `.exit`, and pane-missing handling unchanged. | Met |

## Review findings

- Contract-quality review (medium assurance, final, direct): PASS. No blocking or non-blocking findings. Coverage: plan R1-R6, D1-D4, all 5 launch sites, `pollForExit` priority, model-chain path, tests, wiki updates. Retries: 0.

## Failures and skipped checks

- Two different intermittent integration failures, one per full run, each in an unchanged path (live model output; operator focus in the shared tmux server) and each passing 2 of 2 isolated reruns. The earlier parent run had a third one (`ask_question`), which passed in both full runs here. No failure involved completion detection.

## Unverified areas

- No live AGY or Claude child was launched end-to-end through the extension; command construction is unit-tested and the shared suffix is integration-tested.
- No type-check is configured in the repository.
