/**
 * All diagram demo charts in one place.
 * Edit here — the /ui page picks them up automatically.
 * All diagrams render through Mermaid with unified visual style.
 */

export interface DiagramDemo {
  title: string;
  description?: string;
  chart: string;
}

// ── Flowcharts ─────────────────────────────────────────────────

export const flowchartDemos: DiagramDemo[] = [
  {
    title: 'VASP Licensing Process',
    description: 'Full licensing workflow with decision branches',
    chart: `graph TD
  A[VASP Application] -->|Submit| B[Regulator Review]
  B -->|Approved| C[License Granted]
  B -->|Rejected| D[Appeal Process]
  B -->|Incomplete| E[Request More Info]
  E -->|Resubmit| B
  C --> F[Operational]
  D -->|Upheld| C
  D -->|Denied| G[Application Closed]`,
  },
  {
    title: 'Key Statistics',
    description: 'Horizontal layout with stat callouts',
    chart: `graph LR
  A["847 VASPs Registered"] --> B["142 Jurisdictions"]
  B --> C["23 Pending Reviews"]`,
  },
  {
    title: 'Regulatory Status Variants',
    description: 'Status transition flow between regulatory states',
    chart: `graph LR
  A[Active License] --> B[Under Review]
  B --> C[Conditional Approval]
  B --> D[License Expired]
  B --> E[License Revoked]
  A --> F[Supplementary Info]`,
  },
];

// ── Sequence Diagrams ──────────────────────────────────────────

export const sequenceDemos: DiagramDemo[] = [
  {
    title: 'VASP Registration Flow',
    description: 'Actor interactions during the registration process',
    chart: `sequenceDiagram
  participant V as VASP
  participant R as Regulator
  participant D as Database
  V->>R: Submit Application
  R->>D: Store Application
  R-->>V: Acknowledge Receipt
  R->>R: Review Application
  alt Approved
    R->>D: Update Status
    R-->>V: License Granted
  else Rejected
    R-->>V: Rejection Notice
  end`,
  },
];

// ── Combined ──────────────────────────────────────────────────

export const allDiagramDemos = [...flowchartDemos, ...sequenceDemos];
