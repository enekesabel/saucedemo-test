---
name: ayme-codegen
description: Runs Ayme codegen recording and generates page object models and test specs from the recording output. Use when the user asks to generate a POM, record a page, run codegen, or create page objects from a URL.
---

# Ayme Codegen

Generate page objects and test specs from Ayme codegen recordings.

The codegen tool opens a browser where the user records interactions. When recording finishes, it outputs a synthesis describing the page structure, a semantic timeline of interactions, per-visit semantic trees with locator recommendations, and pre-structured test steps with assertions. These are used to generate plain TypeScript POM classes and a Playwright test spec.

## Workflow

### 1. Resolve the target URL

Determine the URL before starting codegen. Check the user's prompt first, then `playwright.config.ts` for `use.baseURL`. Never run codegen without a URL.

### 2. Run codegen

Run the codegen command in the background and wait for completion. See [references/codegen-cli.md](references/codegen-cli.md) for CLI usage and output format.

### 3. Generate POM files

Generate page object and component classes from the codegen output. See [references/pom-generation.md](references/pom-generation.md).

### 4. Generate test spec

Generate a test that replays the recorded session using the POMs. See [references/test-generation.md](references/test-generation.md).

### 5. Run and verify

Run the test and iterate until it passes. See [references/run-and-verify.md](references/run-and-verify.md).

## Constraints

See [references/constraints.md](references/constraints.md) for all rules that apply throughout the workflow.
