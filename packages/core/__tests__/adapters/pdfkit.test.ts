import { describe, it, expect } from 'vitest';
import { PdfKitAdapter } from '../../src/adapters/pdfkit/index.js';
import type { DocFlowSchema } from '../../src/schema/types.js';

describe('PdfKitAdapter Integration Tests', () => {
  const adapter = new PdfKitAdapter();

  const mockSchema: DocFlowSchema = {
    $schema: 'https://docflow.dev/schemas/v1.json',
    version: '1.0.0',
    metadata: {
      title: 'Test Invoice',
      pageSize: 'LETTER',
      orientation: 'portrait',
      margins: { top: 40, bottom: 40, left: 50, right: 50 },
    },
    ast: [
      {
        id: 'blk_1',
        type: 'heading',
        level: 1,
        text: 'Invoice for {{client.name}}',
        styles: { fontSize: 24, color: '#111827', marginBottom: 12 },
      },
      {
        id: 'blk_2',
        type: 'paragraph',
        text: 'Thank you for your business, {{client.name}}! Total: ${{total}}',
        styles: { fontSize: 11, color: '#374151', lineHeight: 1.5 },
      },
      {
        id: 'blk_3',
        type: 'divider',
        styles: { color: '#E5E7EB', thickness: 2, marginTop: 10, marginBottom: 10 },
      },
      {
        id: 'blk_4',
        type: 'spacer',
        height: 20,
        styles: {},
      },
      {
        id: 'blk_5',
        type: 'page-break',
        styles: {},
      },
      {
        id: 'blk_6',
        type: 'paragraph',
        text: 'This is page 2',
        styles: { fontSize: 11 },
      },
    ],
  };

  const mockData = {
    client: { name: 'Acme Corp' },
    total: 1500,
  };

  it('should successfully compile AST schema to a PDF Buffer', async () => {
    const result = await adapter.render(mockSchema, mockData);

    expect(result.output).toBeInstanceOf(Buffer);
    expect(result.output.length).toBeGreaterThan(0);
    expect(result.metadata.blocksProcessed).toBe(6);
    expect(result.metadata.pageCount).toBe(2);
    expect(result.warnings).toEqual([]);
  });

  it('should handle rendering an empty AST schema gracefully', async () => {
    const emptySchema: DocFlowSchema = {
      ...mockSchema,
      ast: [],
    };

    const result = await adapter.render(emptySchema, {});
    expect(result.output).toBeInstanceOf(Buffer);
    expect(result.output.length).toBeGreaterThan(0);
    expect(result.metadata.blocksProcessed).toBe(0);
    expect(result.metadata.pageCount).toBe(1);
  });

  it('should successfully compile AST with absolute coordinates', async () => {
    const coordsSchema: DocFlowSchema = {
      ...mockSchema,
      ast: [
        {
          id: 'blk_coords_1',
          type: 'heading',
          level: 1,
          text: 'Absolute Heading',
          styles: { fontSize: 20 },
          x: 100,
          y: 150,
          width: 300,
          height: 40,
          page: 0,
        },
        {
          id: 'blk_coords_2',
          type: 'paragraph',
          text: 'Absolute Paragraph on Page 2',
          styles: { fontSize: 12 },
          x: 50,
          y: 100,
          width: 200,
          height: 100,
          page: 1,
        },
      ],
    };

    const result = await adapter.render(coordsSchema, {});
    expect(result.output).toBeInstanceOf(Buffer);
    expect(result.output.length).toBeGreaterThan(0);
    expect(result.metadata.blocksProcessed).toBe(2);
    expect(result.metadata.pageCount).toBe(2);
  });
});
