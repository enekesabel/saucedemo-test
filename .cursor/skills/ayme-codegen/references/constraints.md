# Constraints

These rules apply throughout the entire workflow.

## Imports

Import `test` and `expect` from `playwright/support/fixtures`. The `expect` export is pre-extended with the `toHaveState` matcher.

## Source of truth

- Only generate what the codegen synthesis output provides. Do not invent or assume additional page objects, components, states, actions, or child elements beyond what appears in the synthesis response.
- Generated classes must contain **only** the members (actions, states, children) present in synthesis — no extra methods, helpers, getters, utilities, or convenience wrappers.

## Error handling

If codegen or synthesis fails, report the exact failure and stop.

## File layout

- POM files go in `playwright/pom/`
- Test specs go in `playwright/e2e/`
- The `toHaveState` matcher lives in `playwright/support/toHaveState.ts`

## Divergence reporting

During POM and test generation, the agent may need to deviate from the codegen synthesis output (e.g., adding actions not in the synthesis to cover timeline interactions). Track every such divergence and report them all to the user after generation is complete.

The report must be human-readable — the user does not have access to raw timeline entries, structural node IDs, or synthesis internals. For each divergence, describe:
- What was added or changed
- What recorded interaction made this necessary (describe the user's action in plain language)
- What the agent did to resolve it

## Output scope

Do not generate extra files (documentation, READMEs, etc.) beyond POM files and the test spec.
