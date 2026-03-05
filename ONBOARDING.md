# RemiDe — Frontend Developer Onboarding

> This guide gets you from zero to running in ~15 minutes.

---

## Step 1: Clone & Install

```bash
git clone https://github.com/anton-remide/remide.git
cd remide
npm install
```

---

## Step 2: Environment Keys

1. Open **1Password** → Vault **"RemiDe Dev"**
2. Find the Secure Note **"remide .env.local"**
3. Copy the content
4. Create file in project root:

```bash
touch .env.local
# Paste the content from 1Password into .env.local
```

You only need these variables to run the frontend:
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — public anon key
- `NOTION_TOKEN` — for Claude Code agent (Notion integration)

> `.env.local` is gitignored. NEVER commit it.

---

## Step 3: Run the App

```bash
npm run dev        # Dev server → http://localhost:5173
npm run build      # Production build (must pass before PR)
npx tsc --noEmit   # Type check only
```

Test user for login: `test@remide.dev` / `TestPass123!`

---

## Step 4: Claude Code Setup

### Install
- VS Code: install "Claude Code" extension
- Or CLI: `npm install -g @anthropic-ai/claude-code`

### Notion Integration (required)
1. Go to https://www.notion.so/my-integrations
2. Click "New Integration"
3. Name: `Claude Code - Sasha`
4. Workspace: select RemiDe workspace
5. Copy the token → paste as `NOTION_TOKEN` in `.env.local`
6. In Notion: share the RemiDe parent page with this integration (click "..." → "Connections" → add your integration)

### First Session
When you launch Claude Code for the first time in this project, it will:
1. Auto-read `CLAUDE.md` (project rules, constraints, IDs)
2. Notice that `MEMORY.md` doesn't exist yet
3. Bootstrap from Notion:
   - Fetch "Current State" page → create `MEMORY.md`
   - Query KB for recent decisions → create `project-decisions.md`
4. Run `npm run build` to verify environment

> These memory files live at `~/.claude/projects/...` and are local to your machine. They are NOT committed to git. Notion is the source of truth.

### How Claude Code Works for You
- It reads `CLAUDE.md` at every session start — all rules are there
- It logs tasks and decisions to Notion Knowledge Base automatically
- It knows your role is **Frontend Lead** — scope is `src/` only
- It will never touch `parsers/`, `workers/`, `shared/`, `scripts/`

### Key Notion Databases (auto-used by Claude Code)
| Database | Purpose |
|----------|---------|
| Knowledge Base | Tasks, features, decisions, backlog |
| Parser Registry | Parser configs (backend, read-only for you) |
| Scrape Runs | Parser execution logs (backend, read-only for you) |

---

## Step 5: Git Workflow

### Branching
```
main              ← production (protected, merge via PR only)
frontend/*        ← your feature branches
backend/*         ← Anton's branches (don't touch)
```

### Your workflow
```bash
git checkout -b frontend/fix-mobile-nav    # Create feature branch
# ... do work ...
git add -A && git commit -m "fix: mobile nav hamburger menu"
git push -u origin frontend/fix-mobile-nav
# Create PR on GitHub → merge to main
```

### Commit conventions
- `feat:` new feature
- `fix:` bug fix
- `style:` CSS/UI changes
- `refactor:` code restructuring
- `chore:` config, deps, tooling

---

## Step 6: Rules to Follow

### Mandatory Quality Gates (every PR)
- [ ] `npm run build` passes with zero errors
- [ ] SEO: every page has `<title>`, `<meta description>`, OG tags, JSON-LD
- [ ] Mobile: works at 375px viewport minimum
- [ ] Touch targets >= 44px
- [ ] Semantic HTML: `<main>`, `<article>`, `<nav>` for crawlability

### Code Conventions
- **CSS:** Bootstrap 5.3 classes + custom CSS. NO Tailwind, NO MUI
- **Animations:** GSAP only. NO Lenis (causes scroll lag)
- **Icons:** Lucide React only
- **Fonts:** Inter (body) + Doto (display/numbers) via Google Fonts
- **Cards:** Always use `.clip-lg` class (clip-path corners)
- **Map:** MapLibre GL JS. NO react-simple-maps
- **Charts:** Recharts

### Architecture
- `src/` is your domain — React pages, components, styles, data loaders
- NEVER import from `parsers/`, `workers/`, or `shared/`
- Data comes from Supabase via `src/data/dataLoader.ts`

### Confidential
- **Stride** is our data partner. NEVER mention "Stride" in code, comments, commits, or docs
- All stablecoin/issuer data is presented as "RemiDe's own research"

---

## Quick Reference

| Command | What it does |
|---------|-------------|
| `npm run dev` | Dev server on localhost:5173 |
| `npm run build` | Production build (tsc + vite) |
| `npx tsc --noEmit` | Type check without building |

| Tool | Used for |
|------|----------|
| React 19 + TypeScript | UI framework |
| Vite 6 | Build tool |
| Bootstrap 5.3 | CSS framework (no JS) |
| GSAP + ScrollTrigger | Animations |
| MapLibre GL JS | World map |
| Recharts | Charts |
| Lucide React | Icons |
| Supabase | Auth + Database |

---

## Need Help?
- Check `CLAUDE.md` for full project rules
- Ask Claude Code — it has full context of the project
- Check Notion Knowledge Base for task history and decisions
- Ask Anton for backend/data questions
