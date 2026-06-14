import { describe, it, expect } from 'vitest';
import {
  interpolate,
  interpolateHtml,
  resolvePayload,
  extractVariables,
  escapeHtml,
} from '../../src/parser/interpolate.js';

const data = {
  user: {
    name: 'Ada Lovelace',
    email: 'ada@docflow.dev',
  },
  order: {
    id: 'ORD-001',
    total: 1234.56,
  },
  company: 'DocFlow Inc.',
};

// ============================================================
// resolvePayload
// ============================================================

describe('resolvePayload', () => {
  it('resolves a top-level key', () => {
    expect(resolvePayload('company', data)).toBe('DocFlow Inc.');
  });

  it('resolves a nested key', () => {
    expect(resolvePayload('user.name', data)).toBe('Ada Lovelace');
  });

  it('resolves deeply nested keys', () => {
    expect(resolvePayload('order.id', data)).toBe('ORD-001');
  });

  it('returns empty string for missing top-level key', () => {
    expect(resolvePayload('missing', data)).toBe('');
  });

  it('returns empty string for missing nested key', () => {
    expect(resolvePayload('user.phone', data)).toBe('');
  });

  it('returns empty string for null intermediate value', () => {
    const d = { a: null } as Record<string, unknown>;
    expect(resolvePayload('a.b', d)).toBe('');
  });

  it('returns the raw numeric value', () => {
    expect(resolvePayload('order.total', data)).toBe(1234.56);
  });

  it('returns empty string when path exceeds MAX_PATH_DEPTH', () => {
    const deepPath = Array.from({ length: 11 }, (_, i) => `k${i}`).join('.');
    expect(resolvePayload(deepPath, data)).toBe('');
  });

  // -- Security
  it('blocks __proto__ traversal', () => {
    expect(resolvePayload('__proto__.polluted', data)).toBe('');
  });

  it('blocks constructor traversal', () => {
    expect(resolvePayload('constructor.name', data)).toBe('');
  });

  it('blocks prototype traversal', () => {
    expect(resolvePayload('prototype.keys', data)).toBe('');
  });

  it('does not access non-own properties', () => {
    const inherited = Object.create({ inherited: 'yes' }) as Record<string, unknown>;
    expect(resolvePayload('inherited', inherited)).toBe('');
  });

  it('resolves array indices using dot-notation', () => {
    const arrayData = {
      items: [
        { name: 'First' },
        { name: 'Second' }
      ]
    };
    expect(resolvePayload('items.0.name', arrayData)).toBe('First');
    expect(resolvePayload('items.1.name', arrayData)).toBe('Second');
    expect(resolvePayload('items.2.name', arrayData)).toBe('');
  });
});

// ============================================================
// interpolate
// ============================================================

describe('interpolate', () => {
  it('replaces a single variable', () => {
    expect(interpolate('Hello, {{user.name}}!', data)).toBe('Hello, Ada Lovelace!');
  });

  it('replaces multiple variables', () => {
    const result = interpolate('{{user.name}} <{{user.email}}>', data);
    expect(result).toBe('Ada Lovelace <ada@docflow.dev>');
  });

  it('leaves unresolved variables as empty string', () => {
    expect(interpolate('Order: {{order.missing}}', data)).toBe('Order: ');
  });

  it('handles template with no variables', () => {
    expect(interpolate('No variables here.', data)).toBe('No variables here.');
  });

  it('handles whitespace inside braces', () => {
    expect(interpolate('Hello {{ user.name }}!', data)).toBe('Hello Ada Lovelace!');
  });

  it('deduplicates repeated variables', () => {
    const result = interpolate('{{company}} - {{company}}', data);
    expect(result).toBe('DocFlow Inc. - DocFlow Inc.');
  });
});

// ============================================================
// interpolate — table context ({{item.field}} resolution)
// ============================================================

describe('interpolate — table context', () => {
  const rowData = { name: 'Widget', price: '$10', sku: 'WID-001' };
  const augmentedData = { ...data, item: rowData };

  it('resolves {{item.field}} against the item key in data', () => {
    expect(interpolate('{{item.name}}: {{item.price}}', augmentedData)).toBe('Widget: $10');
  });

  it('resolves nested path via {{item.nested.field}}', () => {
    const d = {
      ...data,
      item: { profile: { displayName: 'Alice' } },
    };
    expect(interpolate('User: {{item.profile.displayName}}', d)).toBe('User: Alice');
  });

  it('returns empty string for missing {{item.missing}} field', () => {
    expect(interpolate('Missing: {{item.missing}}', augmentedData)).toBe('Missing: ');
  });

  it('handles {{item.field}} alongside global {{data.field}} references', () => {
    expect(interpolate('{{item.name}} in {{company}}', augmentedData)).toBe('Widget in DocFlow Inc.');
  });

  it('supports {{item}} alone (the entire row object)', () => {
    const d = { ...data, item: { id: 'abc' } };
    expect(interpolate('Row: {{item}}', d)).toBe('Row: [object Object]');
  });

  it('resolves {{item.field}} when item is undefined (empty string)', () => {
    expect(interpolate('{{item.field}}', { ...data, item: {} })).toBe('');
  });
});

// ============================================================
// interpolateHtml (XSS safety)
// ============================================================

describe('interpolateHtml', () => {
  it('escapes < and > in resolved values', () => {
    const d = { user: { name: '<script>alert("xss")</script>' } };
    const result = interpolateHtml('{{user.name}}', d);
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  it('escapes & in resolved values', () => {
    const d = { company: 'AT&T' };
    expect(interpolateHtml('{{company}}', d)).toBe('AT&amp;T');
  });

  it('escapes quotes', () => {
    const d = { name: '"quoted"' };
    expect(interpolateHtml('{{name}}', d)).toContain('&quot;');
  });
});

// ============================================================
// escapeHtml
// ============================================================

describe('escapeHtml', () => {
  it('escapes all dangerous characters', () => {
    const dangerous = '<script>alert("xss")</script>';
    const safe = escapeHtml(dangerous);
    expect(safe).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('leaves safe strings unchanged', () => {
    expect(escapeHtml('Hello world')).toBe('Hello world');
  });
});

// ============================================================
// extractVariables
// ============================================================

describe('extractVariables', () => {
  it('extracts all unique variable paths', () => {
    const template = 'Hello {{user.name}}, order {{order.id}} is ready.';
    expect(extractVariables(template)).toEqual(['user.name', 'order.id']);
  });

  it('deduplicates repeated variables', () => {
    const template = '{{company}} | {{company}}';
    expect(extractVariables(template)).toEqual(['company']);
  });

  it('returns empty array for templates with no variables', () => {
    expect(extractVariables('No variables.')).toEqual([]);
  });

  it('trims whitespace in variable paths', () => {
    const template = '{{ user.name }}';
    expect(extractVariables(template)).toEqual(['user.name']);
  });
});
