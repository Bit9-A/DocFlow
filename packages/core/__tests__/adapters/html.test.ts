import { describe, it, expect } from 'vitest';
import { HtmlAdapter } from '../../src/adapters/html/index.js';
import type { DocFlowSchema } from '../../src/schema/types.js';

describe('HtmlAdapter Integration Tests', () => {
  const adapter = new HtmlAdapter();

  const mockSchema: DocFlowSchema = {
    $schema: 'https://docflow.dev/schemas/v1.json',
    version: '1.0.0',
    metadata: {
      title: 'HTML Test Doc',
      pageSize: 'LETTER',
      orientation: 'portrait',
      margins: { top: 40, bottom: 40, left: 50, right: 50 },
    },
    ast: [
      {
        id: 'blk_1',
        type: 'heading',
        level: 2,
        text: 'Title: {{doc.title}}',
        styles: { fontSize: 20, color: '#3182CE' },
      },
      {
        id: 'blk_2',
        type: 'paragraph',
        text: 'Hello, this is standard text.',
        styles: { fontSize: 12 },
      },
      {
        id: 'blk_3',
        type: 'divider',
        styles: { color: '#000000', thickness: 1 },
      },
      {
        id: 'blk_4',
        type: 'spacer',
        height: 15,
        styles: {},
      },
    ],
  };

  const mockData = {
    doc: { title: 'Integration Test' },
  };

  it('should compile AST to an HTML string with interpolated variables', async () => {
    const result = await adapter.render(mockSchema, mockData);

    expect(typeof result.output).toBe('string');
    expect(result.output).toContain('<html');
    expect(result.output).toContain('Title: Integration Test');
    expect(result.output).toContain('Hello, this is standard text.');
    expect(result.output).toContain('border-top:1px solid #000000');
    expect(result.metadata.blocksProcessed).toBe(4);
    expect(result.metadata.pageCount).toBe(1);
    expect(result.warnings).toEqual([]);
  });

  it('should automatically escape HTML variables to prevent XSS', async () => {
    const maliciousData = {
      doc: { title: '<script>alert("xss")</script>' },
    };

    const result = await adapter.render(mockSchema, maliciousData);
    expect(result.output).not.toContain('<script>');
    expect(result.output).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });
});
