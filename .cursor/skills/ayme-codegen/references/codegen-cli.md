# Codegen CLI

## Running codegen

The **exact** command to run codegen is:

```bash
pnpm run ayme codegen <url> --emit-synthesis
```

The URL is a **required** positional argument placed before flags.

This command is interactive and long-running — the user records actions in a browser window. It may take several minutes. Wait for completion; do not time out.

## Output format

The CLI prints a single JSON object to stdout with four top-level fields:

```json
{
  "synthesis": { ... },
  "semanticTimeline": [ ... ],
  "semanticTree": { ... },
  "testOutput": { ... }
}
```

### `synthesis` — Page object model

Describes the page structure as a set of pages and reusable patterns with states, actions, and children.

The top-level synthesis response schema:

```typescript
SynthesisResponse = {
  pages: SynthesizedPage[]     // One entry per distinct page visited during recording
  patterns: SynthesizedPattern[] // Reusable component patterns with states and actions
}
```

#### SynthesizedPage

```typescript
SynthesizedPage = {
  id: string                          // Unique page identifier
  name: string                        // Descriptive name
  description: string                 // What this page represents
  urls: string[]                      // Observed URLs that map to this page (min 1)
  sourceVisitIds: string[]            // Visit IDs merged into this page (min 1)
  children: SynthesizedPatternChild[] // Top-level children on the page
  states: DiscoveredState[]           // States discovered from recording
  actions: DiscoveredAction[]         // Actions discovered from recording
}
```

#### SynthesizedPattern

```typescript
SynthesizedPattern = {
  id: string                          // Unique pattern identifier (snake_case, no "_pattern" suffix)
  name: string                        // Descriptive name
  description: string                 // What this pattern represents
  children: SynthesizedPatternChild[] // Child elements composing this pattern
  sourceStructuralNodeIds: ScopedStructuralRef[] // Visit-scoped node IDs this pattern was generalized from (min 1)
  cardinality: 'single' | 'multiple' // How many instances exist
  complexity: 'atomic' | 'composite' // atomic: no child patterns; composite: at least one child has patternId
  conceptualScope: 'global' | 'application' | 'page' | 'pattern'
  aggregatePatternId?: string         // Parent pattern ID; required when conceptualScope is 'pattern'
  states: DiscoveredState[]
  actions: DiscoveredAction[]
}
```

#### SynthesizedPatternChild

```typescript
SynthesizedPatternChild = {
  id: string                          // Unique child identifier within the pattern (snake_case)
  name: string                        // Descriptive name
  description: string                 // What this child represents
  cardinality: 'single' | 'multiple'
  patternId?: string                  // References another pattern if this child is a composite pattern
  sourceStructuralNodeIds: ScopedStructuralRef[] // (min 1)
}
```

#### ScopedStructuralRef

```typescript
ScopedStructuralRef = {
  visitId: string          // Which recording visit this reference belongs to
  structuralNodeId: string // Structural node ID within that visit's DOM tree
}
```

#### DiscoveredState

```typescript
DiscoveredState = {
  id: string       // Unique state identifier
  name: string     // Semantic name (e.g., "isExpanded", "selectedIndex")
  description: string // What this state represents
}
```

#### DiscoveredAction

```typescript
DiscoveredAction = {
  id: string                              // Unique action identifier
  name: string                            // Semantic name (e.g., "expand", "submit")
  description: string                     // What this action does
  parameters: ActionParameterDefinition[] // Parameters this action accepts
}

ActionParameterDefinition = {
  name: string
  description: string
  required: boolean
}
```

### `semanticTimeline` — Chronological record of the session

An array of entries, each representing a user interaction or autonomous page change. Entries are ordered chronologically and include a `visitId`.

#### SemanticTimelineEntry (triggered)

```typescript
TriggeredSemanticActionEntry = {
  kind: 'triggered'
  visitId: string
  timelineRecordId: string
  timestamp: number
  recorderInteraction: RecorderInteraction
  effects: SemanticEffect[]
  semanticNarrative: {
    intent: string              // Domain-rich user intent
    interactionSummary: string  // What the user did
    effectSummary: string       // User-visible changes
  }
  causedNavigation?: {
    toVisitId: string           // Present when this interaction caused a page transition
  }
}
```

#### SemanticTimelineEntry (unassigned)

```typescript
UnassignedSemanticChangeEntry = {
  kind: 'unassigned'
  visitId: string
  timelineRecordId: string
  timestamp: number
  effects: SemanticEffect[]
  semanticNarrative: {
    effectSummary: string       // What changed on the page
  }
}
```

#### SemanticEffect

```typescript
SemanticEffect = {
  id: string                     // Unique effect identifier (e.g., "effect_timeline_7_0")
  description: string            // Natural language description (e.g., "Shopping Cart Badge appeared")
  affectedInstances: string[]    // Structural node IDs of affected elements
}
```

#### RecorderInteraction

```typescript
RecorderInteraction = {
  id: string
  type: 'click' | 'fill' | 'press' | 'select' | 'check' | 'uncheck' | 'hover' | 'navigate' | 'openPage' | 'closePage' | 'setInputFiles' | 'assertVisible' | ...
  targetNodeId: string | null
  signals?: Array<{ name: 'navigation' | 'popup' | 'download' | 'dialog', url?: string }>
  text?: string           // For fill actions
  key?: string            // For press actions
  button?: 'left' | 'middle' | 'right'
  modifiers?: number
  clickCount?: number
}
```

### `semanticTree` — Per-visit semantic hierarchy with locators

A dictionary keyed by visit ID. Each value is a semantic tree for that visit with the following shape:

#### SemanticTreeJson

```typescript
SemanticTreeJson = {
  page: {
    children: SemanticTreeNodeJson[]
  }
}
```

#### SemanticTreeNodeJson

```typescript
SemanticTreeNodeJson = {
  ref: string                    // Structural node ID (matches structuralNodeId in ScopedStructuralRef)
  name: string
  description: string
  suggestedRole?: 'pattern' | 'leaf'
  appearedAfter?: string         // Timeline record ID after which this node appeared
  disappearedAfter?: string      // Timeline record ID after which this node disappeared
  locators?: string[]            // Playwright locator strings (e.g., "locator('[data-test=\"username\"]')")
  yamlSubtree?: string           // DOM subtree YAML showing text content, labels, and element roles (e.g., "- link \"Sauce Labs Backpack\" [ref=e158]")
  interactions?: Array<{
    timelineRecordId: string
    type: string
    parameters?: Record<string, unknown>
    effects: Array<{
      description: string        // Natural language description
      affectedInstances: string[] // Structural node IDs
    }>
    contained: boolean           // Whether all effects are within this node's subtree
  }>
  children?: SemanticTreeNodeJson[]
}
```

### `testOutput` — Pre-structured test steps and assertions

Contains AI-generated test structure with two levels of abstraction (UI steps and flow steps) and two test scenarios (UI test and E2E test). **This is the primary source of truth for test generation.**

May be `null` if test step generation failed.

#### UiStep

A boundary-scoped step containing direct timeline interactions. Each UI step operates within exactly one boundary (a page visit or a component like a modal).

```typescript
UiStep = {
  id: string                     // Unique identifier (e.g., "ui_1")
  name: string                   // Concrete description (e.g., "Login with username 'standard_user' and password 'secret_sauce'")
  boundaryRef: string            // Visit ID or structural node ID identifying the boundary
  sequence: string[]             // Ordered timeline record IDs that make up this step
}
```

#### FlowStep

A higher-level step that composes UI steps across boundaries, representing a user goal.

```typescript
FlowStep = {
  id: string                     // Unique identifier (e.g., "flow_1")
  name: string                   // Goal-oriented description (e.g., "Authenticate user")
  sequence: string[]             // Ordered UI step IDs that compose this flow step
}
```

#### Assertion

```typescript
Assertion = {
  description: string            // What to verify (e.g., "Shopping Cart Badge appeared")
  effectIds: string[]            // Semantic effect IDs from the timeline that this assertion verifies
}
```

#### UiTestEntry

```typescript
UiTestEntry = {
  uiStepId: string               // The UI step to execute
  assertions: Assertion[]        // Assertions to verify after this step
}
```

#### E2eTestEntry

```typescript
E2eTestEntry = {
  flowStepId: string             // The flow step to execute
  assertions: Assertion[]        // Outcome-level assertions after this flow step
}
```

#### TestOutput

```typescript
TestOutput = {
  uiSteps: UiStep[]             // All boundary-scoped UI steps
  flowSteps: FlowStep[]         // Higher-level flow steps composing UI steps
  uiTest: UiTestEntry[]         // UI test: ordered UI steps with assertions
  e2eTest: E2eTestEntry[]       // E2E test: ordered flow steps with outcome assertions
}
```

## Connecting the fields

The visit-scoped structural reference `{ visitId, structuralNodeId }` is the shared key across synthesis and semanticTree:

| Field | Where references appear | Purpose |
|---|---|---|
| `synthesis` | `sourceStructuralNodeIds` on pages/patterns/children | Links conceptual POM to DOM elements |
| `semanticTimeline` | `effects[].affectedInstances`, `targetNodeId` + `visitId` on interactions | Identifies interaction targets and state change subjects |
| `semanticTree` | `semanticTree[visitId].page.children[].ref` | Provides locators and hierarchy for each element |
| `testOutput` | `uiStep.boundaryRef` (visit ID or structural node ID), `uiStep.sequence` (timeline record IDs) | Groups timeline interactions into named steps with assertions |

**Workflow:** Use `synthesis` for the class structure (what classes, children to create). Look up locators in `semanticTree[visitId]` by matching `ref` to `structuralNodeId`. Use `testOutput.uiSteps` as the primary source for POM action methods. Use `testOutput.uiTest` to generate the test spec. Use `semanticTimeline` as supplementary detail for understanding interaction parameters and effects.
