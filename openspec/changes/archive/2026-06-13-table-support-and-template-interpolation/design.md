# Design: Table Blocks + Template Interpolation

## Technical Approach

Three-tier data resolution pipeline feeding a unified `interpolate()` engine consumed by both canvas preview and PDF rendering. Table blocks are the primary consumer — they resolve `loopOver` paths to data arrays, then interpolate `{{item.field}}` per cell. The code exporter mirrors this pipeline to generate standalone PDFKit scripts.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|-------------|-----------|
| Data merge priority | customVariables > uploadedJson > AST mock | Single layer, deep merge | Explicit vars always win; JSON payload is user data; mocks fill gaps without overwriting |
| Table cell context | `{ ...data, item: rowData }` augmentation | Flat object, isolated scope | Reuses existing `interpolate()` without API changes; `item` is predictable convention |
| Preview fallback | Empty object `[{}]` when loopOver missing | Skip table, show placeholder text | Canvas must never crash — raw templates render as-is in preview cells |
| Path resolution security | `resolvePayload` with depth limit + proto guard | `eval`/`Function` constructor | Prevents prototype pollution; depth limit avoids perf DoS |
| PDF border rect | Per-page draw with explicit y-tracking | Single rect at end | Multi-page tables need borders per page; y-tracking is fragile but workable |

## Data Flow

```
metadata.customVariables ──┐
                           ├─► buildPreviewData() ──► previewData (Record)
metadata.uploadedJson ─────┘          │
                                       │
     ┌─────────────────────────────────┤
     │                                 │
     ▼                                 ▼
BlockRenderer.tsx              code-exporter.ts
     │                                 │
  interpolate(text, data)         cleanText + extractVariables
     │                                 │
     ▼                                 ▼
  ▼ Resolved Text                ▼ exportToPdfKit() → `${data.var}`
     │
TablePreviewRenderer            PdfKit table adapter
     │                                 │
  resolvePayload(loopOver, data)   resolvePayload(loopOver, data)
     │                                 │
  previewRows.map(row, idx)           items.forEach(row, idx)
     │                                 │
  interpolate(col.value, {             resolve(col.value, { ...ctx,
    ...data, item: row })                  item: row })
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/core/src/parser/interpolate.ts` | Already exists | Core `interpolate` + `resolvePayload` + `extractVariables` — secure, tested |
| `packages/core/src/adapters/pdfkit/blocks/table.ts` | Already modified | Preview row fallback `[{}]`, null-item filter, per-page border, `resolvePayload` for loopOver |
| `packages/core/package.json` | Already modified | Added `./parser/interpolate` export entry |
| `packages/core/tsup.config.ts` | Already modified | Added `src/parser/interpolate.ts` as entry point |
| `apps/web-builder/src/lib/buildPreviewData.ts` | NEW | Merges `customVariables` + `uploadedJson` — 3-tier priority |
| `apps/web-builder/src/components/canvas/BlockRenderer.tsx` | Already modified | `interpolate()` calls on heading/paragraph/image/text; `TablePreviewRenderer` with `resolvePayload` + `loopOver` |
| `apps/web-builder/src/lib/code-exporter.ts` | Already modified | Table-aware `cleanText` (item.field → `items[rowIdx]?.field`), `extractVariables` with array mock gen, `buildExportData`, full table code gen |

## Interfaces / Contracts

```typescript
// Core interpolation — already defined and exported
function interpolate(template: string, data: Record<string, unknown>): string
function resolvePayload(path: string, obj: Record<string, unknown>): string
function extractVariables(template: string): string[]

// Preview data builder — NEW
function buildPreviewData(metadata: DocumentMetadata): Record<string, unknown>
// Priority: customVariables > uploadedJson (shallow merge) — no overwrite

// Code exporter — already modified
function exportToPdfKit(schema: DocFlowSchema, lang?: 'typescript' | 'javascript'): string
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (core) | `interpolate` / `resolvePayload` | **EXISTS** — 25 tests covering basic, security, edge cases. Add: table-context `{{item.field}}` against augmented data |
| Unit (core) | Table adapter `renderTable` | NEW — mock `PdfRenderContext`, verify: preview row on missing data, null filtering, border rect, page break header repeat |
| Unit (web-builder) | `buildPreviewData` | NEW — test priority: custom var > uploadedJson > mock; test invalid JSON ignored |
| Unit (web-builder) | `cleanText` table context | NEW — `{{item.name}}` → `${items[rowIdx]?.name ?? ''}`; plain `{{var}}` → `${data.var ?? ''}` |
| Unit (web-builder) | `buildExportData` | NEW — 3-tier merge; custom vars overwrite uploaded; AST mocks fill gaps |
| Unit (web-builder) | `extractVariables` table-aware | NEW — table columns produce `{ items: [{ name: "[name]" }] }` |
| Integration | PDFKit adapter with table | NEW — full schema with table block, verify buffer output, warning for missing data |

## Migration / Rollout

No migration required. All new code is additive — existing documents without tables or `{{var}}` patterns render identically. The `interpolate()` function returns the original string when no `{{}}` is present.

## Open Questions

- [ ] Table adapter y-tracking: `doc.y` is stateful across cells. Should we snapshot before header and restore? Low risk for single-row but fragile for multi-page.
- [ ] Code exporter table border rect calculates `headerEndY` via `doc.currentLineHeight()` — this assumes single-line headers. Multi-line headers will misalign the border rect.
