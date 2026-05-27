---
name: architectural-model
slug: atmaja.architectural-model
group: architectural-presentation
status: active
priority: high
last_updated: 2026-05-27
---

# Architectural Model (Universal Visualization Foundation)

Universal skill untuk render concept Gerai 1000 Pintu ke architectural model. Callable oleh setiap agent (Atmaja + CMO + COO + CCO + CFO) untuk menyajikan informasi secara visual architectural. Brand canon strict palette + typography.

## Triggers

Primary:
- "architectural model"
- "model arsitektur"
- "buat arsitektur"
- "render architectural"

Secondary:
- "sajikan arsitektural"
- "blueprint visual"
- "system diagram"

## Input Required

| Field | Type | Required | Default |
|---|---|---|---|
| concept | string | yes | (apa yang divisualisasi) |
| model_type | enum | yes | (12 type, refer below) |
| audience | enum | no | (Matthew / team / stakeholder / external) |
| detail_level | enum | no | (executive / detailed / deep) |

## 12 Architectural Model Types

### Type 1: System Architecture
**Best for:** Tech stack, AI Department, integration, infrastructure
**Mermaid:** `flowchart` dengan subgraph

```mermaid
flowchart TB
    subgraph Client[Customer-Facing Layer]
        A1[Showroom Cabang]
        A2[gerai.mahewwork.com]
        A3[WhatsApp Business]
        A4[Instagram + TikTok]
    end
    
    subgraph Middle[Service Layer]
        B1[Door Expert Konsultasi Zoom]
        B2[CRM Modul Retail]
        B3[Marketing Automation n8n]
        B4[AI Department Atmaja]
    end
    
    subgraph Data[Data + Knowledge Layer]
        C1[Customer Profile]
        C2[Konsultasi Log]
        C3[Brand Canon LOCKED]
        C4[Filosofi 4-Dunia]
    end
    
    subgraph Backend[Infrastructure]
        D1[Vercel Edge]
        D2[Anthropic Claude]
        D3[GitHub Repository]
        D4[Notion Workspace]
    end
    
    Client --> Middle
    Middle --> Data
    Middle --> Backend
    
    style B4 fill:#B8956B
    style C3 fill:#1F1A14,color:#FAF8F4
```

### Type 2: Business Architecture
**Best for:** Operating model, business unit, capability map

```mermaid
flowchart TD
    A[Gerai 1000 Pintu<br/>Master Brand 🔒] --> B[Customer-Facing]
    A --> C[Operations Backbone]
    A --> D[Strategic Capability]
    
    B --> B1[Cabang Showroom<br/>Lean Store 2-staf]
    B --> B2[Door Expert Remote<br/>Konsultasi Pod Zoom]
    B --> B3[Digital Touchpoint<br/>Web + Social + WA]
    
    C --> C1[Vendor + Supply<br/>AMK Premium anchor]
    C --> C2[Logistics<br/>Jakarta-Balikpapan]
    C --> C3[Aftersales<br/>Long-term relationship]
    
    D --> D1[Filosofi 4-Dunia<br/>Framework IP]
    D --> D2[Brand Canon<br/>LOCKED discipline]
    D --> D3[AI Department<br/>Atmaja + C-Level]
    
    style A fill:#B8956B
    style D2 fill:#1F1A14,color:#FAF8F4
```

### Type 3: Strategic Architecture (3-Horizon)
**Best for:** Vision phase, growth horizon, time-based strategy

```mermaid
quadrantChart
    title Strategic Architecture 3-Horizon
    x-axis Short-term --> Long-term
    y-axis Defensive --> Offensive
    quadrant-1 Horizon 3 Future Bet
    quadrant-2 Horizon 2 Emerging
    quadrant-3 Horizon 1 Core
    quadrant-4 Horizon 1 Optimize
    H1 Cabang Balikpapan: [0.2, 0.4]
    H1 Lean Store validate: [0.25, 0.45]
    H1 Brand canon enforce: [0.2, 0.55]
    H2 Cabang Samarinda: [0.5, 0.7]
    H2 Cabang Bontang: [0.55, 0.65]
    H2 Mitra Dagang formal: [0.5, 0.6]
    H3 Cabang Jawa: [0.8, 0.85]
    H3 Optional ASEAN: [0.9, 0.9]
    H3 IP licensing: [0.85, 0.75]
```

### Type 4: Decision Architecture
**Best for:** Decision flow, authority hierarchy, RACI

```mermaid
flowchart TD
    A[Decision Need Identified] --> B{Scope?}
    
    B -->|Strategic + Major| C[Matthew Direct]
    B -->|Cross-functional| D[Atmaja Orchestrator]
    B -->|Functional| E[C-Level Specific]
    B -->|Customer-facing tactical| F[Door Expert + MA]
    
    C --> G[1-4 week deliberation]
    D --> H[3-5 day synthesis]
    E --> I[1-3 day functional]
    F --> J[Real-time customer]
    
    G --> K[Decision documented<br/>Rationale archived]
    H --> K
    I --> K
    J --> K
    
    K --> L[Implementation + Monitor]
    L --> M[Post-decision Review<br/>Learning loop]
    
    style C fill:#B8956B
    style K fill:#7A8B5C
```

### Type 5: Data Architecture
**Best for:** Information flow, knowledge management, CRM data

```mermaid
flowchart LR
    subgraph Generate[Generate]
        A1[Walk-in interaction]
        A2[Konsultasi session]
        A3[Customer purchase]
        A4[Aftersales touch]
    end
    
    subgraph Capture[Capture + Tag]
        B1[CRM CRM Modul Retail]
        B2[Notion knowledge base]
        B3[Asset library Figma]
    end
    
    subgraph Synthesize[Synthesize]
        C1[Atmaja knowledge-orchestration]
        C2[Per persona insight]
        C3[Pattern recognition]
    end
    
    subgraph Apply[Apply + Decision]
        D1[Door Expert script update]
        D2[Marketing campaign]
        D3[Strategic decision]
    end
    
    Generate --> Capture
    Capture --> Synthesize
    Synthesize --> Apply
    Apply --> Generate
    
    style C1 fill:#B8956B
```

### Type 6: Process Architecture (Swimlane)
**Best for:** Cross-functional workflow, customer journey, handoff

```mermaid
sequenceDiagram
    participant C as Customer
    participant MA as MA Cabang
    participant DE as Door Expert
    participant CRM as CRM System
    participant Matthew as Matthew/Atmaja
    
    C->>MA: Walk-in inquiry
    MA->>C: Welcome + tour
    MA->>CRM: Log lead + intent
    MA->>DE: Schedule konsultasi
    DE->>C: Zoom session 60 min
    DE->>CRM: Document konsultasi + recommendation
    C->>DE: Decision
    
    alt Decision: Purchase
        DE->>MA: Initiate order
        MA->>CRM: Order created
        MA->>C: Confirmation + payment
    else Decision: Pending
        DE->>CRM: Follow-up schedule
    end
    
    DE->>Matthew: Notable pattern (kalau ada)
```

### Type 7: Organizational Architecture (Org Chart)
**Best for:** Team structure, reporting line, role mapping

```mermaid
flowchart TD
    Matthew[Matthew Wijaya<br/>Founder + CEO + CTO]
    Atmaja[Atmaja<br/>AI CEO Orchestrator]
    
    Matthew --> Atmaja
    
    Atmaja --> CMO[CMO<br/>Marketing Agent]
    Atmaja --> COO[COO<br/>Operations Agent]
    Atmaja --> CCO[CCO<br/>Brand Agent]
    Atmaja --> CFO[CFO<br/>Financial Agent]
    
    COO --> DE[Door Expert<br/>5 Kompetensi]
    COO --> MA1[MA #1<br/>Cabang BPN]
    COO --> MA2[MA #2<br/>Cabang BPN]
    
    DE -.konsultasi.-> MA1
    DE -.konsultasi.-> MA2
    
    style Matthew fill:#B8956B
    style Atmaja fill:#D4B895
```

### Type 8: Brand Architecture
**Best for:** Master brand, product line, channel hierarchy

```mermaid
flowchart TD
    Master[Gerai 1000 Pintu<br/>Master Brand 🔒<br/>Aesop + DWR Anchor]
    
    Master --> Product[Product Line]
    Master --> Service[Service Line]
    Master --> Channel[Channel Layer]
    
    Product --> P1[AMK Premium<br/>Phase 1 anchor]
    Product --> P2[Selected Brand<br/>Phase 2 curated]
    Product --> P3[Gerai Signature<br/>Phase 3 evaluate]
    
    Service --> S1[Konsultasi Door Expert<br/>60 min Zoom]
    Service --> S2[Aftersales Premium<br/>Long-term]
    Service --> S3[Project Partnership<br/>Architect+Designer]
    
    Channel --> C1[Showroom Cabang]
    Channel --> C2[gerai.mahewwork.com]
    Channel --> C3[Social IG TikTok]
    Channel --> C4[WhatsApp Business]
    
    style Master fill:#B8956B
```

### Type 9: Capability Maturity Architecture
**Best for:** Skill maturity, capability assessment, gap analysis

```mermaid
quadrantChart
    title Capability Maturity Assessment
    x-axis Low Maturity --> High Maturity
    y-axis Low Importance --> High Importance
    quadrant-1 Invest Maintain
    quadrant-2 Critical Gap
    quadrant-3 Low Priority
    quadrant-4 Mature Optimize
    Door Expert konsultasi: [0.75, 0.95]
    Brand canon discipline: [0.9, 0.9]
    Lean Store operations: [0.8, 0.85]
    AI Department: [0.65, 0.85]
    Multi-cabang ops: [0.3, 0.75]
    Mitra Dagang network: [0.25, 0.7]
    Aftersales subscription: [0.2, 0.55]
    Architect partnership: [0.4, 0.8]
```

### Type 10: Customer Journey Architecture
**Best for:** Customer experience map, touchpoint, emotional arc

```mermaid
journey
    title Customer Journey Architecture
    section Awareness
      First touch IG/Web: 5: Customer
      Curiosity build: 6: Customer, Brand
    section Consideration
      Visit gerai.mahewwork.com: 7: Customer
      Read content 4-Dunia: 8: Customer, CCO
    section Booking
      WhatsApp inquiry: 8: Customer, MA
      Schedule konsultasi: 9: Customer, MA
    section Konsultasi
      Door Expert 60min Zoom: 10: Customer, Door Expert
      Education calm: 9: Customer, Door Expert
    section Decision
      Receive proposal: 9: Customer
      Sign + payment: 10: Customer, MA
    section Delivery
      Anticipation: 9: Customer
      Installation moment: 10: Customer, COO
    section Aftersales
      Day 7+30+90 check-in: 9: Customer, Door Expert
      Long-term advocate: 10: Customer, Brand
```

### Type 11: Risk Architecture
**Best for:** Risk portfolio, mitigation map, escalation

```mermaid
quadrantChart
    title Risk Portfolio Architecture
    x-axis Low Probability --> High Probability
    y-axis Low Impact --> High Impact
    quadrant-1 Critical Mitigate Now
    quadrant-2 High Watch
    quadrant-3 Low Acknowledge
    quadrant-4 Moderate Plan
    Door Expert burnout: [0.7, 0.75]
    Cash flow gap: [0.7, 0.75]
    AMK supply delay: [0.55, 0.95]
    Brand canon violation: [0.55, 0.5]
    Customer review viral: [0.55, 0.75]
    Showroom incident: [0.3, 0.95]
    Phase 2 capex tight: [0.5, 0.7]
    Talent scarcity: [0.4, 0.7]
```

### Type 12: Knowledge Architecture
**Best for:** Knowledge tier, learning map, IP hierarchy

```mermaid
mindmap
  root((Knowledge Architecture))
    Tier 1 LOCKED Founding
      Brand Canon
      Filosofi 4-Dunia
      5 Nilai Gerai
      Lean Store concept
    Tier 2 Function Knowledge
      CMO catalog 31 skill
      COO catalog 25 skill
      CCO catalog 23 skill
      CFO catalog 15 skill
      Atmaja catalog 20+ skill
    Tier 3 Operational
      SOP per function
      Vendor history
      Customer profile
      Project case study
    Tier 4 Tactical
      Daily ops log
      Customer interaction
      Quick reference
```

## Architectural Model Selection Decision

```mermaid
flowchart TD
    A[Concept to visualize] --> B{Type of concept?}
    
    B -->|System tech integration| C[Type 1 System Architecture]
    B -->|Operating model + capability| D[Type 2 Business Architecture]
    B -->|Time-based strategy| E[Type 3 Strategic 3-Horizon]
    B -->|Decision flow + authority| F[Type 4 Decision Architecture]
    B -->|Information + data flow| G[Type 5 Data Architecture]
    B -->|Cross-functional workflow| H[Type 6 Process Swimlane]
    B -->|Team + reporting line| I[Type 7 Organizational]
    B -->|Master brand + lines| J[Type 8 Brand Architecture]
    B -->|Capability maturity| K[Type 9 Maturity]
    B -->|Customer experience| L[Type 10 Journey]
    B -->|Risk portfolio| M[Type 11 Risk]
    B -->|Knowledge tier| N[Type 12 Knowledge]
    
    style C fill:#B8956B
```

## Brand Canon Visual Style (Architectural Diagrams)

### Color Palette LOCKED
- **Brass `#B8956B`:** focal point, hero element, primary node
- **Charcoal `#1F1A14`:** text dominant, depth nodes (with Ivory text)
- **Ivory `#FAF8F4`:** background, breathing space
- **Warm Tan `#D4B895`:** secondary accent
- **Sage `#7A8B5C`:** positive signal, success
- **Rust `#A0522D`:** warning, attention rare

### Typography
- **Display:** Playfair Display (kalau title kalau platform support)
- **Label:** Inter sans-serif (Mermaid default acceptable)
- **Mono:** for code reference (rare di architectural)

### Layout Principles
- **Generous white space** 30-50% diagram area
- **Hero focal** 1 element brass (LOCKED key concept)
- **Hierarchy clear** dengan size + color
- **Annotation contextual** (helpful, not noisy)

### Anti-pattern Visual
- ❌ Drop shadow (semua node)
- ❌ Gradient flashy
- ❌ Multi-color rainbow
- ❌ 3D effect
- ❌ Excessive emoji
- ❌ Decoration without meaning

## Multi-Model Composition Patterns

### Pattern 1: Vertical Stack (Layered)
- 4-5 layer stacked vertically
- Each layer = different abstraction
- Example: System architecture (Client → Service → Data → Infrastructure)

### Pattern 2: Hub & Spoke
- Central concept + radiating connections
- Example: Brand architecture (Master + product/service/channel)

### Pattern 3: Sequential Flow
- Linear progression left-to-right or top-to-bottom
- Example: Customer journey, decision flow

### Pattern 4: Quadrant Matrix
- 2x2 grid dengan x/y axis
- Example: Strategic 3-horizon, risk, maturity, capability

### Pattern 5: Tree Hierarchy
- Root + branching children
- Example: Organizational, knowledge, brand

### Pattern 6: Network Graph
- Multiple nodes + multi-directional connections
- Example: Stakeholder map, dependency network

## Audience Adaptation

### For Matthew (Executive)
- High-level overview
- Hero focal clear
- 1-page summary preferred
- Strategic implication visible
- 5-15 nodes maximum

### For Tim Pusat (Operational)
- Detail layer accessible
- Annotation helpful
- 10-30 nodes acceptable
- Action item per node kalau perlu

### For External (Press / Investor)
- Polished brand canon strict
- Aesop + DWR refined feel
- Premium hangat tone in labels
- Minimal noise

### For Customer-facing (rare)
- Simplified
- Story-driven
- Visual metaphor
- Filosofi 4-Dunia integration

## Architectural Model Quality Standards

### Per diagram
- [ ] Title contextual (jelas apa yang divisualisasi)
- [ ] Brand palette compliance LOCKED
- [ ] Hero focal 1 element
- [ ] Hierarchy clear
- [ ] White space generous
- [ ] Annotation kalau perlu
- [ ] Readable at intended size
- [ ] Mermaid syntax valid

### Composition
- [ ] Right model type for concept
- [ ] Appropriate detail level for audience
- [ ] No noise / unnecessary node
- [ ] Logical flow direction
- [ ] Color used meaningfully (not decoratively)

## Universal Invocation Pattern

### Any agent can invoke:
```
architectural-model {
  concept: "{what to visualize}",
  model_type: "type-1 through type-12",
  audience: "Matthew / team / stakeholder / external",
  detail_level: "executive / detailed / deep"
}
```

### Output format
- Mermaid block rendered directly
- Brief caption (1-2 sentence context)
- Reading instruction (kalau complex)
- Related skill links (kalau perlu)

## Sample Use Cases

### Atmaja invoke (synthesis)
- Strategic decomposition → Type 4 Decision Architecture
- Multi-agent synthesis → Type 5 Data Architecture (flow of inputs)
- Quarterly business review → Type 11 Risk + Type 9 Maturity

### CMO invoke
- Funnel analysis → Type 6 Process (lead journey)
- Customer journey → Type 10 Journey Architecture
- Campaign rollout → Type 6 Process Sequence

### COO invoke
- Workflow design → Type 6 Process Swimlane
- Lean Store operations → Type 2 Business Architecture
- Risk register → Type 11 Risk Architecture

### CCO invoke
- Brand architecture → Type 8 Brand Architecture
- Visual identity system → Type 5 Data (asset hierarchy)
- Content calendar → Type 6 Process (publishing flow)

### CFO invoke
- Cash flow → Type 5 Data Architecture (flow)
- Budget allocation → Type 8 Brand (categorical)
- ROI portfolio → Type 9 Capability Maturity

## Architectural Model Compositions (Multi-Type Combo)

### Combo 1: Strategic + Risk
Type 3 Strategic (horizon) + Type 11 Risk (overlay)
- Where strategy intersects risk
- Phase transition decision context

### Combo 2: Customer Journey + Process
Type 10 Customer Journey + Type 6 Process Swimlane
- Customer side + internal side simultaneous

### Combo 3: Org + Decision Authority
Type 7 Organizational + Type 4 Decision
- Who reports to whom + who decides what

### Combo 4: Brand + Data
Type 8 Brand Architecture + Type 5 Data Flow
- How brand element propagates through system

## Pitfall to Avoid

### Common mistake
- ❌ Wrong model type for concept (force fit)
- ❌ Too many node (>30 cluttered)
- ❌ Too few node (<3 trivial)
- ❌ Brand palette violation (off-canon color)
- ❌ Decoration without information value
- ❌ Inconsistent style across diagrams
- ❌ Mermaid syntax error (un-rendered)

### Fix approach
- Start with right model type (decision tree above)
- Iterate to balance detail (3-15 nodes ideal for clarity)
- Brand canon validate before publish
- Test render before commit
```

## Visual Output

Architectural model type selector:

```mermaid
mindmap
  root((12 Architectural Models))
    Technical
      Type 1 System Architecture
      Type 5 Data Architecture
    Business
      Type 2 Business Architecture
      Type 8 Brand Architecture
      Type 7 Organizational
    Strategic
      Type 3 Strategic 3-Horizon
      Type 4 Decision Architecture
      Type 9 Capability Maturity
    Operational
      Type 6 Process Swimlane
      Type 10 Customer Journey
    Risk Knowledge
      Type 11 Risk Architecture
      Type 12 Knowledge Architecture
```

Brand canon visual hierarchy:

```mermaid
flowchart LR
    A[Brass #B8956B<br/>Focal Hero] --> B[Charcoal #1F1A14<br/>Depth Text]
    B --> C[Ivory #FAF8F4<br/>Background]
    
    style A fill:#B8956B
    style B fill:#1F1A14,color:#FAF8F4
    style C fill:#FAF8F4,color:#1F1A14
```

Composition pattern:

```mermaid
quadrantChart
    title Architectural Composition Patterns
    x-axis Linear --> Network
    y-axis Simple --> Complex
    quadrant-1 Multi-Model Combo
    quadrant-2 Network Graph
    quadrant-3 Sequential Flow
    quadrant-4 Hierarchy Tree
    Sequential Flow: [0.2, 0.3]
    Vertical Stack: [0.25, 0.5]
    Quadrant Matrix: [0.3, 0.6]
    Tree Hierarchy: [0.5, 0.4]
    Hub & Spoke: [0.7, 0.5]
    Network Graph: [0.85, 0.8]
    Multi-Model Combo: [0.75, 0.9]
```

## Knowledge Dependency

- Brand Canon LOCKED (visual palette + typography)
- CCO visual-identity-system
- CCO visual-summary (paired universal)
- All C-Level skill (data input source)
- Mermaid syntax library

## Mode

Default: EXECUTION (generate architectural model immediately)
Switch: NEED_CLARIFICATION jika concept/type ambigu

## Tools Required

- artifacts (primary rendering)
- file-search (concept context)

## Validation Criteria

- 12 model type library
- Per type: best-for + Mermaid template + sample
- Brand canon visual style strict
- Multi-model composition patterns
- Audience adaptation
- Quality standards per diagram
- Universal invocation pattern
- Sample use case per agent
- Pitfall + fix approach

## Sample I/O

**Input:** "Architectural model: Lean Store operating model untuk Matthew executive view"

**Output:**
- Model type: Type 2 Business Architecture
- Detail level: Executive (5-10 nodes max)
- Brand canon: Brass on Master + Charcoal text + Ivory background
- Hero focal: "Gerai 1000 Pintu" master brand
- Branches: Customer-facing + Operations + Strategic Capability
- Annotation: "LOCKED" badge on Brand Canon + Lean Store concept
- Rendered Mermaid (refer Type 2 sample above)

## Handoff

- All agents (universal callable)
- architectural-decision-record (decision context)
- decision-architecture (decision logic detail)
- visual-thinking-toolkit (chart deep library)
- CCO visual-identity-system (canon source)
