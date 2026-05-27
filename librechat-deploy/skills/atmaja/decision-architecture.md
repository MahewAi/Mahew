---
name: decision-architecture
slug: atmaja.decision-architecture
group: architectural-presentation
status: active
priority: high
last_updated: 2026-05-27
---

# Decision Architecture (Decision Tree + Logic Graph)

Build decision architecture Gerai 1000 Pintu: decision tree, dependency graph, prerequisite chain, decision sequence. Visualize decision logic untuk Matthew + team alignment.

## Triggers

Primary:
- "decision architecture"
- "decision tree"
- "decision logic"

Secondary:
- "dependency map"
- "decision sequence"

## Input Required

| Field | Type | Required | Default |
|---|---|---|---|
| decision_scope | string | yes | (single decision / decision sequence / portfolio) |
| visualization_type | enum | yes | (tree / graph / matrix / sequence) |
| audience | enum | no | (Matthew / team / stakeholder) |

## 6 Decision Architecture Patterns

### Pattern 1: Single Decision Tree (Branch Logic)
**Use:** One decision with multiple option + conditional branches

```mermaid
flowchart TD
    A[Decision: Cabang #2 Q3 2027 Launch?] --> B{Q2 Gate Review}
    
    B --> C{AMK supply scale-ready?}
    B --> D{Door Expert #2 hired + trained?}
    B --> E{Cash buffer >= Rp 200jt?}
    
    C -->|Yes| F[Continue to next]
    C -->|No| Z[DELAY to Q1 2028]
    
    D -->|Yes| F
    D -->|No| Z
    
    E -->|Yes| F
    E -->|No| Z
    
    F --> G{All 3 criteria met?}
    G -->|Yes| H[PROCEED Q3 2027 Launch]
    G -->|No| Z
    
    H --> I[Activate Phase 2 plan]
    Z --> J[Maintain Phase 1 + revisit Q3 2027]
    
    style H fill:#7A8B5C
    style Z fill:#A0522D
    style I fill:#B8956B
```

### Pattern 2: Decision Dependency Graph
**Use:** Multiple decisions where some depend on others

```mermaid
flowchart LR
    A[Wave 1 Launch<br/>Confirmed 14 Nov] --> B[Door Expert Workflow Validated]
    A --> C[Brand Canon Compliance Sustained]
    
    B --> D[Door Expert #2 Hiring Triggered]
    C --> D
    
    A --> E[Year 1 Revenue Trajectory Confirmed]
    E --> F[Phase 2 Capex Approved]
    
    D --> G[Cabang #2 Operational Ready]
    F --> G
    
    G --> H[Cabang #2 Samarinda Launch Q3 2027]
    
    H --> I[Cabang #3 Bontang Q1 2028]
    H --> J[Mitra Dagang Formal Program]
    
    I --> K[Phase 2 Validated]
    J --> K
    
    K --> L[Phase 3 Jawa Decision 2028]
    
    style A fill:#B8956B
    style H fill:#D4B895
    style L fill:#7A8B5C
```

### Pattern 3: Decision Matrix (Multi-Criteria)
**Use:** Compare multiple option across multiple criteria

```mermaid
quadrantChart
    title Decision Option Matrix
    x-axis Low Strategic Fit --> High Strategic Fit
    y-axis Low Financial Viability --> High Financial Viability
    quadrant-1 PROCEED Strong
    quadrant-2 Fit Issue Address
    quadrant-3 REJECT
    quadrant-4 Financial Tight Strategic
    Option A Proceed Q3 2027: [0.8, 0.75]
    Option B Delay Q1 2028: [0.65, 0.85]
    Option C Skip Samarinda: [0.3, 0.7]
    Option D Status quo Y1 only: [0.2, 0.95]
    Option E Aggressive 2 cabang Q3: [0.75, 0.35]
```

### Pattern 4: Decision Sequence (Time-Based)
**Use:** Sequence of decisions over time

```mermaid
gantt
    title Phase 2 Decision Sequence
    dateFormat YYYY-MM-DD
    section Year 1 Decisions
    Wave 1 Launch readiness :crit, milestone, 2026-11-01, 0d
    Door Expert #2 candidate pipeline :2027-01-01, 60d
    Phase 2 site shortlist Samarinda :2027-02-01, 60d
    section Q2 Gate Decisions
    Q2 Gate Review :crit, milestone, 2027-06-01, 0d
    AMK contract scale confirm :2027-04-01, 60d
    Door Expert #2 hire confirm :2027-05-01, 30d
    Cash buffer confirm :2027-05-15, 15d
    section Q3 Launch Decisions
    Cabang #2 launch decision :crit, milestone, 2027-08-01, 0d
    Marketing budget Samarinda :2027-07-01, 30d
    SOP replication final :2027-07-15, 30d
    section Year 2+ Decisions
    Cabang #3 Bontang go/no-go :crit, milestone, 2027-11-01, 0d
    Phase 3 Jawa exploration :2028-01-01, 180d
```

### Pattern 5: Decision Authority Map (RACI)
**Use:** Who decides what + how

```mermaid
flowchart TD
    A[Decision Categories]
    
    A --> B[Strategic + Major]
    A --> C[Cross-functional]
    A --> D[Functional]
    A --> E[Tactical]
    
    B --> B1[Matthew Direct]
    B --> B2[Examples: Phase transition + Major capex + Brand canon major]
    
    C --> C1[Atmaja synthesis + Matthew approve]
    C --> C2[Examples: Multi-agent decision + Cross-function]
    
    D --> D1[C-Level functional]
    D --> D2[Examples: Within budget + Within canon + Within scope]
    
    E --> E1[Door Expert + MA]
    E --> E2[Examples: Customer-facing + Konsultasi recommendation]
    
    style B1 fill:#B8956B
    style C1 fill:#D4B895
```

### Pattern 6: Decision Quality Funnel
**Use:** Filter decision quality from concept to execution

```mermaid
flowchart TD
    A[Decision Need Identified] --> B[Frame Question Precisely]
    B --> C[Strategic Decomposition MECE]
    C --> D[Multi-Agent Input C-Level]
    D --> E[Synthesis Atmaja]
    E --> F[Decision Framework Score]
    F --> G[Recommendation Matthew]
    G --> H{Matthew Approve?}
    
    H -->|Yes| I[ADR Documented]
    H -->|Refine| C
    H -->|Reject| J[Status Quo Continue]
    
    I --> K[Implementation Plan]
    K --> L[KPI Track + Monitor]
    L --> M[Review 30 90 Annual]
    
    style E fill:#B8956B
    style I fill:#7A8B5C
```

## Decision Tree Templates per Category

### Category 1: Phase Transition Decision
- Decision: When to launch Phase 2/3?
- Tree: Gate criteria branching → All met = Proceed / Any fail = Delay
- Owner: Matthew + Atmaja
- ADR mandatory

### Category 2: Hiring Decision
- Decision: Hire role X now?
- Tree: Capacity > 100% sustained + Budget approved + Pipeline ready → Hire / Else wait
- Owner: COO + Matthew

### Category 3: Vendor Decision
- Decision: New vendor onboard?
- Tree: Need confirmed + Alternative scarce + Cost favorable → Onboard / Else stick
- Owner: COO + CFO

### Category 4: Investment Decision
- Decision: Capex Rp X approval?
- Tree: ROI >= threshold + Strategic fit + Cash available → Approve / Else defer
- Owner: CFO + Matthew

### Category 5: Brand Decision
- Decision: Brand canon evolution?
- Tree: Forces compelling + Long-term alignment + Stakeholder buy-in → Evolve / Else maintain
- Owner: CCO + Matthew (LOCKED rare change)

### Category 6: Crisis Decision
- Decision: Activate which playbook P0/P1/P2?
- Tree: Severity + Time-pressure + Stakeholder impact → Tier appropriate
- Owner: Severity-dependent

## Decision Architecture Quality Standards

### Per decision tree
- [ ] Decision question precisely framed
- [ ] Branches mutually exclusive (no overlap)
- [ ] Branches collectively exhaustive (no gap)
- [ ] Outcome clear per path
- [ ] Terminal node = action / decision
- [ ] Color coded (Green proceed / Yellow conditional / Red stop)
- [ ] Brand canon palette compliance

### Per decision sequence
- [ ] Logical time ordering
- [ ] Dependency explicit
- [ ] Critical path identified
- [ ] Decision gate marked

### Per decision matrix
- [ ] Criteria weighted
- [ ] Options scored consistently
- [ ] Recommendation clear

## Decision Architecture Composition

### Multi-Layer Decision
Combine 2-3 patterns for complex decision:

**Layer 1:** Strategic decomposition (MECE tree)
**Layer 2:** Per dimension decision matrix
**Layer 3:** Sequence + dependency
**Layer 4:** Authority + RACI

### Example: Phase 2 Decision Combo

```mermaid
flowchart TD
    A[Phase 2 Cabang Expansion Decision] --> B[Layer 1: Decompose MECE]
    
    B --> C[Demand validated]
    B --> D[Operations ready]
    B --> E[Financial viable]
    B --> F[Brand consistent]
    
    C --> G[Layer 2: Score per criterion]
    D --> G
    E --> G
    F --> G
    
    G --> H[Layer 3: Sequence dependency]
    H --> I[Year 1 → Q2 gate → Q3 launch]
    
    I --> J[Layer 4: Authority RACI]
    J --> K[Matthew approve + Atmaja synthesis + C-Level execute]
    
    K --> L[Decision: PROCEED with conditions]
    
    style A fill:#B8956B
    style L fill:#7A8B5C
```

## Brand Canon Compliance (Decision Architecture)

### Visual
- Brass for proceed / hero
- Charcoal for primary nodes
- Sage for positive outcome
- Rust for stop / negative
- Ivory background generous

### Verbal
- Decision statement clear (no em-dash)
- Premium hangat tone in labels
- Direct + factual

### Anti-pattern
- ❌ Over-complex tree (>15 node confusing)
- ❌ Vague branches (subjective criteria)
- ❌ No terminal decision (just analysis)
- ❌ Color rainbow chaotic
- ❌ Bias toward predetermined outcome

## Sample Use Cases

### Atmaja invoke
- Strategic decomposition → Decision Tree
- Multi-agent synthesis → Dependency Graph
- Phase transition → Decision Sequence + Authority Map
- QBR review → Quality Funnel

### C-Level invoke
- CMO campaign decision → Tree pattern
- COO sprint priority → Sequence pattern
- CCO content strategy → Tree + Matrix combo
- CFO investment evaluation → Matrix + Quality Funnel

## Universal Invocation Pattern

```
decision-architecture {
  scope: "{decision context}",
  pattern: "tree / graph / matrix / sequence / authority / funnel",
  layer: "single / multi-layer combo",
  audience: "Matthew / team / stakeholder"
}
```

## Sample I/O

**Input:** "Decision architecture: Cabang #2 Samarinda go/no-go Q3 2027 dengan gate criteria + sequence"

**Output:**
- Pattern combo: Layer 1 Decision Tree (3 gate criteria) + Layer 2 Sequence (Q1-Q3 timeline) + Layer 3 Authority (Matthew + Atmaja)
- Tree branches: AMK supply scale + Door Expert #2 hired + Cash buffer Rp 200jt
- All 3 met → PROCEED Q3 launch
- Any fail → DELAY Q1 2028
- Sequence: Year 1 prep → Q2 gate review → Q3 decision → Q3-Q4 launch
- Authority: Matthew final + Atmaja synthesis + COO+CFO+CMO+CCO execute
- Brand canon: ✅ Brass focal + Sage positive + Rust delay
- 3-layer architecture rendered

## Knowledge Dependency

- decision-framework (paired Atmaja)
- delegation-matrix (authority)
- architectural-model (visual foundation)
- architectural-decision-record (output documentation)
- All C-Level skill (decision context)

## Mode

Default: EXECUTION
Switch: NEED_CLARIFICATION jika decision context ambigu

## Tools Required

- artifacts (Mermaid render)
- file-search (context retrieval)

## Validation Criteria

- 6 decision architecture pattern
- Per pattern: use case + Mermaid template + sample
- 6 decision category templates
- Quality standards per pattern
- Multi-layer composition
- Brand canon compliance
- Anti-pattern explicit
- Universal invocation

## Handoff

- decision-framework (paired)
- architectural-decision-record (document)
- architectural-model (visual foundation)
- All agents (universal invocation)
- Matthew (decision authority)
