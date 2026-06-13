<!-- gentle-ai:project-context -->
# DocFlow — Project Agent Configuration

This file configures AI behavior specifically for the **DocFlow** project. It extends the global `AGENTS.md` with project-level context, architecture, conventions, and best practices.

---

## Project Identity

**DocFlow** es un motor de diseño visual de documentos agnóstico basado en bloques, con compilación nativa para `pdfkit` (PDF) y HTML. Separa la interfaz de diseño de la lógica de renderizado mediante un **AST JSON** como formato de intercambio.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | PNPM Workspaces + Turborepo |
| Frontend | Next.js 15 (App Router) + Tailwind CSS |
| State | Zustand (selectores específicos, sin re-renders masivos) |
| Core Engine | TypeScript puro, compilado con tsup (ESM + CJS) |
| PDF Rendering | pdfkit (adaptador secuencial de AST) |
| HTML Rendering | Adaptador planificado (futuro) |
| Testing | Playwright + @axe-core/playwright + Vitest |
| CI/CD | GitHub Actions + Lighthouse CI |
| Deploy Frontend | Vercel o Netlify (Edge + ISR) |
| Deploy Library | NPM (solo con cobertura >90%) |

---

## Architecture (CRITICAL — read before any code generation)

### Core Architectural Decision

La interfaz de diseño y la lógica de compilación están **totalmente separadas**. El nexo es un **AST JSON**:

```
UI (Zustand) → JSON AST → Parser (interpolación {{...}}) → Adaptador (pdfkit | html) → Archivo final
```

### JSON AST Schema

Todo documento se representa como un array de bloques en `ast[]`. Cada bloque tiene:
- `id`: identificador único (ej. `blk_1`)
- `type`: tipo de bloque (`heading`, `paragraph`, `table`, etc.)
- `text`: contenido con interpolación `{{ruta.al.dato}}`
- `styles`: objeto de estilos planos
- `loopOver`: (opcional) para bloques iterativos sobre arrays de datos

### Directory Structure

```
docflow/
├── .github/workflows/       # CI/CD
├── apps/
│   └── web-builder/         # Next.js 15 App Router
├── packages/
│   ├── core/                # Motor: parser + adaptadores
│   │   └── src/
│   │       ├── parser.ts
│   │       └── adapters/
│   │           └── pdfkit.ts
│   └── ts-config/           # TS configs compartidas
├── docs/
│   └── DOCFLOW_PLAN.md      # Full architecture & execution plan
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

---

## Code Conventions

### TypeScript
- Strict mode always (`strict: true` en tsconfig)
- Prefer interfaces over types for object shapes
- Use `interface Block { ... }` para el modelo de datos del AST
- Functions > classes (a menos que se necesite estado con ciclo de vida)
- Named exports, no default exports (excepto en páginas de Next.js)

### Core Engine (`packages/core`)
- **Parser**: `resolvePayload(path, obj)` recorre dot-notation. `interpolate(template, data)` reemplaza `{{...}}` con datos.
- **Adaptadores**: Cada adaptador recorre `schema.ast` secuencialmente. Control de salto de página preventivo (antes de bloques pesados, verificar `doc.y > pageHeight - threshold`).
- Los adaptadores son funciones `async` que devuelven el documento renderizado.

### Frontend (`apps/web-builder`)
- Componentes del editor visual: `'use client'` solo en el Canvas y paneles interactivos
- Estado global con Zustand: selectores cerrados para evitar re-renders (`useDocumentStore(s => s.ast)`)
- Edición inline con `contentEditable` + `onBlur` para persistir cambios
- Todo bloque editable debe tener `suppressContentEditableWarning`

### Tailwind CSS
- Utility-first, sin CSS personalizado a menos que sea estrictamente necesario
- Preferir clases de Tailwind sobre `style={}` inline
- Usar `@apply` solo en casos de patrones repetitivos complejos

---

## Accessibility Standards (WCAG 2.1 AA — MANDATORY)

Estos son requisitos **no negociables**:

- **Contraste mínimo**: 4.5:1 para texto normal, 3:1 para texto grande
- **Navegación por teclado**: Todos los paneles y menús deben ser navegables con Tab/Arrow/Escape
- **aria-haspopup="listbox"** en menús de selección de bloques
- **aria-live="polite"** en un elemento oculto que anuncie cambios estructurales
- **role="region"** con `aria-label` descriptivo en el canvas
- **Etiquetas semánticas**: `<header>`, `<main>`, `<aside>`, `<section>`, `<footer>`
- Auditoría automatizada con `@axe-core/playwright` en CI

---

## Design Skills (already installed — use when generating UI)

| Skill | Purpose |
|-------|---------|
| `ui-ux-pro-max` | UI/UX design general — 50+ styles, palettes, typography |
| `design-taste-frontend` | Senior UI/UX engineering — strict metrics, CSS GPU acceleration |
| `high-end-visual-design` | Premium agency-level design patterns |
| `minimalist-ui` | Clean editorial interfaces, warm monochrome |
| `redesign-existing-projects` | Upgrade existing UIs |
| `stitch-design-taste` | Semantic design system |

**Rule**: Always load `high-end-visual-design` + `design-taste-frontend` before generating UI components for the editor. The editor targets a premium, professional look — not generic AI defaults.

---

## SDD Workflow

Este proyecto usa **Spec-Driven Development (SDD)** para cambios significativos.

- Init guard: check Engram before any SDD command
- Preflight gate: prompt user for execution mode, artifact store, PR strategy, review budget
- Phases: Proposal → Specs → Design → Tasks → Apply → Verify → Archive
- Sub-agents: Delegar trabajo complejo (4+ files, multi-file writes, tests, PRs)

---

## Critical Rules

1. **Never** mezclar lógica de UI con lógica de compilación. El core engine no debe importar nada de React/Next.
2. **Never** hardcodear rutas de archivos. Usar las configuraciones del monorepo.
3. **Always** mantener la separación AST/adaptador: los adaptadores leen el AST, no al revés.
4. **Always** cargar `high-end-visual-design` + `design-taste-frontend` antes de generar UI del editor.
5. **Always** verificar contraste WCAG 2.1 AA (4.5:1 mínimo) en cualquier paleta de colores generada.
6. **Always** usar `pnpm` para instalar dependencias — nunca npm o yarn.
7. **Prefer** delegar tareas complejas a sub-agents (SDD phases) sobre ejecutarlas inline.
8. **Never** crear componentes de servidor que manejen estado del editor visual.

---

## Useful Commands

```bash
# Development
pnpm dev              # Run all workspaces in dev mode
pnpm --filter web-builder dev   # Dev only the frontend
pnpm --filter core dev          # Dev only the core engine

# Build
pnpm build            # Build all workspaces
pnpm --filter core build       # Build only core

# Testing
pnpm test             # Run all tests
pnpm --filter core test        # Test only core

# Linting
pnpm lint             # Lint all workspaces

# Skills
npx skills find <query>        # Search skills.sh
npx skills add <owner/repo@...> -g -y  # Install skill globally
```
