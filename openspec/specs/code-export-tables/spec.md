# Code Export — Tables Specification

## Purpose

Defines requirements for the PDFKit code exporter when generating table blocks with variable interpolation, mock data, and full table rendering code.

## Requirements

### Requirement: Table-Aware cleanText

`cleanText()` MUST generate JS template literal expressions for `{{var}}` inside table column values. When `tableCtx` is provided with `loopOver` and `itemVar`, it MUST produce `\${loopOver}[rowIdx]?.field ?? ''` expressions instead of `\${data.var ?? ''}`.

#### Scenario: Table column variable expression

- GIVEN a column value `{{item.price}}` with `tableCtx = { loopOver: "items", itemVar: "item" }`
- WHEN `cleanText()` processes the value
- THEN it returns `` `\${items[rowIdx]?.price ?? ''}` ``

#### Scenario: Plain block variable (no table context)

- GIVEN a heading text `"Hello {{name}}"`
- WHEN `cleanText()` is called without `tableCtx`
- THEN it returns `` `\${data.name ?? ''}` ``

### Requirement: Table-Aware extractVariables

`extractVariables()` MUST scan `table` block column values and headers for `{{var}}` references. When a column value references `itemVar.field`, it MUST create a mock array `{ loopOver: [{ field: "[field]" }] }` in the variables object. Non-table variables MUST be added as flat or nested mock values.

#### Scenario: Table mock data generation

- GIVEN an AST with a table block where `loopOver="products"` and a column value `{{item.price}}`
- WHEN `extractVariables()` is called
- THEN the result includes `{ products: [{ price: "[price]" }] }`

#### Scenario: Mixed table and non-table variables

- GIVEN an AST with a heading `{{title}}` and a table with `{{item.name}}` over `loopOver="items"`
- WHEN `extractVariables()` is called
- THEN the result includes both `{ title: "[title]" }` and `{ items: [{ name: "[name]" }] }`

### Requirement: Three-Tier Export Data Merge

`buildExportData()` MUST merge data in this precedence: `customVariables` (highest) > `uploadedJson` (shallow merge, does not overwrite custom) > `astVariables` (lowest). Invalid `uploadedJson` MUST be silently ignored.

#### Scenario: Uploaded JSON overrides AST mock vars

- GIVEN `customVariables = []`, `uploadedJson = '{"items": [{"name": "Real"}]}'`, and `astVariables = { "items": [{ "name": "[name]" }] }`
- WHEN `buildExportData()` is called
- THEN `data.items` is `[{ "name": "Real" }]` from the uploaded JSON

### Requirement: PDFKit Table Code Generation

The exporter MUST generate valid PDFKit code for table blocks including: column width calculations from percentage values, header row with background fill, data row loop with `\${loopOver}Data`, striped row support, and outer table border.

#### Scenario: Table with striped rows

- GIVEN a table block with `loopOver="items"`, `stripedRows=true`, and `stripedColor="#F3F4F6"`
- WHEN `renderBlockToCode()` is called for the table
- THEN the generated code includes row index parity check and conditional background fill for odd rows

#### Scenario: Table with custom column widths

- GIVEN a table block with two columns having `width="60"` and `width="40"`
- WHEN table code is generated
- THEN `colWidths` array contains `tableWidth * (60 / 100)` and `tableWidth * (40 / 100)`
