# Test Generation

Generate a test spec that replays the user's recorded session using the generated POMs, driven by `testOutput.uiTest`.

## Setup

Import `test` and `expect` from `playwright/support/fixtures`. The `expect` export is already extended with the `toHaveState` matcher.

```typescript
import { expect, test } from '../support/fixtures';
```

## Primary source: `testOutput.uiTest`

The `testOutput.uiTest` array is the primary source of truth for test structure. Each entry pairs a uiStep with assertions to run after it.

### Steps

1. Iterate over `testOutput.uiTest` entries in order.
2. Each entry has a `uiStepId` — find the corresponding `uiStep` in `testOutput.uiSteps`.
3. Map the uiStep to the corresponding POM action method (the `@step` decorated method generated from that uiStep).
4. Call the POM action method.
5. After the action, run the entry's `assertions` as expects.

### Mapping uiSteps to POM actions

Each uiStep was used to generate a `@step` decorated method on a page class (see POM Generation). The test calls that method:

- Find which page class owns the uiStep (via `boundaryRef` → visit → synthesis page)
- Call the corresponding method with appropriate arguments
- If the uiStep's sequence contains `fill` interactions, pass the recorded values as method arguments

### Assertions from testOutput

Each `uiTestEntry.assertions` contains assertion descriptions grounded in semantic effects:

```typescript
{ description: "Shopping Cart Badge appeared", effectIds: ["effect_timeline_8_0"] }
```

Translate these into Playwright assertions:

- **Visibility assertions** ("X appeared", "X disappeared") → `expect(locator).toBeVisible()` or `expect(locator).not.toBeVisible()`
- **State assertions** → `toHaveState` matcher when the assertion maps to a query method on the POM
- Use the `effectIds` to cross-reference `semanticTimeline` effects for the structural node IDs of affected elements, then find the corresponding POM child/locator

Use POM locators directly for standard Playwright assertions — locators are public. For composite semantic state, use `toHaveState` with POM query methods.

## Page transitions

When a uiStep's sequence includes a timeline entry with a navigation signal (check `recorderInteraction.signals` for `{ name: 'navigation' }`), the action triggered a page navigation. In the test:

1. Call the POM action that triggered the navigation
2. Instantiate the next page's POM class (using the same `page` fixture)
3. Continue with subsequent uiTest entries against the new POM

## Fallback: semanticTimeline

If `testOutput` is `null` (test step generation failed), fall back to using `semanticTimeline` directly:

1. Group timeline entries by `visitId` — each group corresponds to interactions on one page.
2. Each `triggered` entry represents a user action — map it to the corresponding POM action method.
3. Use `effects` on each entry to generate assertions (interpret `effect.description` to determine what to assert).
4. Use `semanticNarrative` (intent, interactionSummary) to inform test naming and structure.

## toHaveState assertions

`toHaveState` works on any object with async zero-argument methods — including POM instances and Playwright Locators. It polls query methods until all expectations pass simultaneously.

On a POM instance (for composite semantic state):

```typescript
await expect(somePom).toHaveState({
  queryMethodName: expectedValue,
});
```

On a Locator (locator methods like `isVisible`, `innerText`, `count`, `isChecked` are async zero-argument methods):

```typescript
await expect(inventoryPage.cartBadge).toHaveState({
  isVisible: true,
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
- Do not add extra steps or assertions beyond what the testOutput or timeline contains.
- Do not invent interactions that were not recorded.
- Never use branching statements in tests.
- **Tests interact with the page through POM actions and assert state using POM locators (directly with Playwright matchers) or POM query methods (via `toHaveState`).** Locators are public; use them directly for standard assertions like `toBeVisible`, `toHaveText`, etc.
- Place the test spec in `playwright/e2e/`, following the naming convention `<feature>.spec.ts`.
