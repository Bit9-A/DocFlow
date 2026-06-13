import { describe, it, expect } from 'vitest';
import {
  cleanText,
  extractVariables,
  buildExportData,
  renderBlockToCode,
} from '../code-exporter.js';
import { exportToPdfKit } from '../code-exporter.js';
import type { DocFlowSchema, DocBlock } from '@docflow/core';

// ============================================================
// Task 2.4 — cleanText
// ============================================================

describe('cleanText', () => {
  it('replaces plain {{var}} with ${data.var ?? ""} when no tableCtx', () => {
    const result = cleanText('Hello {{name}}');
    expect(result).toBe('`Hello ${data.name ?? \'\'}`');
  });

  it('replaces table-context {{item.field}} with ${loopOver[rowIdx]?.field ?? ""}', () => {
    const result = cleanText('{{item.price}}', { loopOver: 'items', itemVar: 'item' });
    expect(result).toBe('`${items[rowIdx]?.price ?? \'\'}`');
  });

  it('handles nested plain paths with optional chaining', () => {
    const result = cleanText('{{user.name}}');
    expect(result).toBe('`${data.user?.name ?? \'\'}`');
  });

  it('returns JSON-stringified string when no {{}} interpolation', () => {
    const result = cleanText('Hello, World!');
    expect(result).toBe('"Hello, World!"');
  });

  it('handles multiple interpolations in one string', () => {
    const result = cleanText('{{a}} and {{b}}');
    expect(result).toBe('`${data.a ?? \'\'} and ${data.b ?? \'\'}`');
  });

  it('handles table-context nested path: item.user.name → items[rowIdx]?.user?.name', () => {
    const result = cleanText('{{item.user.name}}', { loopOver: 'items', itemVar: 'item' });
    expect(result).toBe('`${items[rowIdx]?.user?.name ?? \'\'}`');
  });

  it('ignores non-itemVar paths when tableCtx is present', () => {
    const result = cleanText('{{title}} and {{item.price}}', {
      loopOver: 'items',
      itemVar: 'item',
    });
    expect(result).toBe('`${data.title ?? \'\'} and ${items[rowIdx]?.price ?? \'\'}`');
  });
});

// ============================================================
// Task 2.5 — extractVariables
// ============================================================

describe('extractVariables', () => {
  it('generates mock array for table loopOver with item field', () => {
    const ast: DocBlock[] = [
      {
        id: 't1',
        type: 'table',
        loopOver: 'products',
        columns: [
          { header: 'Price', width: '100%', value: '{{item.price}}' },
        ],
        styles: {},
      },
    ];

    const result = extractVariables(ast);
    expect(result).toEqual({ products: [{ price: '[price]' }] });
  });

  it('extracts mixed table and non-table variables', () => {
    const ast: DocBlock[] = [
      {
        id: 'h1',
        type: 'heading',
        text: '{{title}}',
        level: 1,
        styles: {},
      },
      {
        id: 't1',
        type: 'table',
        loopOver: 'items',
        columns: [
          { header: 'Name', width: '100%', value: '{{item.name}}' },
        ],
        styles: {},
      },
    ];

    const result = extractVariables(ast);
    expect(result.title).toBe('[title]');
    expect(result.items).toEqual([{ name: '[name]' }]);
  });

  it('extracts non-table variables from text, src, alt fields', () => {
    const ast: DocBlock[] = [
      {
        id: 'p1',
        type: 'paragraph',
        text: 'Welcome {{user}}',
        styles: {},
      },
      {
        id: 'i1',
        type: 'image',
        src: '{{imageUrl}}',
        alt: '{{altText}}',
        styles: {},
      },
    ];

    const result = extractVariables(ast);
    expect(result.user).toBe('[user]');
    expect(result.imageUrl).toBe('[imageUrl]');
    expect(result.altText).toBe('[altText]');
  });

  it('detects itemVar dynamically from column value prefix', () => {
    const ast: DocBlock[] = [
      {
        id: 't1',
        type: 'table',
        loopOver: 'products',
        columns: [
          { header: 'Name', width: '50%', value: '{{product.name}}' },
          { header: 'Price', width: '50%', value: '{{product.price}}' },
        ],
        styles: {},
      },
    ];

    const result = extractVariables(ast);
    expect(result.products).toEqual([{ name: '[name]', price: '[price]' }]);
  });

  it('handles nested non-table paths', () => {
    const ast: DocBlock[] = [
      {
        id: 'p1',
        type: 'paragraph',
        text: '{{company.address.city}}',
        styles: {},
      },
    ];

    const result = extractVariables(ast);
    expect(result).toEqual({ company: { address: { city: '[city]' } } });
  });
});

// ============================================================
// Task 2.6 — buildExportData
// ============================================================

const baseSchema: DocFlowSchema = {
  $schema: 'https://docflow.dev/schemas/v1.json',
  version: '1.0.0',
  metadata: {
    title: 'Test',
    pageSize: 'LETTER',
    orientation: 'portrait',
    margins: { top: 40, bottom: 40, left: 50, right: 50 },
    customVariables: [],
    uploadedJson: '',
  },
  ast: [],
};

describe('buildExportData', () => {
  it('gives customVariables highest priority over uploadedJson and AST', () => {
    const schema: DocFlowSchema = {
      ...baseSchema,
      metadata: {
        ...baseSchema.metadata,
        customVariables: [{ key: 'title', value: 'Custom Title' }],
        uploadedJson: JSON.stringify({ title: 'JSON Title', name: 'From JSON' }),
      },
    };
    const astVariables = { title: '[title]', name: '[name]', extra: '[extra]' };

    const result = buildExportData(schema, astVariables);

    // Custom wins
    expect(result.title).toBe('Custom Title');
    // Uploaded fills in where custom doesn't exist
    expect(result.name).toBe('From JSON');
    // AST fills in where neither custom nor uploaded exist
    expect(result.extra).toBe('[extra]');
  });

  it('does not allow uploadedJson to overwrite customVariables', () => {
    const schema: DocFlowSchema = {
      ...baseSchema,
      metadata: {
        ...baseSchema.metadata,
        customVariables: [{ key: 'title', value: 'EXPLICIT' }],
        uploadedJson: JSON.stringify({ title: 'OVERWRITE' }),
      },
    };

    const result = buildExportData(schema, {});
    expect(result.title).toBe('EXPLICIT');
  });

  it('silently ignores invalid uploadedJson', () => {
    const schema: DocFlowSchema = {
      ...baseSchema,
      metadata: {
        ...baseSchema.metadata,
        customVariables: [{ key: 'name', value: 'Test' }],
        uploadedJson: 'not valid json',
      },
    };

    const result = buildExportData(schema, {});
    expect(result.name).toBe('Test');
  });

  it('uses AST variables when neither custom nor uploaded provide data', () => {
    const schema: DocFlowSchema = {
      ...baseSchema,
      metadata: {
        ...baseSchema.metadata,
        customVariables: [],
        uploadedJson: '',
      },
    };
    const astVariables = { fallback: '[fallback]' };

    const result = buildExportData(schema, astVariables);
    expect(result.fallback).toBe('[fallback]');
  });

  it('returns empty object when all sources are empty', () => {
    const result = buildExportData(baseSchema, {});
    expect(result).toEqual({});
  });

  it('does not merge uploadedJson that parses to non-object (string)', () => {
    const schema: DocFlowSchema = {
      ...baseSchema,
      metadata: {
        ...baseSchema.metadata,
        uploadedJson: JSON.stringify('just a string'),
      },
    };

    const result = buildExportData(schema, {});
    expect(result).toEqual({});
  });
});

// ============================================================
// Task 2.7 — renderBlockToCode table code generation
// ============================================================

describe('renderBlockToCode — table', () => {
  it('generates column widths from percentage values', () => {
    const block: DocBlock = {
      id: 't1',
      type: 'table',
      loopOver: 'items',
      columns: [
        { header: 'Name', width: '60', value: '{{item.name}}' },
        { header: 'Price', width: '40', value: '{{item.price}}' },
      ],
      styles: {},
    };

    const code = renderBlockToCode(block, baseSchema, '');
    expect(code).toContain('tableWidth * (60 / 100)');
    expect(code).toContain('tableWidth * (40 / 100)');
  });

  it('generates striped row parity check when stripedRows is true', () => {
    const block: DocBlock = {
      id: 't2',
      type: 'table',
      loopOver: 'items',
      columns: [
        { header: 'Col', width: '100', value: '{{item.val}}' },
      ],
      styles: { stripedRows: true, stripedColor: '#F3F4F6' },
    };

    const code = renderBlockToCode(block, baseSchema, '');
    expect(code).toContain('rowIdx % 2 === 1');
    expect(code).toContain('#F3F4F6');
  });

  it('does not generate stripe fill code when stripedRows is false', () => {
    const block: DocBlock = {
      id: 't3',
      type: 'table',
      loopOver: 'items',
      columns: [
        { header: 'Col', width: '100', value: '{{item.val}}' },
      ],
      styles: { stripedRows: false },
    };

    const code = renderBlockToCode(block, baseSchema, '');
    // When stripedRows is false, the `if (isOdd)` wrapper block is NOT generated
    expect(code).not.toContain('if (isOdd)');
  });

  it('generates border rect using tableHeaderStartY after fix', () => {
    const block: DocBlock = {
      id: 't4',
      type: 'table',
      loopOver: 'items',
      columns: [
        { header: 'Col', width: '100', value: '{{item.val}}' },
      ],
      styles: {},
    };

    const code = renderBlockToCode(block, baseSchema, '');
    // Must reference tableHeaderStartY (not doc.y directly)
    expect(code).toContain('tableHeaderStartY');
    expect(code).toContain('.rect(tableStartX, tableHeaderStartY');
  });
});

// ============================================================
// Task 2.8 — Integration test
// ============================================================

describe('Integration: full schema → code export', () => {
  it('generates valid PDFKit code for schema with table + loopOver', () => {
    const schema: DocFlowSchema = {
      $schema: 'https://docflow.dev/schemas/v1.json',
      version: '1.0.0',
      metadata: {
        title: 'Integration Test',
        pageSize: 'LETTER',
        orientation: 'portrait',
        margins: { top: 40, bottom: 40, left: 50, right: 50 },
        customVariables: [{ key: 'company', value: 'Acme Corp' }],
        uploadedJson: JSON.stringify({
          items: [
            { name: 'Widget', price: '$10' },
            { name: 'Gadget', price: '$20' },
          ],
        }),
      },
      ast: [
        {
          id: 'h1',
          type: 'heading',
          text: '{{company}} Report',
          level: 1,
          styles: {},
        },
        {
          id: 't1',
          type: 'table',
          loopOver: 'items',
          columns: [
            { header: 'Product', width: '60', value: '{{item.name}}' },
            { header: 'Price', width: '40', value: '{{item.price}}' },
          ],
          styles: {
            stripedRows: true,
            stripedColor: '#F3F4F6',
            borderWidth: 1,
            borderColor: '#E5E7EB',
          },
        },
      ],
    };

    const code = exportToPdfKit(schema, 'javascript');

    // Verify structural elements
    expect(code).toContain('const data =');
    expect(code).toContain('function generatePDF()');
    expect(code).toContain('new PDFDocument');

    // Verify plain {{company}} → ${data.company ?? ''}
    expect(code).toContain('${data.company ?? \'\'}');

    // Verify table code has proper expressions
    expect(code).toContain('// Table data rows (loop over items)');
    expect(code).toContain('const itemsData = data.items ?? []');
    expect(code).toContain('tableWidth * (60 / 100)');
    expect(code).toContain('tableWidth * (40 / 100)');
    expect(code).toContain('rowIdx % 2 === 1');
    expect(code).toContain('#F3F4F6');
    expect(code).toContain('tableHeaderStartY');
    expect(code).toContain('.rect(tableStartX, tableHeaderStartY');

    // Verify the interpolation expression uses items[rowIdx]
    expect(code).toContain('items[rowIdx]?.name');
    expect(code).toContain('items[rowIdx]?.price');

    // Verify border rect uses correct y reference
    expect(code).toContain('doc.y - tableHeaderStartY');
  });

  it('includes data declaration with merged custom + uploaded + AST vars', () => {
    const schema: DocFlowSchema = {
      $schema: 'https://docflow.dev/schemas/v1.json',
      version: '1.0.0',
      metadata: {
        title: 'Merge Test',
        pageSize: 'LETTER',
        orientation: 'portrait',
        margins: { top: 40, bottom: 40, left: 50, right: 50 },
        customVariables: [{ key: 'title', value: 'My Report' }],
        uploadedJson: JSON.stringify({ items: [{ name: 'A', price: '1' }] }),
      },
      ast: [
        {
          id: 'h1',
          type: 'heading',
          text: '{{title}}',
          level: 1,
          styles: {},
        },
        {
          id: 't1',
          type: 'table',
          loopOver: 'items',
          columns: [
            { header: 'Name', width: '100', value: '{{item.name}}' },
          ],
          styles: {},
        },
      ],
    };

    const code = exportToPdfKit(schema, 'javascript');

    // The merged data should include custom title and uploaded items
    expect(code).toContain('"title": "My Report"');
    expect(code).toContain('"items"');
    expect(code).toContain('"name": "A"');
  });
});
