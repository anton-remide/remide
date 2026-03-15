# Hard Work Framework — Protocol Specification

> **Version:** 1.0 | **Date:** 2026-03-14 | **Replaces:** A/B/C/D Adversarial Debate Protocol (PROC-002)
> **Decision:** PROC-005 | **Owner:** Anton

## Overview

A structured protocol for complex tasks that uses **parallel subagents** to generate genuinely adversarial perspectives. Each role runs as an independent AI instance via Cursor's Task tool — they never see each other's output, eliminating the echo chamber problem inherent in single-agent role-playing.

## When to Use

| Tier | Scope | Mode | Questions | Subagents | Cycles |
|------|-------|------|-----------|-----------|--------|
| 1 | Bug fixes, small tasks (< 30 min) | Skip | — | — | — |
| 2 | Features, plans (30 min – 1 day) | **Compact** | 5 | 2 (Lead + Critic) | 1–2 |
| 3 | Architecture, strategy, multi-session | **Full** | 10 | 3 (Lead + Critic + Lateral) | 3 |

### Trigger Keywords

Activate when the user says or the task involves:
- Russian: "давай подумаем", "глубокая работа", "архитектурное решение", "стратегия", "дизайн"
- English: "hard work", "deep work", "architecture decision", "strategic", "plan design", "design decision"
- Or: any task with significant trade-offs, multi-component impact, or irreversible consequences

---

## The 5 Phases

```
Phase 0: TASK SCAN       → Load context, map current vs desired state
Phase 1: DISCOVERY        → Ask strategic questions, challenge assumptions
Phase 2: ROLE CASTING     → Propose role candidates, user selects lineup
Phase 3: EXECUTION CYCLES → Parallel subagents debate, parent arbitrates
Phase 4: FINALIZATION     → Deliverable, decision log, killed alternatives
```

---

## Phase 0: Task Scan

**Goal:** Build internal context map before asking the user anything.

Steps:
1. Read `CLAUDE.md` — project rules, constraints, current mode
2. Read `project-decisions.md` — prior decisions that may constrain this one
3. Scan relevant source files (identify by task keywords)
4. Fetch Notion context if needed (KB tasks, Architecture Router, Current State)
5. Map: **current state** (what exists) vs **desired state** (what the task implies)

Output: Internal context map. Not shown to user unless requested. Used to inform Phase 1 questions — don't ask what the docs already answer.

---

## Phase 1: Discovery

**Goal:** Align on intent, constraints, and priorities before building anything.

### Question Design Rules

- **Count:** 10 questions (Full) or 5 questions (Compact)
- **Order:** Strategic → Tactical (big picture first, details last)
- **Challenge:** At least 2 questions must challenge the user's assumptions
- **Informed:** Questions must reference Phase 0 findings — show you did the homework
- **No redundancy:** Never ask what CLAUDE.md or Notion already answers
- **Presentation:** Use AskQuestion tool for structured multi-choice where appropriate

### Question Categories (pick from these)

1. **Goal clarity** — "What does success look like? What's the metric?"
2. **Constraint surfacing** — "What can't we change? What's non-negotiable?"
3. **Priority trade-off** — "If X and Y conflict, which wins?"
4. **Assumption challenge** — "You assume X — what if X is wrong?"
5. **Scope boundary** — "Is Z in scope or explicitly out?"
6. **User impact** — "How does the end user experience this change?"
7. **Reversibility** — "Can we undo this if it's wrong? At what cost?"
8. **Timeline** — "Is this needed now, or can it wait for better data?"
9. **Dependencies** — "What must exist before this works?"
10. **Alternative framing** — "What if we solved the underlying problem differently?"

Continue asking until the user confirms alignment. Do not proceed to Phase 2 until both sides agree on scope and constraints.

---

## Phase 2: Role Casting

**Goal:** Select the debate participants. User has final say.

### How It Works

For each **position** (Lead, Critic, and Lateral for Full mode), generate **2–3 candidate characters**:

```
POSITION: LEAD (builds the solution)

  A) [Name] — [Industry/Specialty]
     Lens: [what this role optimizes for]
     Primary Q: "[the one question this role keeps asking]"

  B) [Name] — [Industry/Specialty]
     Lens: [different optimization axis]
     Primary Q: "[different core question]"

  C) [Name] — [Industry/Specialty]
     Lens: [third axis, unexpected angle]
     Primary Q: "[third core question]"
```

### Candidate Generation Rules

1. **Derive from task context** — candidates must be relevant to the problem domain
2. **Meaningfully different** — candidates within a position must optimize for different things
3. **At least 1 unexpected** — per position, include one non-obvious angle
4. **Lateral = always outside** — Lateral candidates come from a completely different industry (game design, aviation, medicine, restaurant, insurance, military, logistics, etc.)
5. **Include Discovery context** — reference user's stated priorities from Phase 1

### Selection

Present via AskQuestion tool — one question per position, single-select. User picks one candidate per position. Selected candidates become the subagent roster.

### Compact Mode

2 positions only: Lead + Critic. No Lateral.

---

## Phase 3: Execution Cycles (Subagent-Powered)

**Goal:** Generate independent perspectives, synthesize, iterate with user feedback.

### Architecture

```
Parent Agent (Arbiter)
  │
  ├─ prepares context bundle
  │
  ├─ launches parallel subagents via Task tool:
  │   ├─ Subagent 1 (Lead)     ─┐
  │   ├─ Subagent 2 (Critic)    ├─ run in parallel, readonly: true
  │   └─ Subagent 3 (Lateral)  ─┘  (Compact: only 1 + 2)
  │
  ├─ receives 3 independent outputs
  │
  └─ synthesizes as Arbiter → presents to user
```

Each subagent is launched via:
```
Task(
  subagent_type: "generalPurpose",
  readonly: true,
  prompt: [context bundle + role re-statement + cycle instructions]
)
```

**Critical:** Subagents NEVER see each other's output. This is the anti-echo-chamber mechanism.

### Context Bundle (passed to each subagent)

Every subagent receives the same base context:

1. **Task description** — what we're solving
2. **Discovery answers** — user's priorities, constraints, success criteria from Phase 1
3. **Relevant code/architecture** — key files, current implementation
4. **Prior cycle feedback** — (cycles 2+) user's feedback as hard constraints

Plus their unique **role re-statement** (see templates below).

### Cycle Steps

Each cycle has 4 internal steps. The subagent performs all 4 and returns a structured output:

1. **Constraint Scan** — list all hard constraints (technical, business, user, timeline)
2. **Solution Build** — propose approach with rationale
3. **Stress-Test** — attack own proposal (Lead) / attack the problem (Critic) / reframe (Lateral)
4. **Verdict** — final position with confidence score

### Cycle Escalation

- **Cycle 1:** Broad exploration. Subagents have maximum freedom.
- **Cycle 2:** Narrowed by user feedback. Prior feedback = hard constraints.
- **Cycle 3:** Final refinement. Focus on weakest points from Cycle 2.

### Arbiter Synthesis (parent agent, after each cycle)

After receiving all subagent outputs:

1. **Compare positions** — where do they agree? Where do they diverge?
2. **Identify strongest arguments** — from each role
3. **Resolve conflicts** — for each divergence: state thesis, Lead's view, Critic's view, Lateral's view (if Full), arbiter decision + confidence %
4. **Produce cycle output:**
   - Proposed solution (synthesized)
   - Unresolved tensions
   - Confidence score (weighted average)
   - Weakest point (what needs user input most)

5. **Present to user** → collect feedback → next cycle

### Between Cycles

User feedback handling:
- **"This is wrong"** → becomes hard constraint: "MUST NOT [what user rejected]"
- **"I prefer X"** → becomes hard constraint: "MUST use [X]"
- **"What about Y?"** → becomes new context for all subagents
- **All feedback listed verbatim** in next cycle's context bundle

### When to Stop

- User says "good enough" / "go" / "implement"
- All cycle outputs converge (no new tensions)
- Confidence > 80% on all decision points
- Maximum cycles reached (2 for Compact, 3 for Full)

---

## Phase 4: Finalization

**Goal:** Package the decision and log it permanently.

### Deliverables

1. **Final proposal** — the synthesized solution with implementation plan
2. **Decision log entry** — structured for Notion KB (Type: Decision):
   - Context: why this decision was needed
   - Alternatives considered: what was rejected and why (from Critic's attacks)
   - Decision: what was chosen and why
   - Confidence: final % with validation steps
   - Impact: files, systems, processes affected
3. **Killed alternatives** — each rejected approach with the reason it lost
4. **Open items** — unresolved questions, follow-up tasks
5. **Implementation checklist** — ordered steps to execute

### Logging

- Create Notion KB entry (Type: Decision) with full notes
- Append to `project-decisions.md` as cache
- Update `CLAUDE.md` if the decision changes tech stack, architecture, or process

---

## Re-Statement Templates

These are embedded in each subagent's prompt. They prevent role drift by reinforcing identity at the start of every call.

### Lead Re-Statement

```
You are [Name], a [Specialty].
Your goal: build the strongest possible solution for this task.
Optimize for: [lens from Role Casting].
Your primary question: "[primary question from Role Casting]"

RULES:
- Propose a concrete, implementable solution — not abstract principles.
- Include trade-offs you're consciously accepting.
- Do NOT hedge by pre-emptively addressing risks — that's the Critic's job.
- Your output: Constraints → Solution → Self-stress-test → Verdict with confidence %.
```

### Critic Re-Statement

```
You are [Name], a [Specialty].
Your ONLY job: find fundamental reasons this approach could fail.
Optimize for: [lens from Role Casting].
Your primary question: "[primary question from Role Casting]"

RULES:
- Find at least 3 FUNDAMENTAL flaws — not cosmetic issues or polish suggestions.
- Each flaw must include: what goes wrong, when it manifests, how severe (1-10).
- Do NOT propose solutions. Do NOT soften your critique.
- If the approach is genuinely strong, explain why — don't invent fake risks.
- Your output: Constraints → Attack vectors → Stress-test → Verdict with confidence %.
```

### Lateral Re-Statement

```
You are [Name] from [industry/domain outside the task domain].
You have deep expertise in [lateral domain] but know NOTHING about [task domain].
Evaluate this problem through the lens of: [analogy from Role Casting].
Your primary question: "[primary question from Role Casting]"

RULES:
- DO NOT try to learn the task domain. Stay in your domain.
- Map the problem to patterns you know from [lateral domain].
- What would [lateral domain] professionals do with this kind of problem?
- Bring at least 2 patterns/anti-patterns from your domain that apply here.
- Your output: Domain mapping → Patterns that apply → Reframe → Verdict with confidence %.
```

---

## Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Premature Build** | Jumping to Phase 3 without completing Discovery | Stop. Go back to Phase 1. Missing context = wrong solution. |
| **Echo Chamber** | All subagents agree on everything | Check re-statements. Critic must find ≥3 flaws. If genuine agreement, document why. |
| **Feedback Ignore** | Cycle N+1 doesn't incorporate user's Cycle N feedback | List user feedback as verbatim hard constraints in context bundle. |
| **Role Drift** | Critic starts proposing solutions. Lead starts hedging. | Re-read re-statement templates. Each role has explicit rules about what NOT to do. |
| **Scope Creep** | Scope grows between cycles with no user approval | Each cycle starts by confirming scope hasn't changed. New scope = restart Discovery. |
| **Premature Consensus** | Arbiter resolves tensions without surfacing them to user | Arbiter MUST list all divergences before resolving. User sees the conflict. |

---

## Compact Mode Reference

For Tier 2 tasks that need structure but not full debate.

| Aspect | Compact | Full |
|---|---|---|
| Questions | 5 | 10 |
| Positions | 2 (Lead + Critic) | 3 (Lead + Critic + Lateral) |
| Candidates per position | 2–3 | 2–3 |
| Subagents per cycle | 2 | 3 |
| Max cycles | 2 | 3 |
| Lateral role | Skipped | Mandatory |
| Finalization | Decision log only | Full package |

### When Compact is Enough

- Clear constraints, limited trade-offs
- Single-component feature (doesn't cross architectural boundaries)
- User has strong opinion on direction (validation mode, not exploration)
- Time-boxed: decision needed within the session

### When to Escalate to Full

- Compact Cycle 1 reveals unexpected complexity
- Confidence stays below 70% after Cycle 1
- User says "this needs more thought"
- Decision is irreversible or affects multiple systems

---

## Confidence Thresholds

| Range | Action |
|---|---|
| **> 80%** | Go. Implement the decision. |
| **60–80%** | Clarify with user. Add data. Run another cycle. |
| **< 60%** | Stop. Need more research, user input, or alternative framing. |

Confidence is calculated per decision point by the Arbiter, based on:
- Degree of agreement between subagents
- Strength of Critic's unresolved attacks
- User feedback alignment
- Precedent from prior decisions (project-decisions.md)

---

## Implementation Notes for Cursor

### Task Tool Configuration

```
Task(
  description: "Hard Work — [Role Name] — Cycle [N]",
  subagent_type: "generalPurpose",
  readonly: true,
  prompt: "[context bundle + re-statement + cycle instructions]"
)
```

- Launch all subagents in a **single message** (parallel execution)
- Maximum 3 subagents per cycle (Cursor limit: 4, reserve 1 for safety)
- Use `readonly: true` — subagents think, they don't edit files
- Parent agent acts as Arbiter — synthesizes results in the main chat

### AskQuestion Tool for Role Casting

```
AskQuestion(
  title: "Hard Work — Role Casting",
  questions: [
    { id: "lead", prompt: "Select LEAD role:", options: [...] },
    { id: "critic", prompt: "Select CRITIC role:", options: [...] },
    { id: "lateral", prompt: "Select LATERAL role:", options: [...] }
  ]
)
```

### State Between Cycles

The parent agent maintains state in the conversation context:
- Discovery answers
- Selected roles with re-statements
- Each cycle's synthesized output
- User feedback between cycles
- Running confidence scores

No external state file needed — the conversation IS the state.
