# POM Generation

Generate page object and component classes from the codegen output using plain TypeScript classes, Playwright locators, and the `@step` decorator.

## File organization

- Place all generated POM files under `playwright/pom/`
- One file per synthesized page or significant component pattern
- Use PascalCase for class names, matching the `name` from synthesis
- Export an `index.ts` barrel file if multiple POM files are created

## What to generate

Map the codegen output to plain TypeScript classes:

- Each entry in `synthesis.pages` → a page class
- Each entry in `synthesis.patterns` → a component class (for patterns with `cardinality: "multiple"` or reusable components)
- `states` → async query methods that return the state value
- `actions` → async `@step` decorated methods that perform the interaction
- `children` with `cardinality: "multiple"` → async accessor method that returns a list of component instances via `locator.all()`
- `children` with `cardinality: "single"`:
  - without `patternId` → public locator field
  - with `patternId` → component instance field or accessor

## The `@step` decorator

Define the following decorator in `playwright/support/step.ts`:

```typescript
import { test } from '@playwright/test';

export function step(target: Function, context: ClassMethodDecoratorContext) {
  return function replacementMethod(this: any, ...args: any[]) {
    const name = this.constructor.name + '.' + (context.name as string);
    return test.step(name, async () => {
      return await target.call(this, ...args);
    }, { box: true });
  };
}
```

Every public action method on a page or component class must be decorated with `@step`.

## Class structure

Page classes receive `Page` from Playwright. Component classes receive a `Locator` representing their root element. Locators are **public** — tests use them directly for standard Playwright assertions (`toBeVisible`, `toHaveText`, etc.) and through `toHaveState` (which works on any object with async zero-argument methods, including Locators).

### Page class

A page class wraps the full page. Locators are public, derived from the `semanticTree`. Action methods perform multi-step interactions and are decorated with `@step`. Query methods are only added when they provide genuine semantic abstraction (see "Query methods" below).

```typescript
import type { Locator, Page } from '@playwright/test';
import { step } from '../support/step';

class SomePage {
  inputField: Locator;
  itemsLocator: Locator;
  statusText: Locator;

  constructor(readonly page: Page) {
    this.inputField = page.getByRole(/* from semanticTree locators */);
    this.itemsLocator = page.getByRole(/* from semanticTree locators */);
    this.statusText = page.locator(/* from semanticTree locators */);
  }

  // Collection accessor: returns all component instances
  async items() {
    const locators = await this.itemsLocator.all();
    return locators.map(locator => new SomeItem(locator));
  }

  // Actions perform multi-step interactions
  @step
  async addItem(text: string) {
    await this.inputField.fill(text);
    await this.inputField.press('Enter');
  }
}
```

### Component class

A component class wraps a repeatable UI fragment. It receives a `Locator` pointing to the component's root element. Internal locators are scoped to `root` and are public.

```typescript
class SomeItem {
  checkbox: Locator;
  label: Locator;

  constructor(readonly root: Locator) {
    this.checkbox = root.getByRole(/* from semanticTree locators */);
    this.label = root.locator(/* from semanticTree locators */);
  }

  // Actions mutate the component
  @step
  async toggle() {
    await this.checkbox.click();
  }
}
```

## Actions from test steps

`testOutput.uiSteps` is the **primary source** for POM action methods. Each uiStep maps to the page class whose visit matches the step's `boundaryRef`:

1. Find which `synthesis.page` owns the visit referenced by `uiStep.boundaryRef` (match via `sourceVisitIds`)
2. Create a `@step` decorated async method on that page class
3. Name the method based on the step's `name`, converted to camelCase (e.g., "Login with username..." → `login`)
4. Look at the step's `sequence` (timeline record IDs) and cross-reference with `semanticTimeline` to find the `recorderInteraction` for each entry
5. Implement the method body by replaying those interactions using locators
6. Infer method parameters from the timeline data — e.g., if the sequence contains `fill` interactions with literal text values, those become method parameters

### Parameterization

When a uiStep's sequence includes `fill` interactions, extract the filled values as method parameters:

- Look at each `recorderInteraction` in the sequence
- For `fill` interactions, the `text` field contains the literal value used during recording
- Convert these into method parameters with descriptive names
- Synthesis `actions` may provide parameter names and descriptions — use those when available

### Matching uiSteps to synthesis actions

Synthesis `actions` on pages/patterns may overlap with uiSteps. When both exist for the same logical action:

- **Prioritize uiSteps** for the method's interaction sequence (what the method does)
- **Use synthesis actions** for parameter names, descriptions, and semantic naming when they match
- If a synthesis action has no corresponding uiStep, it can still be generated as a method, but mark it as a divergence

## Query methods (state)

Query methods are only justified when they provide **genuine semantic abstraction** that cannot be achieved by using a locator directly.

**Do NOT create query methods that are 1:1 wrappers around Playwright locator methods.** For example, do not create `isCartBadgeVisible()` that just calls `this.cartBadge.isVisible()` — the test should use `expect(page.cartBadge).toBeVisible()` or `toHaveState({ isVisible: true })` directly on the locator.

**DO create query methods when they collapse multiple signals into one semantic value:**

```typescript
// Good: collapses multiple indicators into one semantic state
async currentState() {
  if (await this.errorBanner.isVisible()) return 'error';
  if (await this.spinner.isVisible()) return 'saving';
  if (await this.successBadge.isVisible()) return 'saved';
  return 'idle';
}
```

Principles:
- Method name matches the state `id` from synthesis, converted to camelCase
- Only add when the method transforms or combines data from multiple locators
- `toHaveState` works on Locators directly since locator methods (`isVisible`, `innerText`, `count`, `isChecked`, etc.) are async zero-argument methods — no wrapper needed

## Using locators from semanticTree

The `semanticTree` in the codegen output contains Playwright locator recommendations for each detected element, keyed by visit ID. Use these to implement locators in class constructors:

1. Find the element's `sourceStructuralNodeIds` (e.g., `[{ visitId: "visit_1", structuralNodeId: "e11" }]`)
2. Look up `semanticTree["visit_1"]` and find the node where `ref === "e11"`
3. Use the `locators` array from that node (first entry is usually the best candidate)

## Multi-page handling

When synthesis contains multiple pages, generate one class per page. Each page class is independent and receives a `Page` instance. The test orchestrates navigation between pages.

## Strict output boundary

**Only generate class members that map directly to items in the codegen output.**

- Each query method and child accessor must correspond 1:1 to an entry in the synthesis response.
- Each action method must correspond to a uiStep in testOutput, or to a synthesis action when no testOutput is available.
- Do **not** add convenience methods, helper functions, getters, setters, utility properties, or any members that are not directly backed by codegen data.

## Synthesis gap resolution

The testOutput or synthesis may not cover every interaction captured in the timeline. When the timeline contains a `triggered` interaction that targets a child element with no corresponding action in either testOutput or synthesis, add the minimal action needed to replay the timeline:

1. Cross-reference the `semanticTimeline` with the uiSteps and synthesis actions. For each `triggered` entry, verify a POM action exists that covers the interaction.
2. If a timeline interaction has no matching action, add a public `@step` decorated action method to the appropriate POM class. Name it based on the `semanticNarrative.intent` from the timeline entry.
3. Keep additions minimal — only add what is required to replay the recorded session.
4. Record every addition as a divergence from the codegen output (see Constraints for divergence reporting).
