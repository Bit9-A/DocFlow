# DocFlow

**Build beautiful PDF documents visually — generate them programmatically.**

DocFlow is an open-source, block-based visual document design engine. It separates the editing experience from the rendering layer using a portable **JSON AST** format, enabling native compilation to PDF (via `pdfkit`) with HTML rendering on the roadmap.

Use the **visual builder** (Next.js 15) to design documents, or use the **core library** directly to generate PDFs from code — or both.

---

## Features

- **Visual Block Editor** — Drag-and-drop document builder with real-time preview
- **JSON AST as the universal format** — Design once, render anywhere (PDF, HTML, more)
- **PDF Generation** — High-fidelity output via `pdfkit` with dynamic page breaks
- **Variable Interpolation** — Inject dynamic data with `{{customer.name}}` syntax
- **Dynamic Tables** — Bind table rows to API arrays with auto page-splitting
- **Headers & Footers** — Automatic replication across pages, with `{{currentPage}}` / `{{totalPages}}`
- **Multi-column Layouts** — Column-based positioning with percentage distribution
- **WCAG 2.1 AA** — Accessible editor with keyboard navigation, ARIA live regions, and screen reader support
- **Monorepo** — PNPM Workspaces + Turborepo for scalable development

---

## How It Works

```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│  Visual Editor   │     │   JSON AST      │     │  Core Engine     │
│  (Next.js 15 +   │────▶│  (Schema v1)    │────▶│  (TypeScript)    │
│   Zustand)       │     │                 │     │                  │
│                  │     │  metadata: {}   │     │  parser.ts       │
│  - Add blocks    │     │  structure: {}  │     │  → interpolate() │
│  - Style them    │     │  ast: [...]     │     │                  │
│  - Preview live  │     │                 │     │  pdfkit adapter  │
│  - Export JSON   │     │  Portable.      │     │  → renderToPdf() │
└─────────────────┘     │  Framework-      │     └──────────────────┘
                         │  agnostic.       │
                         └─────────────────┘
```

1. **Design** — Use the visual editor (or write JSON directly) to compose your document
2. **Inject** — Pass your real data (customer info, invoice items) into the AST
3. **Render** — The core engine compiles the AST + data into a polished PDF

---

## Project Structure

```
docflow/
├── apps/
│   └── web-builder/        # Visual editor (Next.js 15, App Router)
├── packages/
│   ├── core/               # Rendering engine (parser + adapters)
│   │   └── src/
│   │       ├── parser.ts           # Variable interpolation
│   │       ├── adapters/pdfkit.ts  # PDF output via pdfkit
│   │       └── constants.ts        # Page sizes, conversions
│   └── ts-config/          # Shared TypeScript configs
├── docs/
│   ├── DOCFLOW_PLAN.md     # Architecture & execution plan (ES)
│   └── CUSTOMIZATION_PLAN.md  # Full customization spec (ES)
├── .config/opencode/
│   └── AGENTS.md           # AI project configuration
├── .gemini/
│   └── INSTRUCTION.md      # Gemini project instructions
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

---

## Quick Start

### Prerequisites

- **Node.js** ≥20
- **pnpm** ≥9

```bash
# Clone the repository
git clone https://github.com/your-org/docflow.git
cd docflow

# Install dependencies
pnpm install

# Start development (all workspaces)
pnpm dev

# Or start only specific workspace
pnpm --filter web-builder dev
pnpm --filter core dev
```

Open [http://localhost:3000](http://localhost:3000) to access the visual editor.

---

## Usage

### 📦 As a Library (npm)

```bash
pnpm add @docflow/core
```

```typescript
import { renderToPdf } from '@docflow/core';
import { writeFileSync } from 'fs';

const schema = {
  metadata: {
    pageSize: 'A4',
    orientation: 'portrait',
    margins: { top: 40, bottom: 40, left: 50, right: 50 },
  },
  ast: [
    {
      id: 'blk_1',
      type: 'heading',
      level: 1,
      text: 'Invoice {{invoice.number}}',
      styles: { color: '#111827', fontSize: 24 },
    },
    {
      id: 'blk_2',
      type: 'paragraph',
      text: 'Customer: {{customer.name}}',
      styles: { color: '#4B5563', fontSize: 11 },
    },
  ],
};

const data = {
  invoice: { number: 'INV-2024-001' },
  customer: { name: 'Acme Corp' },
};

const doc = await renderToPdf(schema, data);
const chunks: Buffer[] = [];

doc.on('data', (chunk: Buffer) => chunks.push(chunk));
doc.on('end', () => {
  writeFileSync('output.pdf', Buffer.concat(chunks));
});
```

### 🖥️ As an Application

The visual editor runs at `apps/web-builder`. It provides a drag-and-drop interface for designing documents without writing code. Export your design as JSON AST, then render it with the core library.

```bash
pnpm --filter web-builder dev
```

---

## JSON AST Schema

The universal document format. Every DocFlow document is valid JSON following this structure:

```json
{
  "$schema": "https://docflow.dev/schemas/v1.json",
  "version": "1.0.0",
  "metadata": {
    "pageSize": "LETTER",
    "orientation": "portrait",
    "margins": { "top": 40, "bottom": 40, "left": 50, "right": 50 }
  },
  "structure": {
    "header": {
      "showOnFirstPage": false,
      "blocks": [{ "type": "text", "text": "CONFIDENTIAL", "align": "right" }]
    },
    "footer": {
      "showOnFirstPage": true,
      "blocks": [{ "type": "text", "text": "Page {{currentPage}} of {{totalPages}}", "align": "center" }]
    }
  },
  "ast": [
    {
      "id": "blk_1",
      "type": "heading",
      "level": 1,
      "text": "Hello {{customer.name}}",
      "styles": { "color": "#111827", "fontSize": 24 }
    },
    {
      "id": "blk_2",
      "type": "table",
      "loopOver": "invoice.items",
      "columns": [
        { "header": "Item", "width": "60%", "value": "{{item.description}}" },
        { "header": "Qty", "width": "15%", "value": "{{item.quantity}}" },
        { "header": "Total", "width": "25%", "value": "${{item.total}}" }
      ]
    }
  ]
}
```

**Supported block types:** `heading`, `paragraph`, `table`, `columns`, `image`, `divider`

**Interpolation:** `{{path.to.data}}` resolves from your data object. Supports dot notation, nested paths, and three variable scopes:
- **System**: `{{currentPage}}`, `{{totalPages}}`, `{{currentDate}}`
- **API data**: `{{customer.name}}`, `{{invoice.number}}`
- **Contextual**: `{{item.description}}` (inside table loops)

---

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all workspaces in development mode |
| `pnpm build` | Build all workspaces |
| `pnpm test` | Run all tests |
| `pnpm test:e2e` | Run end-to-end tests |
| `pnpm lint` | Lint all workspaces |
| `pnpm format` | Format code with Prettier |
| `pnpm typecheck` | Type-check all workspaces with `tsc --noEmit` |

---

## Design Standards

DocFlow's visual editor follows premium, accessibility-first design principles:

- **WCAG 2.1 AA** — minimum 4.5:1 contrast ratio, full keyboard navigation, ARIA live regions
- **Semantic HTML5** — `<header>`, `<main>`, `<aside>`, `<section>`, `<footer>` throughout
- **Tailwind CSS** — utility-first, atomic CSS output
- **Performance** — Zustand selectors prevent re-renders; client components only where needed

---

## Roadmap

- [x] JSON AST schema specification
- [x] Core engine: parser + pdfkit adapter
- [x] Visual editor: Next.js 15 + Zustand
- [x] Multi-column layout support
- [x] Dynamic headers & footers with page numbering
- [ ] HTML rendering adapter
- [ ] Image block support
- [ ] PDF download from the visual editor
- [ ] Template gallery & import/export
- [ ] i18n for the editor interface
- [ ] CLI tool (`docflow build`)

---

## Contributing

Contributions are welcome! Please read the existing docs in `docs/` and follow the monorepo conventions.

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Commit with conventional commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`)
4. Push and open a Pull Request

All PRs run automated checks: ESLint, TypeScript strict mode, Playwright + axe-core a11y audit, and Lighthouse CI.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | PNPM Workspaces + Turborepo |
| Frontend | Next.js 15 (App Router), Tailwind CSS |
| State | Zustand |
| Core | TypeScript, tsup (ESM + CJS) |
| PDF | pdfkit |
| Testing | Playwright, @axe-core/playwright, Vitest |
| CI/CD | GitHub Actions, Lighthouse CI |

---

## License

[MIT](LICENSE)

---

## Why DocFlow?

Most PDF generation libraries force you to write code — positioning elements pixel by pixel. DocFlow inverts that: **design visually, render programmatically**.

The JSON AST format means your document designs are:
- **Portable** — swap rendering engines without touching your templates
- **Versionable** — store designs in Git, diff them, review them
- **API-friendly** — generate documents on the server from any language
- **Human-readable** — debug and edit without special tools
