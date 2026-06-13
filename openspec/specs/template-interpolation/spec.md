# Template Interpolation Specification

## Purpose

Defines requirements for `{{var}}` variable resolution across all text-bearing blocks, the preview data merge pipeline, and supported variable scopes.

## Requirements

### Requirement: Block-Level Variable Resolution

The `interpolate()` function MUST resolve `{{path.to.variable}}` templates against the provided data object. It MUST be applied to: `heading.text`, `paragraph.text`, `image.src`, `image.alt`, and text content inside `header` and `footer` sub-blocks.

#### Scenario: Simple variable in heading

- GIVEN a heading block with text `"Welcome, {{name}}!"`
- AND `previewData = { name: "Alice" }`
- WHEN `BlockRenderer` renders the heading
- THEN the displayed text is "Welcome, Alice!"

#### Scenario: Nested path in image src

- GIVEN an image block with `src="{{company.logoUrl}}"`
- AND `previewData = { company: { logoUrl: "https://example.com/logo.png" } }`
- WHEN the image renders
- THEN the `<img>` src attribute is `"https://example.com/logo.png"`

#### Scenario: Missing variable

- GIVEN a paragraph block with text `"Status: {{unknownVar}}"`
- AND `previewData` contains no `unknownVar` property
- WHEN the paragraph renders
- THEN the displayed text is "Status: " (empty string for unresolvable variable)

### Requirement: Preview Data Merge Order

`buildPreviewData()` MUST merge variable sources in this precedence: `customVariables` (highest) > `uploadedJson` (shallow merge) > AST mock variables. Explicit custom variables MUST NOT be overwritten by uploaded JSON values.

#### Scenario: Custom variable overrides uploaded JSON

- GIVEN `metadata.customVariables = [{ key: "title", value: "Custom Title" }]`
- AND `metadata.uploadedJson = '{"title": "JSON Title"}'`
- WHEN `buildPreviewData()` is called
- THEN `data.title` is `"Custom Title"`

#### Scenario: Invalid uploaded JSON is silently ignored

- GIVEN `metadata.uploadedJson = "not valid json"`
- WHEN `buildPreviewData()` is called
- THEN no error is thrown and only `customVariables` populate the data

### Requirement: Variable Scopes

The system MUST support three variable scopes: **system** (e.g., `{{currentPage}}`, `{{totalPages}}` injected at render time), **API/global data** (e.g., `{{customer.name}}` from uploaded JSON or custom variables), and **contextual/loop** (e.g., `{{item.description}}` resolved against the current row in table loop blocks).

#### Scenario: System variable in footer

- GIVEN a footer sub-block with text `"Page {{currentPage}} of {{totalPages}}"`
- AND the render context provides `{ currentPage: 1, totalPages: 3 }`
- WHEN the footer text is interpolated
- THEN it renders "Page 1 of 3"

#### Scenario: Contextual item variable in table cell

- GIVEN a table column with value `{{item.description}}`
- AND the current row data is `{ description: "Premium widget" }`
- WHEN the cell is rendered (passing `{ ...previewData, item: rowData }`)
- THEN the cell shows "Premium widget"
