# Codegen CLI

## Running codegen

The **exact** command to run codegen is:

```bash
pnpm run ayme codegen <url> --emit-synthesis
```

The URL is a **required** positional argument placed before flags.

This command is interactive and long-running — the user records actions in a browser window. It may take several minutes. Wait for completion; do not time out.

## Output format

The CLI prints a single JSON object to stdout with three top-level fields:

```json
{
  "synthesis": { ... },
  "semanticTimeline": [ ... ],
  "semanticTree": { ... }
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
  id: string                               // Unique state identifier
  name: string                             // Semantic name (e.g., "isExpanded", "selectedIndex")
  description: string                      // What this state represents
  valueType: 'boolean' | 'string' | 'number'
}
```

#### DiscoveredAction

```typescript
DiscoveredAction = {
  id: string                                // Unique action identifier
  name: string                              // Semantic name (e.g., "expand", "submit")
  description: string                       // What this action does
  parameters: ActionParameterDefinition[]   // Parameters this action accepts
  expectedStateEffects: ExpectedStateEffect[] // Expected state changes
}

ActionParameterDefinition = {
  name: string
  type: 'boolean' | 'string' | 'number'
  description: string
  required: boolean
}

ExpectedStateEffect = {
  stateId: string
  expectedValue:
    | { kind: 'static', value: boolean | string | number }
    | { kind: 'dynamic', fromParameter: string }
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
  subjectInstance: ScopedStructuralRef  // { visitId, structuralNodeId }
  stateKey: string                     // e.g. 'isVisible', 'value', 'isChecked'
  previousValue: boolean | string | number | null
  currentValue: boolean | string | number
}
```

#### RecorderInteraction

```typescript
RecorderInteraction = {
  id: string
  type: 'click' | 'fill' | 'press' | 'select' | 'check' | 'uncheck' | 'hover' | 'navigate' | 'openPage' | 'closePage' | 'setInputFiles' | ...
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
  locators?: string[]            // Playwright locator strings (e.g., "getByRole('button', { name: 'Login' })")
  states?: Array<{ key: string, type: string }>
  interactions?: Array<{
    timelineRecordId: string
    type: string
    parameters?: Record<string, unknown>
    effects: Array<{
      subject: string            // Structural node ID
      stateKey: string
      previousValue: unknown
      currentValue: unknown
    }>
    contained: boolean           // Whether all effects are within this node's subtree
  }>
  children?: SemanticTreeNodeJson[]
}
```

## Connecting the three fields

The visit-scoped structural reference `{ visitId, structuralNodeId }` is the shared key across all three:

| Field | Where references appear | Purpose |
|---|---|---|
| `synthesis` | `sourceStructuralNodeIds` on pages/patterns/children | Links conceptual POM to DOM elements |
| `semanticTimeline` | `subjectInstance` on effects, `targetNodeId` + `visitId` on interactions | Identifies interaction targets and state change subjects |
| `semanticTree` | `semanticTree[visitId].page.children[].ref` | Provides locators and hierarchy for each element |

**Workflow:** Use `synthesis` for the class structure (what classes, states, actions to create). Look up locators in `semanticTree[visitId]` by matching `ref` to `structuralNodeId`. Use `semanticTimeline` to generate the test spec, grouping entries by `visitId`.
