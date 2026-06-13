import { describe, it, expect } from 'vitest';
import { buildPreviewData } from '../buildPreviewData.js';

// Inline DocumentMetadata shape for testing
interface TestMetadata {
  title?: string;
  customVariables?: Array<{ key: string; value: string }>;
  uploadedJson?: string;
  [key: string]: unknown;
}

describe('buildPreviewData', () => {
  // ============================================================
  // Priority: customVariables > uploadedJson
  // ============================================================

  it('gives customVariables priority over uploadedJson', () => {
    const metadata: TestMetadata = {
      customVariables: [
        { key: 'title', value: 'Custom Title' },
        { key: 'author', value: 'Custom Author' },
      ],
      uploadedJson: JSON.stringify({
        title: 'JSON Title',
        price: 100,
      }),
    };

    const result = buildPreviewData(metadata as any);

    // customVariables should win
    expect(result.title).toBe('Custom Title');
    expect(result.author).toBe('Custom Author');
    // uploadedJson values that don't conflict should appear
    expect(result.price).toBe(100);
  });

  // ============================================================
  // Invalid JSON is silently ignored
  // ============================================================

  it('silently ignores invalid uploadedJson', () => {
    const metadata: TestMetadata = {
      customVariables: [{ key: 'name', value: 'Test' }],
      uploadedJson: 'not valid json at all',
    };

    const result = buildPreviewData(metadata as any);

    // custom variable still resolves
    expect(result.name).toBe('Test');
    // no error is thrown
    expect(Object.keys(result)).toHaveLength(1);
  });

  // ============================================================
  // Empty metadata
  // ============================================================

  it('returns empty object when metadata has no variables', () => {
    const result = buildPreviewData({} as any);
    expect(result).toEqual({});
  });

  it('returns empty object when customVariables is empty and uploadedJson is empty', () => {
    const metadata: TestMetadata = {
      customVariables: [],
      uploadedJson: '',
    };

    const result = buildPreviewData(metadata as any);
    expect(result).toEqual({});
  });

  // ============================================================
  // uploadedJson null/object parsing
  // ============================================================

  it('ignores uploadedJson when it is a non-object (string)', () => {
    const metadata: TestMetadata = {
      uploadedJson: JSON.stringify('just a string'),
    };

    const result = buildPreviewData(metadata as any);
    expect(result).toEqual({});
  });

  it('ignores uploadedJson when it parses to null', () => {
    const metadata: TestMetadata = {
      uploadedJson: 'null',
    };

    const result = buildPreviewData(metadata as any);
    expect(result).toEqual({});
  });

  it('handles uploadedJson array by spreading its entries', () => {
    const metadata: TestMetadata = {
      uploadedJson: JSON.stringify([1, 2, 3]),
    };

    const result = buildPreviewData(metadata as any);
    // Arrays are treated as objects by Object.entries,
    // so numeric indices become keys
    expect(result['0']).toBe(1);
    expect(result['1']).toBe(2);
    expect(result['2']).toBe(3);
  });

  // ============================================================
  // customVariables only
  // ============================================================

  it('builds data from customVariables only when no uploadedJson', () => {
    const metadata: TestMetadata = {
      customVariables: [
        { key: 'client', value: 'Acme Corp' },
        { key: 'amount', value: '5000' },
      ],
    };

    const result = buildPreviewData(metadata as any);
    expect(result.client).toBe('Acme Corp');
    expect(result.amount).toBe('5000');
  });

  // ============================================================
  // uploadedJson only (no custom variables)
  // ============================================================

  it('builds data from uploadedJson only when no customVariables', () => {
    const metadata: TestMetadata = {
      uploadedJson: JSON.stringify({
        products: [{ name: 'Widget' }],
        total: 250,
      }),
    };

    const result = buildPreviewData(metadata as any);
    expect(result.products).toEqual([{ name: 'Widget' }]);
    expect(result.total).toBe(250);
  });

  // ============================================================
  // Whitespace-only uploadedJson
  // ============================================================

  it('handles whitespace-only uploadedJson as empty', () => {
    const metadata: TestMetadata = {
      customVariables: [{ key: 'key', value: 'val' }],
      uploadedJson: '   ',
    };

    const result = buildPreviewData(metadata as any);
    expect(result.key).toBe('val');
    expect(Object.keys(result)).toHaveLength(1);
  });
});
