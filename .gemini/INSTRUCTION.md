# DocFlow — Gemini Project Instructions

This file provides project context and best practices for AI agents working on **DocFlow**, a block-based visual document design engine with native compilation to `pdfkit` (PDF) and HTML.

---

## Project Overview

DocFlow separates the visual design interface from the rendering logic using a **JSON AST (Abstract Syntax Tree)** as the interchange format. The architecture follows a three-phase data flow:

```
Design UI (Zustand) → JSON AST → Variable Parser ({{interpolation}}) → Active Adapter (pdfkit | html) → Output File
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | PNPM Workspaces + Turborepo |
| Frontend | Next.js 15 (App Router) + Tailwind CSS |
| State Management | Zustand (atomic selectors, no mass re-renders) |
| Core Engine | Pure TypeScript, compiled via tsup (ESM + CJS) |
| PDF Rendering | pdfkit (sequential AST adapter) |
| HTML Rendering | Planned adapter (future) |
| Testing | Playwright + @axe-core/playwright + Vitest |
| CI/CD | GitHub Actions + Lighthouse CI |
| Frontend Deploy | Vercel or Netlify (Edge + ISR) |
| Library Deploy | NPM (only when coverage >90%) |

---

## Directory Structure

```
docflow/
├── .github/workflows/       # CI/CD pipelines
├── apps/
│   └── web-builder/         # Next.js 15 App Router application
├── packages/
│   ├── core/                # Rendering engine: parser + adapters
│   │   └── src/
│   │       ├── parser.ts
│   │       └── adapters/
│   │           └── pdfkit.ts
│   └── ts-config/           # Shared TypeScript configs
├── docs/
│   └── DOCFLOW_PLAN.md      # Complete architecture & execution plan
├── .config/opencode/
│   └── AGENTS.md            # OpenCode project-level config
├── .gemini/
│   └── INSTRUCTION.md       # This file
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

---

## JSON AST Schema (Core Data Model)

Every document is an array of semantic blocks in `ast[]`. Each block contains:

```json
{
  "id": "blk_1",
  "type": "heading",
  "level": 1,
  "text": "Hello {{customer.name}}",
  "styles": { "color": "#111827", "fontSize": 24, "marginBottom": 10 }
}
```

**Block types**: `heading`, `paragraph`, `table`, `image`, `divider`
**Interpolation syntax**: `{{path.to.data}}` — resolved via dot-notation parser
**Iteration**: `loopOver` field for table rows and repeated blocks

---

## Architecture Rules (MANDATORY)

### Separation of Concerns
- **UI code** (Next.js, React, Zustand) NEVER imports from or depends on the rendering adapters
- **Core engine** NEVER imports from React, Next.js, or any UI framework
- The AST JSON is the ONLY contract between layers

### Parser Contract
- `resolvePayload(path, obj)`: walks dot-notation safely, returns `''` for undefined paths
- `interpolate(template, data)`: replaces all `{{...}}` occurrences
- Must handle nested objects: `{{invoice.client.address.city}}`

### Adapter Contract
- Each adapter iterates `schema.ast` SEQUENTIALLY
- Page break prevention: check remaining space before rendering heavy blocks
- Adapters are `async` functions returning the rendered document

### Frontend Rules
- Editor Canvas must be a client component (`'use client'`)
- Use Zustand selectors to prevent re-renders: `useDocumentStore(s => s.ast)`
- Inline editing via `contentEditable` + `onBlur` handlers
- Every editable element needs `suppressContentEditableWarning`

---

## Accessibility Requirements (WCAG 2.1 AA)

Non-negotiable standards:

| Requirement | Specification |
|-------------|--------------|
| Color contrast | Minimum 4.5:1 for normal text, 3:1 for large text |
| Keyboard navigation | All panels: Tab, Arrow keys, Escape |
| ARIA menus | `aria-haspopup="listbox"` on block selectors |
| Live regions | Hidden element with `aria-live="polite"` for structural announcements |
| Canvas role | `role="region"` with descriptive `aria-label` |
| Semantic HTML | `<header>`, `<main>`, `<aside>`, `<section>`, `<footer>` |
| CI audit | `@axe-core/playwright` on every PR |

---

## Code Conventions

### TypeScript
- `strict: true` always
- Interfaces over types for data models
- Named exports preferred (except Next.js pages)
- Functions over classes for stateless logic

### Styling
- Tailwind CSS utility-first approach
- No custom CSS files unless absolutely necessary
- Avoid inline `style={}` props — use Tailwind classes

### Git & Commits
- Conventional commits only (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`)
- Never add "Co-Authored-By" or AI attribution
- Work-unit commits: each commit is a reviewable slice

---

## Design Quality Standards

When generating UI for the editor, apply premium design patterns:
- **Typography**: High contrast ratios, generous line-height (1.6+ for body)
- **Spacing**: 8px grid system, consistent padding/margin
- **Cards**: Clean shadows, subtle borders, no heavy gradients
- **Animations**: Subtle micro-movements, hardware-accelerated (transform/opacity only)
- **Color**: Calibrated palette, no pure grays, semantic color usage

---

## Package Management

```bash
# ALWAYS use pnpm — never npm or yarn
pnpm install <package>
pnpm --filter <workspace> add <package>
pnpm --filter <workspace> remove <package>

# Development
pnpm dev
pnpm --filter web-builder dev
pnpm --filter core dev

# Build
pnpm build
pnpm --filter core build   # tsup → dist/ with ESM + CJS

# Test
pnpm test
pnpm --filter core test

# Lint
pnpm lint
```

---

## Design Resources (Installed Agent Skills)

These skills are available for UI/UX generation:

| Skill | When to Use |
|-------|-------------|
| `ui-ux-pro-max` | General UI/UX: layouts, palettes, typography, charts |
| `design-taste-frontend` | Strict component architecture, CSS GPU acceleration |
| `high-end-visual-design` | Premium, agency-quality visual design |
| `minimalist-ui` | Clean editorial-style interfaces |
| `redesign-existing-projects` | Upgrading existing UIs |
| `stitch-design-taste` | Semantic design system generation |

**Best practice**: Always read `high-end-visual-design` + `design-taste-frontend` SKILL.md files before generating editor UI components.

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `docs/DOCFLOW_PLAN.md` | Complete architecture specification and execution plan |
| `.config/opencode/AGENTS.md` | OpenCode project-level agent configuration |
| `.gemini/INSTRUCTION.md` | This file — Gemini project instructions |
| `packages/core/src/parser.ts` | Variable interpolation engine |
| `packages/core/src/adapters/pdfkit.ts` | PDF rendering adapter |
| `apps/web-builder/src/store/useDocumentStore.ts` | Zustand document state |
| `apps/web-builder/src/components/Canvas.tsx` | Visual editor canvas |

---

## Questions to Ask Before Generating Code

1. Is this UI code or core engine code? (They must NOT mix)
2. Does this touch the AST schema? (Validate against the standard)
3. Does this introduce a new block type? (Update adapters and types)
4. Does this UI change affect accessibility? (Check WCAG 2.1 AA)
5. Does this need to be in the monorepo or could it be an external package?
