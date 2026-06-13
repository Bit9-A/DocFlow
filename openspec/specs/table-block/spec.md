# Table Block Specification

## Purpose

Defines requirements for rendering `table` blocks in canvas preview and PDF output, including data binding via `loopOver` paths and `{{item.field}}` variable interpolation against resolved data rows.

## Requirements

### Requirement: Canvas Table Preview

The canvas `TablePreviewRenderer` MUST render a table with resolved data rows when `loopOver` resolves to a non-empty array in preview data. When `loopOver` does not resolve to a non-empty array, it SHOULD render a single preview row showing raw column value templates.

#### Scenario: Happy path — table renders with resolved data

- GIVEN a table block with `loopOver="items"` and `columns` referencing `{{item.name}}` and `{{item.price}}`
- AND `previewData` contains `{ items: [{ name: "Widget", price: "$10" }, { name: "Gadget", price: "$20" }] }`
- WHEN `TablePreviewRenderer` renders the block
- THEN the table displays two data rows with resolved values "Widget", "$10", "Gadget", "$20"
- AND a row count indicator shows "2 rows in preview"

#### Scenario: No data — preview row with raw templates

- GIVEN a table block with `loopOver="items"` and columns referencing `{{item.name}}`
- AND `previewData` contains no `items` key or `items` is not an array
- WHEN `TablePreviewRenderer` renders the block
- THEN the table displays a single preview row showing raw `{{item.name}}` template text

### Requirement: PDFKit Table Adapter

The PDFKit table adapter MUST render a header row using `Helvetica-Bold` followed by data rows. When `loopOver` resolves to a non-null array, it MUST iterate all items, filtering out null entries. When the array is empty or not an array, it MUST render a single preview row with column headers visible and emit a `TABLE_NO_DATA` warning.

#### Scenario: Data rows with null filtering

- GIVEN a table block with `loopOver="orders"` containing `[{ id: "1" }, null, { id: "2" }]`
- WHEN the PDFKit adapter renders the table
- THEN it renders two data rows (filtering out the null entry)
- AND each cell resolves `{{item.id}}` against its respective row data

#### Scenario: Empty array fallback

- GIVEN a table block with `loopOver="emptyItems"` resolving to `[]`
- WHEN the PDFKit adapter renders the table
- THEN it renders one preview row with resolved template values (falling back to empty string for unresolved variables)
- AND a `TABLE_NO_DATA` warning is emitted

### Requirement: Table Data Binding

The system MUST resolve `{{item.field}}` variables inside `columns[].value` against each row object in the resolved `loopOver` array. Nested paths (e.g., `{{item.address.city}}`) MUST be supported. When `item` is undefined for a cell, it MUST render an empty string.

#### Scenario: Nested variable paths in table cells

- GIVEN a table block with `loopOver="users"` and a column value `{{item.profile.name}}`
- AND data `{ users: [{ profile: { name: "Alice" } }] }`
- WHEN a cell renders
- THEN the cell shows "Alice"

#### Scenario: Undefined field renders empty

- GIVEN a column value `{{item.missing}}` where `rowData` has no `missing` key
- WHEN the cell is rendered
- THEN the cell shows an empty string
