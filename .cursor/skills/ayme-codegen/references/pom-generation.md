# POM Generation

Generate page object and component classes from the codegen synthesis output using plain TypeScript classes and Playwright locators.

## File organization

- Place all generated POM files under `playwright/pom/`
- One file per synthesized page or significant component pattern
- Use PascalCase for class names, matching the `name` from synthesis
- Export an `index.ts` barrel file if multiple POM files are created

## What to generate

Map synthesis output to plain TypeScript classes:

- Each entry in `synthesis.pages` → a page class
- Each entry in `synthesis.patterns` → a component class (for patterns with `cardinality: "multiple"` or reusable components)
- `states` → async query methods that return the state value
- `actions` → async methods that perform the interaction
- `children` with `cardinality: "multiple"` → async accessor method that returns a list of component instances via `locator.all()`
- `children` with `cardinality: "single"`:
  - without `patternId` → private locator field
  - with `patternId` → component instance field or accessor

## Class structure

Page classes receive `Page` from Playwright. Component classes receive a `Locator` representing their root element. All DOM access is private — tests interact only through public query methods and action methods.

### Page class

A page class wraps the full page. Locators are private, derived from the `semanticTree`. Query methods expose semantic state. Action methods perform multi-step interactions.

```typescript
import type { Locator, Page } from '@playwright/test';

class SomePage {
  private inputField: Locator;
  private itemsLocator: Locator;
  private statusText: Locator;

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

  // Query methods model user-observable facts
  async itemCount() {
    return this.itemsLocator.count();
  }

  async statusValue() {
    const text = await this.statusText.innerText();
    return Number.parseInt(text, 10);
  }

  // Actions perform multi-step interactions
  async addItem(text: string) {
    await this.inputField.fill(text);
    await this.inputField.press('Enter');
  }
}
```

### Component class

A component class wraps a repeatable UI fragment. It receives a `Locator` pointing to the component's root element. Internal locators are scoped to `root`.

```typescript
class SomeItem {
  private checkbox: Locator;
  private label: Locator;

  constructor(readonly root: Locator) {
    this.checkbox = root.getByRole(/* from semanticTree locators */);
    this.label = root.locator(/* from semanticTree locators */);
  }

  // Query methods answer one semantic question each
  async text() {
    return this.label.innerText();
  }

  async isChecked() {
    return this.checkbox.isChecked();
  }

  // Actions mutate the component
  async toggle() {
    await this.checkbox.click();
  }
}
```

## Query methods (state)

Model each synthesized state as an async zero-argument method that returns a stable semantic value.

Principles:
- Method name matches the state `id` from synthesis, converted to camelCase
- Return type matches the state `valueType` (boolean, string, number)
- Locator access is internal to the class — tests never touch locators
- A query method can collapse multiple DOM signals into one semantic value when that improves clarity

```typescript
// Collapsing multiple indicators into one semantic state
async currentState() {
  if (await this.errorBanner.isVisible()) return 'error';
  if (await this.spinner.isVisible()) return 'saving';
  if (await this.successBadge.isVisible()) return 'saved';
  return 'idle';
}
```

## Using locators from semanticTree

The `semanticTree` in the codegen output contains Playwright locator recommendations for each detected element, keyed by visit ID. Use these to implement locators in class constructors:

1. Find the element's `sourceStructuralNodeIds` (e.g., `[{ visitId: "visit_1", structuralNodeId: "e11" }]`)
2. Look up `semanticTree["visit_1"]` and find the node where `ref === "e11"`
3. Use the `locators` array from that node (first entry is usually the best candidate)

## Multi-page handling

When synthesis contains multiple pages, generate one class per page. Each page class is independent and receives a `Page` instance. The test orchestrates navigation between pages.

## Strict output boundary

**Only generate class members that map directly to items in the synthesis output.**

- Each query method, action method, and child accessor must correspond 1:1 to an entry in the synthesis response.
- Do **not** add convenience methods, helper functions, getters, setters, utility properties, or any members that are not directly backed by synthesis data.

## Synthesis gap resolution

The synthesis may not cover every interaction captured in the timeline. When the timeline contains a `triggered` interaction that targets a child element with no corresponding action in the synthesis, add the minimal action needed to replay the timeline:

1. Cross-reference the `semanticTimeline` with the synthesis actions. For each `triggered` entry, verify a POM action exists that covers the interaction.
2. If a timeline interaction has no matching action, add a public action method to the appropriate POM class. Name it based on the `semanticNarrative.intent` from the timeline entry.
3. Keep additions minimal — only add what is required to replay the recorded session.
4. Record every addition as a divergence from the synthesis (see Constraints for divergence reporting).
