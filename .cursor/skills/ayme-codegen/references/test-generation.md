# Test Generation

Generate a test spec that replays the user's recorded session using the generated POMs and `toHaveState` assertions.

## Setup

Import `test` and `expect` from `playwright/support/fixtures`. The `expect` export is already extended with the `toHaveState` matcher.

```typescript
import { expect, test } from '../support/fixtures';
```

## Steps

1. Use the `semanticTimeline` from the codegen output as the source of truth.
2. Group timeline entries by `visitId` — each group corresponds to interactions on one page.
3. Each `triggered` entry represents a user action — map it to the corresponding POM action method.
4. Use `effects` on each entry to generate `toHaveState` assertions after actions.
5. Use `semanticNarrative` (intent, interactionSummary) to inform test naming and structure.
6. Place the test spec in `playwright/e2e/`, following the naming convention `<feature>.spec.ts`.

## Page transitions

When a timeline entry has `causedNavigation: { toVisitId }`, the action triggered a page navigation. In the test:

1. Call the POM action that triggered the navigation
2. Instantiate the next page's POM class (using the same `page` fixture)
3. Continue with the next visit's timeline entries against the new POM

## toHaveState assertions

Use `toHaveState` to assert semantic facts from timeline `effects`. The matcher polls query methods until all expectations pass simultaneously.

```typescript
await expect(somePom).toHaveState({
  queryMethodName: expectedValue,
});
```

Use `stableFor` when a matching state can flicker before settling:

```typescript
await expect(somePom).toHaveState(
  { queryMethodName: expectedValue },
  { stableFor: 300 },
);
```

## Rules

- The test must be a faithful replay of the recorded session.
- Do not add extra steps or assertions beyond what the timeline contains.
- Do not invent interactions that were not recorded.
- Never use branching statements in tests.
- **Tests must only interact with the page through public POM actions and read state through public POM query methods.** Never access locators, `page`, or any internal fields directly from a test. If a timeline interaction cannot be expressed through existing POM actions, the POM must be extended first (see POM Generation > Synthesis gap resolution).
