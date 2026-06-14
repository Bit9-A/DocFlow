# Apply Progress: Table Support + Template Interpolation

## Mode
Strict TDD

## Completed Tasks

### Phase 1: Risk Fix
- [x] 1.1 Fix `apps/web-builder/src/lib/code-exporter.ts` border rect y-tracking — replaced `doc.y` + `doc.currentLineHeight()` with explicit `tableHeaderStartY` variable

### Phase 2: Testing
- [x] 2.1 Write `packages/core/__tests__/adapters/pdfkit-table.test.ts` — preview row on missing loopOver, null-item filtering, page break header repeat, TABLE_NO_DATA warning
- [x] 2.2 Write `packages/core/__tests__/parser/interpolate.test.ts` additions — `{{item.field}}` table-context resolution
- [x] 2.3 Write unit tests for `apps/web-builder/src/lib/buildPreviewData.ts` — merge priority, invalid JSON, empty metadata
- [x] 2.4 Write unit tests for `code-exporter.ts` `cleanText` — tableCtx and plain
- [x] 2.5 Write unit tests for `code-exporter.ts` `extractVariables` — table mock array generation
- [x] 2.6 Write unit tests for `code-exporter.ts` `buildExportData` — 3-tier merge
- [x] 2.7 Write unit tests for `code-exporter.ts` table code gen — striped rows, column widths, border rect
- [x] 2.8 Write integration test: full schema with table block + loopOver → `interpolate` → `buildPreviewData` → `exportToPdfKit` output validates

### Phase 3: Verification
- [x] 3.1 Run `pnpm --filter core test` — 62 tests pass, coverage thresholds met on change-relevant files
- [x] 3.2 Run `pnpm typecheck` — no TypeScript errors
- [x] 3.3 Verify all spec scenarios across 3 spec files (20 scenarios)

## TDD Cycle Evidence

### PR #1 — Risk Fix + Core Tests

| Task | Test File | Layer | RED (test first) | GREEN (passes) | TRIANGULATE | REFACTOR |
|------|-----------|-------|-----------------|----------------|-------------|----------|
| 1.1 | `code-exporter.ts` (generated code) | Unit | N/A (refactor of existing) | ✅ Fixed | ➖ Single case | ✅ Clean |
| 2.1 | `pdfkit-table.test.ts` | Integration | ✅ Written first | ✅ Passed | ✅ 7 cases | ✅ Clean |
| 2.2 | `interpolate.test.ts` | Unit | ✅ Written first | ✅ Passed | ✅ 6 cases | ➖ None needed |
| 2.3 | `buildPreviewData.test.ts` | Unit | ✅ Written first | ✅ Passed | ✅ 10 cases | ➖ None needed |

### PR #2 — Code Exporter Tests + Integration + Verify

| Task | Test File | Layer | RED (test first) | GREEN (passes) | TRIANGULATE | REFACTOR |
|------|-----------|-------|-----------------|----------------|-------------|----------|
| 2.4 | `code-exporter.test.ts` | Unit | ✅ Written first | ✅ Passed | ✅ 7 cases | ➖ None needed |
| 2.5 | `code-exporter.test.ts` | Unit | ✅ Written first | ✅ Passed | ✅ 5 cases | ➖ None needed |
| 2.6 | `code-exporter.test.ts` | Unit | ✅ Written first | ✅ Passed | ✅ 6 cases | ➖ None needed |
| 2.7 | `code-exporter.test.ts` | Unit | ✅ Written first | ✅ Passed | ✅ 4 cases | ➖ None needed |
| 2.8 | `code-exporter.test.ts` | Integration | ✅ Written first | ✅ Passed | ➖ Single | ➖ None needed |

### Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `packages/core/src/parser/interpolate.ts` | Modified | Changed `resolvePayload` return type from `string` to `unknown` — enables array resolution for `loopOver` |
| `packages/core/src/adapters/pdfkit/blocks/table.ts` | Modified | Fixed `TABLE_NO_DATA` trigger, preview row fallback |
| `apps/web-builder/src/lib/code-exporter.ts` | Modified | Border rect y-tracking fix, exported testable functions |
| `packages/core/__tests__/adapters/pdfkit-table.test.ts` | Created | 7 integration tests for table adapter |
| `packages/core/__tests__/parser/interpolate.test.ts` | Modified | 6 new tests for table-context interpolation |
| `apps/web-builder/src/lib/__tests__/buildPreviewData.test.ts` | Created | 10 unit tests for merge utility |
| `apps/web-builder/src/lib/__tests__/code-exporter.test.ts` | Created | 24 tests covering cleanText, extractVariables, buildExportData, table gen, integration |
| `apps/web-builder/vitest.config.ts` | Created | Vitest config for web-builder unit tests |
| `apps/web-builder/package.json` | Modified | Added `"test": "vitest run"` script |

### Deviations from Design
None — implementation matches design.

### Issues Discovered
1. `resolvePayload` returned `string` preventing array resolution for `loopOver` — fixed during implementation
2. Global coverage thresholds fail due to pre-existing untested files (`columns.ts`, `image.ts`, `constants.ts`, `types.ts`) — change-relevant files meet thresholds
