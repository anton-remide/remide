# Diagrams, Graphics & Animations Spec

> **Status:** Draft — isolated from main UI library (`/ui`) to avoid breaking changes.
> Components exist in code but are NOT shown on the design system page until stabilized.

---

## Scope

This spec covers all **non-standard visual elements** that go beyond typical UI components:

1. **Flowchart diagrams** (React Flow based)
2. **Sequence / state / ER / Gantt diagrams** (Mermaid based)
3. **Animated transitions & micro-interactions**
4. **Data visualizations** (charts, graphs — future)
5. **Interactive graphics** (map overlays, canvas elements — future)

These elements share heavy third-party dependencies (`@xyflow/react`, `mermaid`, `dagre`),
require WebGL/Canvas, or have complex rendering pipelines that can break HMR and the main UI page.

---

## Current Components

### FlowDiagram (`src/components/ui/FlowDiagram.tsx`)

React Flow wrapper that parses Mermaid-like flowchart syntax into interactive node graphs.

**Dependencies:** `@xyflow/react`, `dagre`

**Helper modules:**
- `src/components/ui/flow/parseFlowchart.ts` — parses `graph TD/LR/TB` syntax
- `src/components/ui/flow/layoutDagre.ts` — dagre-based auto layout
- `src/components/ui/flow/DiagramNode.tsx` — custom node renderer
- `src/components/ui/flow/DiagramEdge.tsx` — custom edge renderer

**Semantic node classes:**
| Class | Meaning | Colors |
|-------|---------|--------|
| `:::approved` / `:::success` | Positive outcome | `--color-success-subtle` / `--color-success` |
| `:::rejected` / `:::danger` | Negative outcome | `--color-danger-subtle` / `--color-danger` |
| `:::active` / `:::accent` | Current/highlighted | `--color-accent-subtle` / `--color-accent` |
| `:::pending` / `:::info` | In progress | `--color-info-subtle` / `--color-info` |
| `:::warning` | Caution | `--color-warning-subtle` / `--color-warning` |
| `:::display` | Key statistics | `--font2` (Doto), 18px, bold |
| `:::muted` | Background/secondary | `--color-text-secondary` |
| `:::expired` | Lapsed/inactive | Dimmed text |
| `:::revoked` | Withdrawn | Danger + strikethrough |
| `:::conditional` | Provisional | Warning + dashed border |

**Node shapes:**
- `[text]` — rectangle (default)
- `{text}` — diamond (decision)
- `(text)` — rounded

**Usage:**
```tsx
<FlowDiagram chart={`
graph TD
  A[VASP Application]:::active -->|Submit| B{Regulator Review}
  B -->|Approved| C[License Granted]:::approved
  B -->|Rejected| D[Appeal Process]:::rejected
`} />
```

### MermaidDiagram (`src/components/ui/MermaidDiagram.tsx`)

Renders Mermaid syntax (sequence, state, ER, Gantt, pie) with theme-aware variables.

**Dependencies:** `mermaid` (lazy-loaded)

**Theme integration:** Reads CSS custom properties at render time via `getComputedStyle()`:
- `--color-surface`, `--color-text-main`, `--color-text-secondary`
- `--color-border-strong`, `--color-bg`, `--color-accent`

**Supported diagram types:**
- Sequence diagrams
- State diagrams
- Class / ER diagrams
- Gantt charts
- Pie charts

**Usage:**
```tsx
<MermaidDiagram chart={`
sequenceDiagram
  participant V as VASP
  participant R as Regulator
  V->>R: Submit License Application
  R-->>V: License Approved
`} />
```

---

## CSS Architecture

All diagram styles are in `src/styles/app.css`:

- **Lines 8949–9572:** `.st-mermaid` styles (Mermaid diagrams)
  - Container, typography, nodes, edges, subgraphs
  - Semantic node variants (approved, rejected, active, etc.)
  - Sequence, state, class, Gantt, pie diagram specifics
  - Callout context overrides
  - Print styles
- **Lines 9574–9797:** `.st-flow-diagram` + `.st-diagram-node` styles (React Flow)
  - Container, edge paths, arrowheads
  - Node base, shapes (diamond, round)
  - Semantic status variants

All colors use design tokens (`var(--color-*)`) — fully theme-aware.

---

## Demo Scenarios (for future `/ui` integration)

### 1. VASP Licensing Flow
```
graph TD
  A[VASP Application]:::active -->|Submit| B{Regulator Review}
  B -->|Approved| C[License Granted]:::approved
  B -->|Rejected| D[Appeal Process]:::rejected
  B -->|Incomplete| E[Request More Info]:::pending
  E -->|Resubmit| B
  C --> F[Operational]:::approved
  D -->|Upheld| C
  D -->|Denied| G[Application Closed]:::rejected
```

### 2. Display Nodes (Key Statistics)
```
graph LR
  A[847 VASPs Registered]:::display --> B[142 Jurisdictions]:::display
  B --> C[23 Pending Reviews]:::pending
```

### 3. Travel Rule Flow (inside Callout)
```
graph LR
  A[Originator VASP]:::active -->|Transfer + Data| B[Beneficiary VASP]:::active
  B -->|Confirm Receipt| A
  A -.->|Report| C[Regulator]:::muted
  B -.->|Report| D[Regulator]:::muted
```

### 4. CBDC Architecture (inside Callout)
```
graph TB
  CB[Central Bank]:::info -->|Issue CBDC| T1[Tier 1: Banks]:::active
  CB -->|Monetary Policy| T1
  T1 -->|Distribute| T2[Tier 2: Payment Providers]
  T2 -->|Wallets| U[End Users]
  U -->|P2P Transfer| U
  U -->|Payments| M[Merchants]
```

### 5. Sequence Diagram (VASP Licensing)
```
sequenceDiagram
  participant V as VASP
  participant R as Regulator
  participant F as FATF
  V->>R: Submit License Application
  R->>R: AML/KYC Review
  Note over R: Risk Assessment
  R-->>V: Request Additional Docs
  V->>R: Provide Documents
  R->>F: Report Compliance Status
  Note over F: Mutual Evaluation
  F-->>R: Assessment Complete
  R->>V: License Approved
```

---

## Roadmap

### Phase 1 — Stabilize (current)
- [x] FlowDiagram component with dagre layout
- [x] MermaidDiagram with theme-aware rendering
- [x] Semantic node classes (10 variants)
- [x] CSS for all Mermaid diagram types
- [x] Callout integration (diagrams inside Callout blocks)
- [ ] Fix FlowDiagram tests (mock @xyflow/react in jsdom)
- [ ] Fix Mermaid re-render flicker on theme switch

### Phase 2 — Animations & Interactions
- [ ] Animated edge flow (dashed line animation for "in progress" paths)
- [ ] Node hover states with info tooltips
- [ ] Click-to-highlight path tracing
- [ ] Animated transitions between diagram states (e.g. status changes)
- [ ] Loading skeleton for async diagram rendering

### Phase 3 — Data Visualizations
- [ ] Theme-aware chart components (bar, line, donut)
- [ ] Map overlay graphics (heatmaps, flow arrows between countries)
- [ ] Canvas-based timeline visualization
- [ ] Interactive comparison charts

### Phase 4 — Advanced Graphics
- [ ] Animated infographic blocks for reports
- [ ] SVG icon animation system (micro-interactions)
- [ ] Scroll-triggered reveal animations
- [ ] Print-optimized static fallbacks for all animated elements

---

## Known Issues

1. **WebGL context exhaustion:** Repeated HMR reloads with MapLibre + React Flow can exhaust
   browser WebGL contexts. Solution: close and restart Chrome, or use Safari for development.
2. **Mermaid v10+ foreignObject labels:** Require `securityLevel: 'loose'` and CSS overrides
   targeting `foreignObject div` to apply custom fonts.
3. **React Flow + HMR:** Hot reload can cause stale dagre layouts. Full page refresh recommended
   after structural changes.
4. **Parallel agent interference:** Do NOT edit diagram components while other agents
   modify `DesignSystemPage.tsx` or `app.css` — this has caused multiple breakages.
