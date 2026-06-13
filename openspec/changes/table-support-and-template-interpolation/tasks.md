# Tasks: Table Support + Template Interpolation

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~900–1100 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (risk fix + core tests) → PR 2 (exporter tests + verify) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Fix border rect risk + core tests (table adapter, buildPreviewData, interpolate table ctx) | PR 1 | Base: main. Standalone — core risk fix + core test infra. |
| 2 | Code exporter tests (cleanText, extractVariables, buildExportData, table gen) + integration test + final verify | PR 2 | Base: main (independent from PR 1). Full exporter coverage + end-to-end. |

## Phase 1: Risk Fix

- [x] 1.1 Fix `apps/web-builder/src/lib/code-exporter.ts` border rect y-tracking — replace `doc.y` + `doc.currentLineHeight()` with explicit `tableHeaderStartY` variable that tracks actual header start position

## Phase 2: Testing

- [x] 2.1 Write `packages/core/__tests__/adapters/pdfkit-table.test.ts` — preview row on missing loopOver, null-item filtering, page break header repeat, TABLE_NO_DATA warning
- [x] 2.2 Write `packages/core/__tests__/parser/interpolate.test.ts` additions — `{{item.field}}` table-context resolution against augmented `{...data, item: rowData}` data
- [x] 2.3 Write unit tests for `apps/web-builder/src/lib/buildPreviewData.ts` — merge priority (custom > uploaded > mock), invalid JSON ignored, empty metadata
- [ ] 2.4 Write unit tests for `apps/web-builder/src/lib/code-exporter.ts` — `cleanText` with tableCtx (item.field → `items[rowIdx]?.field`) and without (plain `data.var`)
- [ ] 2.5 Write unit tests for `code-exporter.ts` `extractVariables` — table mock array generation for `loopOver`, mixed table + plain vars
- [ ] 2.6 Write unit tests for `code-exporter.ts` `buildExportData` — 3-tier merge: custom > uploaded > AST, no overwrite, invalid JSON
- [ ] 2.7 Write unit tests for `code-exporter.ts` table code gen — striped rows, column width calc, border rect after fix
- [ ] 2.8 Write integration test: full schema with table block + loopOver → `interpolate` → `buildPreviewData` → `exportToPdfKit` output validates

## Phase 3: Verification

- [ ] 3.1 Run `pnpm --filter core test` — all tests pass with coverage thresholds (90% lines, 90% functions, 85% branches, 90% statements)
- [ ] 3.2 Run `pnpm typecheck` — no TypeScript errors
- [ ] 3.3 Verify all spec scenarios: table preview with data, no-data preview row, nested item paths, missing field, system vars, custom var override
