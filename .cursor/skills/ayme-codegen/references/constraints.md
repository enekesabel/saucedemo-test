# Constraints

Cross-cutting rules that apply throughout the entire workflow. For specific guidance on POM generation, test generation, or CLI usage, see the dedicated reference files.

## Imports

Import `test` and `expect` from `playwright/support/fixtures`. Import `step` from `playwright/support/step`.

## Divergence reporting

During POM and test generation, the agent may need to deviate from the codegen output (e.g., adding actions not in testOutput or synthesis to cover timeline interactions). Track every such divergence and report them all to the user after generation is complete.

The report must be human-readable — the user does not have access to raw timeline entries, structural node IDs, or synthesis internals. For each divergence, describe:
- What was added or changed
- What recorded interaction made this necessary (describe the user's action in plain language)
- What the agent did to resolve it
