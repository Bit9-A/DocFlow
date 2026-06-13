import { describe, it, expect } from 'vitest';
import {
  validateSchema,
  safeValidateSchema,
  SchemaValidationError,
} from '../../src/schema/validator.js';
import type { DocFlowSchema } from '../../src/schema/types.js';

// ============================================================
// Fixtures
// ============================================================

function makeValidSchema(overrides: Partial<DocFlowSchema> = {}): DocFlowSchema {
  return {
    $schema: 'https://docflow.dev/schemas/v1.json',
    version: '1.0.0',
    metadata: {
      title: 'Test Document',
      pageSize: 'LETTER',
      orientation: 'portrait',
      margins: { top: 40, bottom: 40, left: 50, right: 50 },
    },
    ast: [],
    ...overrides,
  };
}

// ============================================================
// validateSchema
// ============================================================

describe('validateSchema', () => {
  it('accepts a minimal valid schema', () => {
    const schema = makeValidSchema();
    expect(() => validateSchema(schema)).not.toThrow();
  });

  it('returns the typed schema on success', () => {
    const schema = makeValidSchema();
    const result = validateSchema(schema);
    expect(result.version).toBe('1.0.0');
    expect(result.metadata.pageSize).toBe('LETTER');
  });

  it('accepts A4 page size', () => {
    const schema = makeValidSchema({ metadata: { ...makeValidSchema().metadata, pageSize: 'A4' } });
    expect(() => validateSchema(schema)).not.toThrow();
  });

  it('accepts landscape orientation', () => {
    const schema = makeValidSchema({
      metadata: { ...makeValidSchema().metadata, orientation: 'landscape' },
    });
    expect(() => validateSchema(schema)).not.toThrow();
  });

  it('throws SchemaValidationError for missing metadata.title', () => {
    const schema = makeValidSchema();
    // @ts-expect-error — intentionally invalid
    schema.metadata.title = '';
    expect(() => validateSchema(schema)).toThrow(SchemaValidationError);
  });

  it('throws for invalid version format', () => {
    const schema = makeValidSchema({ version: 'not-semver' });
    expect(() => validateSchema(schema)).toThrow(SchemaValidationError);
  });

  it('throws for invalid pageSize', () => {
    const schema = makeValidSchema();
    // @ts-expect-error — intentionally invalid
    schema.metadata.pageSize = 'INVALID';
    expect(() => validateSchema(schema)).toThrow(SchemaValidationError);
  });

  it('throws for invalid margin (negative value)', () => {
    const schema = makeValidSchema({
      metadata: {
        ...makeValidSchema().metadata,
        margins: { top: -10, bottom: 40, left: 50, right: 50 },
      },
    });
    expect(() => validateSchema(schema)).toThrow(SchemaValidationError);
  });

  it('includes issue details in SchemaValidationError', () => {
    const schema = makeValidSchema({ version: 'bad' });
    try {
      validateSchema(schema);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(SchemaValidationError);
      expect((err as SchemaValidationError).issues.length).toBeGreaterThan(0);
    }
  });

  it('validates a heading block', () => {
    const schema = makeValidSchema({
      ast: [
        {
          id: 'blk_1',
          type: 'heading',
          level: 1,
          text: 'Hello',
          styles: { color: '#111827', fontSize: 24 },
        },
      ],
    });
    expect(() => validateSchema(schema)).not.toThrow();
  });

  it('throws for heading with invalid color', () => {
    const schema = makeValidSchema({
      ast: [
        {
          id: 'blk_1',
          type: 'heading',
          level: 1,
          text: 'Hello',
          styles: { color: 'not-a-color' },
        },
      ],
    });
    expect(() => validateSchema(schema)).toThrow(SchemaValidationError);
  });

  it('throws for heading with invalid level', () => {
    const schema = makeValidSchema({
      ast: [
        {
          id: 'blk_1',
          type: 'heading',
          // @ts-expect-error — intentionally invalid
          level: 7,
          text: 'Hello',
          styles: {},
        },
      ],
    });
    expect(() => validateSchema(schema)).toThrow(SchemaValidationError);
  });

  it('validates a table block', () => {
    const schema = makeValidSchema({
      ast: [
        {
          id: 'blk_2',
          type: 'table',
          loopOver: 'items',
          columns: [
            { header: 'Name', width: '60%', value: '{{item.name}}' },
            { header: 'Price', width: '40%', value: '{{item.price}}' },
          ],
          styles: {},
        },
      ],
    });
    expect(() => validateSchema(schema)).not.toThrow();
  });

  it('throws for table column width not in percentage format', () => {
    const schema = makeValidSchema({
      ast: [
        {
          id: 'blk_2',
          type: 'table',
          loopOver: 'items',
          columns: [{ header: 'Name', width: '200px', value: '{{item.name}}' }],
          styles: {},
        },
      ],
    });
    expect(() => validateSchema(schema)).toThrow(SchemaValidationError);
  });
});

// ============================================================
// safeValidateSchema
// ============================================================

describe('safeValidateSchema', () => {
  it('returns { success: true, data } for valid input', () => {
    const schema = makeValidSchema();
    const result = safeValidateSchema(schema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.version).toBe('1.0.0');
    }
  });

  it('returns { success: false, error } for invalid input', () => {
    const result = safeValidateSchema({ invalid: true });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });

  it('does not throw on invalid input', () => {
    expect(() => safeValidateSchema(null)).not.toThrow();
    expect(() => safeValidateSchema(undefined)).not.toThrow();
    expect(() => safeValidateSchema('string')).not.toThrow();
  });
});
