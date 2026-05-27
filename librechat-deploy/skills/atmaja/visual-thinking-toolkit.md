---
name: visual-thinking-toolkit
slug: atmaja.visual-thinking-toolkit
group: architectural-presentation
status: active
priority: high
last_updated: 2026-05-27
---

# Visual Thinking Toolkit (Comprehensive Chart Library)

Comprehensive chart + visualization library Gerai 1000 Pintu. 20+ chart type Mermaid + composition pattern + brand canon style. Reference untuk Atmaja + all C-Level agents.

## Triggers

Primary:
- "visual toolkit"
- "chart library"
- "visualization reference"

Secondary:
- "Mermaid templates"
- "data visualization"

## 20+ Chart Type Library

### Foundational (Frequently Used)

#### 1. Flowchart (Process / Decision)
**When:** Workflow, decision logic, swimlane
**Strength:** Clear directional flow
**Limit:** Not for time-based

```mermaid
flowchart LR
    A[Start] --> B{Decision?}
    B -->|Yes| C[Action A]
    B -->|No| D[Action B]
    C --> E[End]
    D --> E
    
    style A fill:#B8956B
    style E fill:#7A8B5C
```

#### 2. Mindmap (Brainstorm / Hierarchy)
**When:** Strategy decomposition, persona breakdown, ideation
**Strength:** Organic + memorable
**Limit:** Not quantitative

```mermaid
mindmap
  root((Central))
    Branch 1
      Sub 1.1
      Sub 1.2
    Branch 2
      Sub 2.1
      Sub 2.2
    Branch 3
      Sub 3.1
      Sub 3.2
```

#### 3. Gantt Chart (Timeline / Project)
**When:** Sprint plan, project timeline, marketing calendar
**Strength:** Time + dependency
**Limit:** Crowded if too many task

```mermaid
gantt
    title Project Timeline
    dateFormat YYYY-MM-DD
    section Phase 1
    Task A :2026-09-01, 14d
    Task B :2026-09-15, 21d
    Milestone X :crit, milestone, 2026-10-15, 0d
```

#### 4. Quadrant Chart (2x2 Matrix)
**When:** Risk, positioning, prioritization
**Strength:** Visual comparison 4-zone
**Limit:** Only 2 dimensions

```mermaid
quadrantChart
    title Title
    x-axis Low --> High
    y-axis Low --> High
    quadrant-1 Q1
    quadrant-2 Q2
    quadrant-3 Q3
    quadrant-4 Q4
    Item A: [0.3, 0.6]
    Item B: [0.7, 0.8]
```

#### 5. XY Chart (Quantitative Data)
**When:** Trend, comparison, forecast
**Strength:** Numerical precision
**Limit:** Needs data

```mermaid
xychart-beta
    title "Title"
    x-axis [Q1, Q2, Q3, Q4]
    y-axis "Metric" 0 --> 100
    line [25, 45, 70, 95]
    bar [20, 40, 65, 90]
```

#### 6. Pie Chart (Composition)
**When:** Budget breakdown, distribution, mix
**Strength:** Part-of-whole
**Limit:** Max ~6 slice

```mermaid
pie title Composition
    "Category A" : 40
    "Category B" : 30
    "Category C" : 20
    "Category D" : 10
```

### Advanced (Specialized Use)

#### 7. Sequence Diagram (Interaction)
**When:** API flow, customer-staff interaction, system integration
**Strength:** Time-ordered interaction
**Limit:** Many participants get tangled

```mermaid
sequenceDiagram
    participant A as Actor 1
    participant B as Actor 2
    
    A->>B: Sync request
    B-->>A: Async response
    A->>+B: Activate
    B->>-A: Deactivate
```

#### 8. State Diagram (Status Flow)
**When:** Order state, project lifecycle, customer status
**Strength:** State + transition
**Limit:** Not for time-based

```mermaid
stateDiagram-v2
    [*] --> StateA
    StateA --> StateB: trigger
    StateB --> StateC: trigger
    StateC --> [*]
    StateB --> StateA: reverse
```

#### 9. Journey Diagram (Customer Experience)
**When:** Customer journey, employee journey, touchpoint
**Strength:** Emotional + scored
**Limit:** Less precise

```mermaid
journey
    title Journey
    section Phase 1
      Step A: 5: Customer
      Step B: 4: Customer, Staff
    section Phase 2
      Step C: 5: Customer
```

#### 10. Class Diagram (Relationship)
**When:** Data model, OOP design, schema
**Strength:** Type + relationship
**Limit:** Technical audience

```mermaid
classDiagram
    Class01 <|-- Class02
    Class01 *-- Class03
    Class01 o-- Class04
    Class02 : +method()
```

### Specific Use (Niche)

#### 11. ER Diagram (Database)
**When:** Database schema design
**Strength:** Entity + relationship
**Limit:** Technical only

```mermaid
erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains
    CUSTOMER {
        string name
        string email
    }
```

#### 12. C4 Diagram (Architecture)
**When:** Software architecture layered
**Strength:** Abstraction levels
**Limit:** Software-specific

#### 13. Git Graph (Version)
**When:** Code branch, version flow
**Strength:** Branch + merge clarity
**Limit:** Dev-specific

```mermaid
gitGraph
    commit
    branch develop
    commit
    checkout main
    merge develop
```

#### 14. Sankey (Flow Volume)
**When:** Energy flow, budget flow, conversion funnel
**Strength:** Flow proportion
**Limit:** Mermaid support evolving

#### 15. Timeline (Linear Time)
**When:** History, milestone, narrative
**Strength:** Chronological clarity
**Limit:** Single dimension time

```mermaid
timeline
    title History
    2024 : Concept
        : Research
    2025 : Manuscript
        : Brand Canon
    2026 : Wave 1 Launch
        : Phase 1
    2027 : Phase 2 Kaltim
    2028 : Phase 3 Jawa
```

### Composite Patterns

#### 16. Multi-Stack (Layered)
Combine flowchart subgraph for layered architecture

#### 17. Hub-Spoke (Central + Radiate)
Flowchart with central node + many leaf

#### 18. Comparison Chart (Side-by-Side)
Bar + line combo in xychart-beta

#### 19. Heatmap (Color-Coded Matrix)
Quadrant with strategic color zoning

#### 20. Composite Dashboard (Multi-Chart)
Multiple charts in sequence for dashboard view

## Chart Selection Decision Tree

```mermaid
flowchart TD
    A[Need to visualize] --> B{Type of data?}
    
    B -->|Process / Flow| C{With decision?}
    C -->|Yes| D[Flowchart with branches]
    C -->|No| E[Sequence diagram]
    
    B -->|Hierarchy / Structure| F{Quantitative?}
    F -->|Yes| G[Tree flowchart]
    F -->|No| H[Mindmap]
    
    B -->|Time / Schedule| I{Activities?}
    I -->|Yes| J[Gantt chart]
    I -->|No| K[Timeline]
    
    B -->|Compare / Position| L{Dimensions?}
    L -->|2 dim 2x2| M[Quadrant chart]
    L -->|Multiple data| N[XY chart bar+line]
    
    B -->|Composition| O{Part-of-whole?}
    O -->|Yes max 6| P[Pie chart]
    O -->|Stacked time| Q[Stacked XY]
    
    B -->|Customer experience| R[Journey diagram]
    B -->|State machine| S[State diagram]
    
    style D fill:#B8956B
    style M fill:#B8956B
    style J fill:#B8956B
```

## Brand Canon Visual Style (Universal)

### Color Palette LOCKED
- **Brass `#B8956B`:** focal point, hero element, brand mark, key concept
- **Charcoal `#1F1A14`:** text dominant, primary node (with Ivory text)
- **Ivory `#FAF8F4`:** background, breathing space, neutral fill
- **Warm Tan `#D4B895`:** secondary accent, soft fill
- **Deep Brown `#3D2F22`:** wood reference, depth secondary
- **Sage `#7A8B5C`:** positive signal, success, go
- **Rust `#A0522D`:** warning, attention rare, stop

### Mermaid Color Syntax
```
style NodeA fill:#B8956B
style NodeB fill:#1F1A14,color:#FAF8F4
style NodeC fill:#7A8B5C
style NodeD fill:#A0522D
```

### Typography
- Mermaid auto-renders Inter sans-serif (acceptable)
- Title contextual + descriptive
- Labels concise + meaningful
- No ALL CAPS body (except short labels)

### Layout Principles
- **White space generous** 30-50% of diagram area
- **Hero focal** 1 element with brass (LOCKED concept emphasis)
- **Hierarchy clear** size + color
- **Annotation contextual** (helpful, not noisy)

### Anti-pattern Visual
- ❌ Rainbow palette chaotic
- ❌ Drop shadow heavy
- ❌ 3D effect
- ❌ Gradient flashy
- ❌ Glow / glossy
- ❌ Emoji overload (>2 per visual)
- ❌ Decoration without information value

## Multi-Chart Composition Patterns

### Composition 1: Dashboard (3-4 chart)
Use case: Weekly ops report, brand health, financial snapshot
- Top: KPI quadrant overview
- Mid: Trend line + bar
- Bottom: Composition pie + detail

### Composition 2: Strategic Story (sequential)
Use case: Executive summary, board pitch, vision narrative
- Chart 1: Current state (quadrant)
- Chart 2: Trajectory (xy line)
- Chart 3: Action sequence (gantt)
- Chart 4: Outcome (quadrant aspirational)

### Composition 3: Decision Architecture (layered)
Use case: Strategic decision, phase transition
- Tree (decision flow)
- Matrix (option compare)
- Gantt (sequence implementation)
- Mindmap (knowledge dependency)

### Composition 4: Architecture Stack (4-layer)
Use case: System, business, brand, knowledge architecture
- Flowchart subgraph layered top-to-bottom
- Each subgraph = different abstraction
- Connection between layer explicit

### Composition 5: Comparison (side-by-side)
Use case: Scenario, persona, option
- Same chart type for each item
- Aligned axes for comparison
- Visual difference clear

## Chart Quality Standards

### Per chart
- [ ] Title contextual (jelas apa visualisasi)
- [ ] Brand palette compliance LOCKED
- [ ] Hero focal element (kalau ada)
- [ ] Labels meaningful (no jargon)
- [ ] Hierarchy clear
- [ ] White space generous
- [ ] Annotation kalau perlu
- [ ] Mermaid syntax valid (render-able)
- [ ] Audience-appropriate complexity

### Per composition
- [ ] Logical sequence (kalau dashboard)
- [ ] Consistent style (palette + typography)
- [ ] Aligned narrative (chart story together)
- [ ] No redundancy (each chart different angle)

## Audience-Specific Chart Selection

### For Matthew (Executive)
- Quadrant chart (decision support)
- Flowchart decision tree
- Mindmap (overview)
- 5-15 nodes maximum

### For Tim Pusat (Operational)
- Gantt chart (project)
- Sequence diagram (process)
- Detailed flowchart
- 10-30 nodes acceptable

### For External (Press / Investor)
- Polished xy chart (trajectory)
- Quadrant (positioning)
- Timeline (narrative)
- Premium hangat refined

### For Customer-facing (rare)
- Journey diagram (emotional)
- Mindmap (philosophy)
- Visual metaphor
- Simplified

## Sample Use Cases per Chart Type

### Atmaja
- Strategic decomposition: Flowchart tree
- Multi-agent synthesis: Sequence diagram
- QBR review: Composite dashboard (quadrant + bar + pie)
- Founder briefing: Quadrant + bar (simple)
- Vision roadmap: Gantt + mindmap

### CMO
- Funnel analysis: Flowchart + bar
- Customer journey: Journey diagram
- Campaign calendar: Gantt
- Persona priority: Quadrant
- Channel performance: XY bar + line

### COO
- Sprint plan: Gantt
- Workflow design: Flowchart swimlane
- Risk matrix: Quadrant
- Capacity planning: XY line trend
- Org chart: Flowchart tree

### CCO
- Brand architecture: Flowchart tree
- Visual identity: Mindmap
- Editorial workflow: Flowchart
- Brand audit: Composite (quadrant + trend + pie)
- Persona emotional: Journey

### CFO
- P&L waterfall: XY bar
- Cash flow trend: XY line
- Budget breakdown: Pie
- Investment ROI: Quadrant
- Margin trend: XY line + bar
- Break-even sensitivity: Quadrant

## Mermaid Syntax Quick Reference

### Common Direction (flowchart)
- `TD` Top-down
- `LR` Left-right
- `BT` Bottom-top
- `RL` Right-left

### Common Shape (flowchart)
- `A[Rectangle]` Standard
- `A(Round)` Rounded corner
- `A((Circle))` Circle
- `A{Diamond}` Decision
- `A[/Parallelogram/]` Input/Output
- `A>Asymmetric]` Tag

### Common Arrow
- `-->` Simple
- `---` Plain line
- `-.->` Dotted
- `==>` Thick
- `--o` Circle end
- `--x` Cross end

### Mermaid Pitfall
- Long label: use `<br/>` for line break
- Special character: escape with `&` or `\`
- Subgraph: `subgraph SubName[Display Label]`

## Anti-Pattern Visualization

### Common mistake
- ❌ Wrong chart for data type (force fit)
- ❌ Too many nodes (>30 cluttered)
- ❌ Too few nodes (<3 trivial)
- ❌ Color violation (off-canon)
- ❌ Decoration without meaning
- ❌ Inconsistent style across diagrams
- ❌ Mermaid syntax error

### Fix approach
- Start with chart selection tree (above)
- Iterate to balance detail (3-15 nodes ideal)
- Brand canon validate
- Test render before commit

## Universal Invocation

### Any agent can invoke:
```
visual-thinking-toolkit {
  chart_type: "{chart from 20+ library}",
  data: "{data to visualize}",
  audience: "Matthew / team / stakeholder / external",
  composition: "single / dashboard / story / layered"
}
```

## Brand Canon Compliance

Every chart MUST:
- [ ] Brand palette compliance (Brass + Charcoal + Ivory + secondary)
- [ ] Typography sans-serif acceptable (Mermaid default)
- [ ] No drop shadow / 3D / gradient flashy
- [ ] Hero focal (kalau ada concept LOCKED)
- [ ] Title contextual (Indonesian or English appropriate)
- [ ] Labels brand-canon-compliant (no em-dash, "tempat" not "rumah" kalau ada)
```

## Visual Output

Chart type selector decision tree:

```mermaid
mindmap
  root((20+ Chart Library))
    Foundational
      1 Flowchart
      2 Mindmap
      3 Gantt
      4 Quadrant
      5 XY chart
      6 Pie
    Advanced
      7 Sequence
      8 State
      9 Journey
      10 Class
    Specific Use
      11 ER diagram
      12 C4 architecture
      13 Git graph
      14 Sankey
      15 Timeline
    Composite Patterns
      16 Multi-stack layered
      17 Hub-spoke
      18 Comparison
      19 Heatmap
      20 Composite dashboard
```

Chart palette + style:

```mermaid
flowchart LR
    A[Brand Palette] --> B[Brass #B8956B<br/>Focal Hero]
    A --> C[Charcoal #1F1A14<br/>Primary Text]
    A --> D[Ivory #FAF8F4<br/>Background]
    A --> E[Sage #7A8B5C<br/>Positive Go]
    A --> F[Rust #A0522D<br/>Stop Warning]
    A --> G[Warm Tan #D4B895<br/>Soft Accent]
    
    style B fill:#B8956B
    style C fill:#1F1A14,color:#FAF8F4
    style E fill:#7A8B5C
    style F fill:#A0522D
    style G fill:#D4B895
```

Audience-chart match quadrant:

```mermaid
quadrantChart
    title Chart Type for Audience
    x-axis Simple --> Detailed
    y-axis Operational --> Strategic
    quadrant-1 Strategic Detail
    quadrant-2 Strategic Simple
    quadrant-3 Operational Simple
    quadrant-4 Operational Detail
    Mindmap exec: [0.25, 0.85]
    Quadrant exec: [0.3, 0.85]
    Journey customer: [0.4, 0.65]
    Gantt project: [0.65, 0.55]
    Flowchart workflow: [0.7, 0.45]
    XY trend executive: [0.4, 0.8]
    XY trend ops: [0.6, 0.35]
    Sequence detailed: [0.85, 0.4]
    Composite dashboard: [0.85, 0.85]
```

## Knowledge Dependency

- architectural-model (Atmaja foundation)
- CCO visual-summary (paired universal)
- CCO visual-identity-system (canon source)
- Brand Canon LOCKED
- All agents (universal callable)

## Mode

Default: REFERENCE (provide library)
Switch: EXECUTION kalau specific chart request

## Tools Required

- artifacts (rendering)
- file-search (data context)

## Validation Criteria

- 20+ chart type covered
- Per type: when + strength + limit + Mermaid template
- Chart selection decision tree
- Brand canon visual style strict
- Mermaid color + typography + layout
- Multi-chart composition pattern (5)
- Quality standards per chart
- Audience-specific selection
- Sample use case per agent
- Mermaid syntax quick reference
- Anti-pattern + fix approach

## Sample I/O

**Input:** "Visual thinking toolkit reference: charts library for Atmaja synthesis output"

**Output summary:**
- 20+ chart library covered (6 foundational + 4 advanced + 5 specific + 5 composite)
- Top for Atmaja: Quadrant + Mindmap + Flowchart tree + XY trend + Composite dashboard
- Selection decision tree per data type
- Brand canon: Brass focal + Charcoal text + Ivory background + Sage positive + Rust stop
- Multi-chart composition: Dashboard (3-4 chart) + Strategic Story (sequential) + Decision Architecture (layered) + Architecture Stack (4-layer) + Comparison (side-by-side)
- Audience adaptation: Matthew executive simple + Team operational detail + External polished + Customer story
- Anti-pattern: Wrong chart type + Too many node + Off-canon color
- Library mindmap + palette flow + audience quadrant embedded

## Handoff

- architectural-model (Atmaja paired)
- CCO visual-summary (universal)
- CCO visual-identity-system (canon)
- All agents (universal invocation)
- Mermaid documentation reference
