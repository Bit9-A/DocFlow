# Proposal: Tables + Template Interpolation

## Intent

Add table blocks with real data in canvas and PDF, plus `{{var}}` interpolation across text blocks. Currently tables render only preview rows with no data binding and template variables are unsupported.

## Scope

### In Scope
- Core PDFKit table adapter: preview row, null-item filtering, export paths
- `interpolate` in BlockRenderer for all text blocks
- `buildPreviewData` merging custom + uploaded JSON variables
- `TablePreviewRenderer` in canvas for resolved `loopOver` rows
- Table-aware code exporter: `cleanText`, `extractVariables`, `buildExportData`, full PDFKit table generation
- Core export paths (`package.json`, `tsup.config.ts`)
- Tests for all new/modified code meeting coverage thresholds

### Out of Scope
- Multi-page support, canvas page nav, drag-from-toolbar, alignment guides
- Table toolbar UI (column editing, loopOver config, style picker)
- HTML rendering adapter; `handleRemovePage` undo fix

## Capabilities

### New Capabilities
- `table-block`: Table rendering in canvas and PDF with variable-bound data rows
- `template-interpolation`: `{{var}}` resolution across heading, paragraph, image, header/footer blocks
- `code-export-tables`: PDFKit code generation for table blocks with mocked array data

### Modified Capabilities
None.

## Approach

Build on existing uncommitted code. Write tests first for uncovered paths, close edge cases, then commit: core adapter + tests → interpolation + tests → preview + tests → code exporter + tests.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/core/src/adapters/pdfkit/blocks/table.ts` | Modified | Preview row, null filtering, exports |
| `packages/core/src/engine/` | New | `buildPreviewData`, `interpolate` |
| `apps/web-builder/src/lib/buildPreviewData.ts` | New | Variable merge utility |
| `apps/web-builder/src/components/canvas/BlockRenderer.tsx` | Modified | TablePreviewRenderer integration |
| `apps/web-builder/src/lib/code-exporter.ts` | Modified | Table-aware export |
| `packages/core/package.json` + `tsup.config.ts` | Modified | Export paths |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Coverage thresholds (90% L, 90% F, 85% B) fail on untested code | High | Write tests before committing existing work |
| Table border rect uses fragile `doc.y` state | Medium | Extract y-tracking to explicit helper |
| Partially typed `{{var}}` renders as empty | Medium | Validate in interpolate; fallback to original text |

## Rollback Plan

Revert each work-unit commit independently via `git revert`. No DB migrations or irreversible changes.

## Dependencies

- `@docflow/core` table types already exported

## Success Criteria

- [ ] Vitest coverage ≥90% lines, ≥90% functions, ≥85% branches for new code
- [ ] Canvas renders table rows from resolved `loopOver` data
- [ ] Code exporter generates valid PDFKit table output
- [ ] `buildPreviewData` merges customVariables + uploadedJson + AST vars correctly
- [ ] `interpolate` resolves `{{var}}` in heading, paragraph, image, header, footer
- [ ] All existing tests pass
- [ ] No TypeScript errors (`pnpm typecheck`)
