# RemiDe — VASP & Crypto Registry Tracker

## What This Project Is
A public regulatory intelligence platform that tracks licensed crypto asset service providers (VASPs) across 206 jurisdictions worldwide. Built as a React SPA with SquareType theme 1:1 visual match.

## Team & Roles

| Person | Role | Scope | Branches |
|--------|------|-------|----------|
| **Anton** | Owner, Full-Stack Lead | Backend: `parsers/`, `workers/`, `shared/`, `scripts/`, `.github/`, `CLAUDE.md`. Frontend: `src/data/`, `src/types.ts`, `src/pages/` (structure + data), `src/App.tsx` (routes) | `backend/*` |
| **Sasha** | Frontend Visual Lead | `src/components/`, `src/styles/`, `src/hooks/`, `src/pages/` (styles + layout + responsive) | `frontend/*` |

### Frontend Work Split (Anton + Sasha both touch `src/`)

| Aspect | Anton | Sasha |
|--------|-------|-------|
| **Data & Types** | `src/data/`, `src/types.ts` — loaders, API, interfaces | Read-only |
| **Pages — structure** | New sections, tables, fields, data bindings | — |
| **Pages — visuals** | — | CSS classes, layout, responsive, animations |
| **Routes** | `src/App.tsx` — new routes | — |
| **Components** | — | `src/components/` — UI components, GSAP |
| **Styles** | — | `src/styles/` — all CSS |
| **Hooks** | — | `src/hooks/` — UI hooks (scroll, resize) |

**Workflow:** Anton creates skeleton with data (functional but unstyled) → merges to main → creates Notion task for Sasha (Owner: Sasha) → Sasha polishes visuals.

**Rule:** Never work on the same file simultaneously. Use Notion KB to coordinate — each task has an Owner.

### Branching Strategy
- **`main`** — production branch, deployed to GitHub Pages via CI
- **`backend/*`** — Anton's work (parsers, workers, infra, frontend structure). Example: `backend/esma-parser`
- **`frontend/*`** — Sasha's work (UI polish, styles, responsive). Example: `frontend/issuer-pages`
- Merge to `main` via **Pull Requests** only
- Both can read the entire codebase; write only to your scope
- Conflicts in shared files (`CLAUDE.md`, `package.json`) — resolve together

### Owner Field in Notion KB
- **Anton** — backend tasks, parsers, architecture, frontend structure + data
- **Sasha** — frontend visuals, styles, responsive, animations, component polish
- **Both** — cross-cutting tasks (shared interfaces, deploy)

## Project Structure
- `/remide/src/` — Frontend React SPA. **NEVER imports from** `parsers/`, `workers/`, or `shared/`. **Anton: data + structure. Sasha: visuals + styles.**
- `/remide/parsers/` — Registry scrapers (29 parsers + core toolkit). Imports from `parsers/core/`. **Owner: Anton.**
- `/remide/workers/` — Background workers (enrichment, intelligence, exports). Imports from `shared/`. **Owner: Anton.**
- `/remide/shared/` — Shared backend utilities (config, supabase, logger, types). Used by workers & parsers. **Owner: Anton.**
- `/Theme SquareType/` — Visual reference template (UI8 purchase). Use for CSS/animation reference only.
- `/vasp-tracker-claude-analyze-crypto-registries-CD5TT/` — Old abandoned codebase. Only data files carried over. Do not modify.

## Tech Stack
- React 19 + TypeScript + Vite 6
- Bootstrap 5.3 (CSS only, no JS), GSAP + ScrollTrigger
- MapLibre GL JS (world map), Recharts (charts), Lucide React (icons)
- Google Fonts: Inter (body) + Doto (display/numbers)
- Deploy: GitHub Pages with HashRouter
- Backend: Supabase (auth, DB, Edge Functions)
- Parsers: GitHub Actions (cron), TypeScript, shared toolkit

## Key Constraints
- **NO:** MUI, Lenis (causes scroll lag), Tailwind, jQuery, react-simple-maps
- **Visual:** SquareType theme 1:1 — reference `/Theme SquareType/` for CSS patterns
- **Clip-path:** `.clip-lg` on ALL cards everywhere
- **Animations:** GSAP only (reveal, stagger, counter), no Lenis smooth scroll
- **Language:** Speak Russian to the user. Do maximum work autonomously.
- **Process:** Discuss specs/UX before building. Log all decisions.
- **Stride data: CONFIDENTIAL.** Never mention Stride as data source in public code, comments, commits, or docs. Present all stablecoin/issuer data as RemiDe's own research.

## Development Priorities (PERMANENT)

**Priority: Build features that drive monetization.**

SEO and Mobile are NOT separate priorities — they are mandatory quality gates:
- Every page/component MUST ship with: `<meta>`, `<title>`, OG tags, semantic HTML
- Every page/component MUST work at 375px viewport minimum
- Touch targets >= 44px, `<main>`/`<article>`/`<nav>` for crawlability
- Tests are mandatory: unit tests for logic, visual check at desktop + mobile

Architecture/infra work is done ONLY when it unblocks features, never as busywork.

**Sprint planning:** Features first, grouped by monetization impact.
**Import rules:** Workers and parsers import from `shared/`. Frontend (`src/`) NEVER imports from `shared/`, `parsers/`, or `workers/`.

## Development Process (MANDATORY)

### Feature Lifecycle
1. **LOG** — Любая идея/задача → сразу в Notion KB (Backlog)
2. **TIER** — Определить Tier (1/2/3) по сложности и impact
3. **DEBATE** — A/B/C/D framework (Tier 2-3 only, см. ниже)
4. **REVIEW** — Антон утверждает (или просит изменения)
5. **IMPLEMENT** — Только после confirmation
6. **LOG DECISIONS** — Каждое решение → Notion KB (Type: Decision) + project-decisions.md как кеш

### Adversarial Debate Protocol (A/B/C/D)

**Когда запускать (Tiers):**
- **Tier 1** (баг-фиксы, правки < 30 мин): Пропустить. Просто сделать.
- **Tier 2** (фичи, 30 мин — 1 день): 1 раунд. Agents A + B + C.
- **Tier 3** (архитектура, multi-session, breaking changes): 2 раунда. Все 4 агента.

**Роли:**
- **Agent A — Защитник:** Построй решение. Дай допущения. Предложи план.
  Включи user/business perspective в свои аргументы.
- **Agent B — Критик:** Найди все реальные риски (мин. 3, макс. 10).
  Предложи альтернативы. Укажи что нужно уточнить.
  Evidence recommended: ссылки на файлы/код/данные усиливают аргумент.
- **Agent C — Арбитр:** Для каждого спорного пункта:
  "тезис → за → против → решение → уверенность (%)".
  Выбери лучший вариант. Дай итоговый ответ + чек-лист.
- **Agent D — Пользователь/Бизнес:** (Только Tier 3) Как это повлияет на пользователя?
  Что увидит? Monetization impact? UX concerns? SEO effect?

**Процедура:**
- **Tier 2:** A → B → C (1 раунд)
- **Tier 3:** Раунд 1: A → B → D → C. Раунд 2: A отвечает → B проверяет → C финал.
  Round 2 conditional: если C confidence > 90% по всем пунктам — Round 2 skip.

**Confidence Thresholds:**
- **> 80%:** Go. Реализуем.
- **60–80%:** Уточнить у Anton / добавить data / Round 2.
- **< 60%:** Stop. Нужен больше research или альтернативный подход.

**Output Format (Agent C):**

| # | Тезис | За | Против | Решение | Уверенность |
|---|-------|-----|--------|---------|-------------|
| 1 | ...   | ... | ...    | ...     | XX%         |

+ Итоговый чек-лист перед реализацией.

### Sprint Protocol
Каждый спринт начинается с:
1. Просмотр прошлой работы (что сделано, что нет, почему)
2. Определить Tier для каждой задачи (1/2/3)
3. Debate (Tier 2-3) → отчётность Anton'у — он принимает решения
4. После confirmation — разработка

### System Limits (Workers & Agents)
- Enrichment batch: max 200 entities per run (prevents context overflow)
- No parallel Firecrawl batches (conflict risk)
- Notion API: retry 3x with backoff on 500 errors
- Worker logging: every run → Notion Scrape Runs

## Dev Commands
```bash
# All commands run from the /remide/ directory
npm run dev          # Start dev server (localhost:5173)
npm run build        # Production build (tsc + vite)
npx tsc --noEmit     # Type check only

# Parsers (backend only — Anton)
npx tsx parsers/run.ts --registry <id> [--dry-run] [--force] [--no-notion]
npx tsx parsers/run.ts --list                    # List all parsers
npx tsx parsers/registries/esma-unified.ts       # ESMA all EU countries
npx tsx workers/enrichment/run.ts --limit 200    # Enrichment worker
npx tsx scripts/generate-sitemap.ts              # Rebuild sitemap
```

---

## Source of Truth Architecture

**Notion = source of truth.** All structured data lives in Notion databases.
**MD files = fast cache.** Quick-start context for Claude Code, synced after every session.

### What lives WHERE

| Data | Location | Why |
|------|----------|-----|
| Tasks, features, backlog, decisions | **Notion Knowledge Base** (Type field distinguishes) → decisions cached in `project-decisions.md` | Single source of truth for everything |
| Parser registry | **Notion Parser Registry** | Per-country structured records |
| Scrape run logs | **Notion Scrape Runs** | Execution history |
| Architecture overview | **Notion Architecture Router** page | Living document |
| Current project status | **Notion Current State** page → cache in `MEMORY.md` | Quick sync |
| Project rules & constraints | **This file** (CLAUDE.md) | Loaded automatically by Claude Code |
| Quick session context | `MEMORY.md` (cache of Notion) | Fast read, no API call |

### Notion Workspace IDs

```
Parent page: 3182ac10-63c8-809a-870f-fe525637dd79

Databases:
  Knowledge Base:   collection://b48d85fc-29a9-4e68-b331-cbbc5595bc5f
  Parser Registry:  collection://3de230bb-1638-40b0-b3d1-5c3cf54101a6
  Scrape Runs:      collection://5dfa965b-6f3e-441e-b37b-8768b52ea131

Pages:
  Architecture Router:  3182ac10-63c8-8132-a898-fc7e7c04b757
  Current State:        3182ac10-63c8-811c-8cfe-fd40919d8e20
  System Prompt:        3182ac10-63c8-8182-a4d3-febb5fcf7946
  CD Protocol Config:   3182ac10-63c8-81c8-9786-d1d7d88b320d
```

---

## Session Protocol

### Session Start (ALWAYS do this)
1. Read this file (CLAUDE.md) — project rules, constraints, IDs
2. Read `MEMORY.md` from your Claude Code memory directory — cached status, quick context
3. Read `project-decisions.md` from memory — cached decisions
4. Check for plan files in your Claude Code plans directory
5. Run health check from the `/remide/` directory: `npx tsc --noEmit && npm run build`

### During Session — Logging Rules

**EVERY decision → Notion KB (Type: Decision) + project-decisions.md**
When a decision is made (architecture, UX, tech, data, infra, business):
1. Create row in Notion KB (`collection://b48d85fc-29a9-4e68-b331-cbbc5595bc5f`)
   - Task: `[ID]: Description` (e.g. `ARCH-007: New routing strategy`)
   - Type: Decision, Status: Done, Owner, Sprint, Priority
   - Notes: `Category: ...\n\nContext: ...\n\nAlternatives: ...\n\nImpact: ...`
   - Version + Release Name + Completed Date (when decision was made)
2. Append to `project-decisions.md` as cache

**NEW task or feature discovered → Notion Knowledge Base**
Create row in `collection://b48d85fc-29a9-4e68-b331-cbbc5595bc5f`:
- Task (title), Type, Status: Backlog, Sprint, Owner, Priority, Notes

**Question for Anton (blocked) → Notion Knowledge Base**
Create row with Status: Blocked, Blocker: "question text here"

**Bug found → Notion Knowledge Base**
Create row with Type: Task, Priority: Core, Status: Backlog

**Parser created → Notion Parser Registry (MANDATORY — NO EXCEPTIONS)**
Create row in `collection://3de230bb-1638-40b0-b3d1-5c3cf54101a6` **IMMEDIATELY after building each parser:**
- Parser name, Country, Registry, Source Type, Frequency, Source URL
- **Parser Approach:** HOW the parser works (API type, scraping method, pagination, fallback strategy)
- **Technical Decisions:** What was tried, what failed, what alternative was chosen and why
- **Entity Count:** Number of entities parsed
- **Build Status:** "Deployed & Running" / "Built, Not Deployed" / "Broken"
- **Notes:** Full writeup including: API endpoints, data format, edge cases, known issues
- ⚠️ **NEVER batch parser documentation.** Each parser is logged to Notion the moment it is built and tested. Do not wait until "later" or "end of session".

**Parser executed → Notion Scrape Runs (MANDATORY)**
Create row in `collection://5dfa965b-6f3e-441e-b37b-8768b52ea131` **IMMEDIATELY after each parser deployment:**
- Run name, Parser, Status, Started, Duration, Records Found/New/Updated, Errors, Trigger
- ⚠️ Do not skip this step. Every parser run that writes to Supabase MUST be logged.

### Documentation Gap Recovery (CRITICAL)
If at any point you discover that parsers, decisions, or runs are NOT logged in Notion:
1. **STOP current work immediately**
2. **Audit:** Check what's missing (search Notion, compare with MEMORY.md/codebase)
3. **Backfill:** Create all missing Notion entries with full specs and decisions
4. **Resume:** Only continue new work after gaps are filled
This applies to all Notion databases: Knowledge Base, Parser Registry, and Scrape Runs.

**Task completed → Update Notion Knowledge Base**
Change Status to Done on the corresponding row

---

### Notion KB — Quality Standards (CRITICAL)

**Принцип: каждая запись в Notion = полное ТЗ.** Не должно требоваться дополнительного контекста, чтобы понять задачу.

#### При создании задач (Knowledge Base)

Каждая запись ОБЯЗАНА содержать:

1. **Task (title):** Чёткое, конкретное название.
   - **Задачи/фичи:** `[Компонент/Область]: Действие`. Пример: `Firecrawl: Entity Enrichment Worker — scrape website/description/LinkedIn`
   - **Решения:** `[ID]: Описание`. Пример: `ARCH-007: BrowserRouter для SEO-crawlability`
   - ❌ Плохо: `Добавить обогащение`, `Решение по архитектуре`

2. **Notes — МАКСИМАЛЬНО ДЕТАЛЬНЫЕ.** Формат Notes зависит от Type:

   **Для Task / Feature / Spec / Research / Process / Principle:**
   - **TL;DR** (1-2 предложения) — суть для быстрого просмотра
   - **Что делаем** — конкретные действия, файлы, эндпоинты
   - **Зачем** — бизнес-контекст, какую проблему решает
   - **Как** — технический подход, API-вызовы, примеры кода/CLI
   - **Файлы** — путь к файлам которые будут созданы/изменены
   - **Зависимости** — от чего зависит, что блокирует
   - **Критерии готовности** — когда задача считается Done

   **Для Decision (Type: Decision):**
   - **Category:** Architecture / UX-UI / Data / Parser / Infra / Business
   - **Context:** Почему это решение было принято (проблема, ситуация)
   - **Alternatives:** Что рассматривали и почему отвергли
   - **Impact:** Что это решение затрагивает (файлы, компоненты, процессы)

3. **Все поля заполнены:**
   - Type: Feature / Task / Spec / Process / Principle / Research / Decision
   - Status: Backlog / In Progress / Done / Blocked
   - Sprint: S0-S8 (один из актуальных Sprint values)
   - Priority: Core / Standard / Optional
   - Owner: Claude Code / Anton / Both
   - Blocker: текст если Status = Blocked

#### При обновлении задач

- **Status change** → ВСЕГДА добавлять в Notes запись с датой: `[2026-03-04] Status: In Progress → Done. Реализовано в коммите abc123.`
- **Partial progress** → обновить Notes с описанием что сделано и что осталось
- **Blocked** → указать Blocker + добавить в Notes что именно блокирует и какие варианты обхода рассматривались
- **Priority change** → добавить в Notes причину изменения приоритета

#### При чтении/поиске задач

- Перед созданием задачи — **ВСЕГДА** сначала поискать существующую через `notion-search` или `notion-query-data-sources`
- Не дублировать задачи. Если похожая существует — обновить её, а не создавать новую
- При `notion-fetch` базы — проверить актуальную схему (имена свойств могут отличаться от кеша)

#### Notion KB Schema (актуальная — 2026-03-04)

```
Properties:
  Task            — TITLE (обязательно)
  Type            — SELECT: Spec, Process, Feature, Task, Principle, Backlog, Research, Decision
  Status          — SELECT: Backlog, In Progress, Done, Blocked
  Sprint          — SELECT: S0: Infrastructure, S1: Parsers — Core, S2: Parsers — Regulation,
                            S3: Parsers — Stablecoins, S4: Enrichment, S5: Monitoring,
                            S6: Product & Monetization, S7: Future, S8: Mobile
  Priority        — SELECT: Core, Standard, Optional
  Owner           — SELECT: Claude Code, Anton, Sasha, Both
  Order           — NUMBER (порядок в спринте: 1 = first)
  Version         — NUMBER (semver: 1.0, 1.1, 1.2, ...)
  Release Name    — TEXT (человеческое имя: MVP, Parsers, Stablecoins, ...)
  Completed Date  — DATE (когда задача завершена)
  Started Date    — DATE (когда задача взята в работу)
  Notes           — RICH_TEXT (основной контент задачи)
  Blocker         — RICH_TEXT (описание блокера)
  Verification    — RICH_TEXT
  Depends On      — RELATION (self-relation)
```

⚠️ Всегда `notion-fetch` базу перед первой записью в сессии для проверки актуальной схемы.
⚠️ **При Status → Done:** обязательно проставить Version, Release Name, Completed Date.
⚠️ **При Status → In Progress:** проставить Started Date.
⚠️ **Decision Log удалён.** Все решения хранятся в KB с Type: Decision.

---

### Session End (ALWAYS do this before finishing)
1. **Documentation Completeness Audit** — Check that ALL parsers, decisions, and runs from this session are logged in Notion. If anything is missing, create the entries NOW before proceeding.
2. **Update `MEMORY.md`** — sync current status, any new IDs, what was done
3. **Update `project-decisions.md`** — sync any new decisions made this session
4. **Update Notion "Current State" page** (`3182ac10-63c8-811c-8cfe-fd40919d8e20`) — latest status
5. **Log unresolved items** — any open questions → Knowledge Base (Blocked), any new tasks → Knowledge Base (Backlog)
6. **Commit code** if there are uncommitted changes

---

## Memory Files (Cache)

Each developer's Claude Code maintains its own local memory files. They are NOT shared via git — each agent builds its own context from Notion (source of truth).

- **MEMORY.md** — Cache of Notion Current State. Quick-start context. Keep under 150 lines. Update at end of every session.
- **project-decisions.md** — Cache of KB decisions (Type: Decision). All decisions with rationale. Update immediately when decisions are made.
- **Add topic files** (`debugging.md`, `patterns.md`) for detailed notes if needed.

### Cache Sync Rules
- **After any decision** → Update `project-decisions.md` immediately + Notion KB (Type: Decision)
- **After milestone** → Update `MEMORY.md` + Notion Current State
- **Decision changed** → Update old entry in both MD and Notion KB (don't duplicate)
- **User says "remember X"** → Save to appropriate memory file + Notion if structured

### First Session Setup (new developer)
If `MEMORY.md` doesn't exist yet, bootstrap it:
1. Fetch Notion "Current State" page (`3182ac10-63c8-811c-8cfe-fd40919d8e20`) — copy key facts into MEMORY.md
2. Query Notion KB for recent decisions (Type: Decision, last 30 days) → build project-decisions.md
3. Run `npm run build` to verify the environment is working
