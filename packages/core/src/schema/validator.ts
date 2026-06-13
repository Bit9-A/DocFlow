import { z } from 'zod';
import type { DocFlowSchema } from './types.js';

// ============================================================
// Shared style schemas
// ============================================================

const hexColorSchema = z
  .string()
  .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, 'Must be a valid hex color (e.g. #FFF or #FFFFFF)');

const baseStylesSchema = z.object({
  marginTop: z.number().min(0).optional(),
  marginBottom: z.number().min(0).optional(),
  marginLeft: z.number().min(0).optional(),
  marginRight: z.number().min(0).optional(),
  paddingTop: z.number().min(0).optional(),
  paddingBottom: z.number().min(0).optional(),
  paddingLeft: z.number().min(0).optional(),
  paddingRight: z.number().min(0).optional(),
  backgroundColor: hexColorSchema.optional(),
  color: hexColorSchema.optional(),
  borderColor: hexColorSchema.optional(),
  borderWidth: z.number().min(0).max(10).optional(),
});

const textStylesSchema = baseStylesSchema.extend({
  color: hexColorSchema.optional(),
  fontSize: z.number().min(6).max(144).optional(),
  fontFamily: z.string().min(1).optional(),
  fontWeight: z.enum(['normal', 'bold', 'light']).optional(),
  textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
  lineHeight: z.number().min(0.5).max(4).optional(),
  letterSpacing: z.number().optional(),
  textDecoration: z.enum(['none', 'underline', 'line-through']).optional(),
});

const tableStylesSchema = baseStylesSchema.extend({
  headerBg: hexColorSchema.optional(),
  headerColor: hexColorSchema.optional(),
  borderColor: hexColorSchema.optional(),
  borderWidth: z.number().min(0).max(10).optional(),
  cellPadding: z.number().min(0).optional(),
  stripedRows: z.boolean().optional(),
  stripedColor: hexColorSchema.optional(),
  fontSize: z.number().min(6).max(72).optional(),
  fontFamily: z.string().min(1).optional(),
});

const imageStylesSchema = baseStylesSchema.extend({
  width: z.union([z.number().min(0), z.string()]).optional(),
  height: z.union([z.number().min(0), z.string()]).optional(),
  objectFit: z.enum(['contain', 'cover', 'fill']).optional(),
  borderRadius: z.number().min(0).optional(),
  border: z.string().optional(),
});

const dividerStylesSchema = baseStylesSchema.extend({
  color: hexColorSchema.optional(),
  thickness: z.number().min(0.5).max(20).optional(),
  style: z.enum(['solid', 'dashed', 'dotted']).optional(),
});

// ============================================================
// Block schemas
// ============================================================

const headingBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal('heading'),
  level: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
  ]),
  text: z.string(),
  styles: textStylesSchema,
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().min(0).optional(),
  height: z.number().min(0).optional(),
  page: z.number().min(0).optional(),
  ignoreMargins: z.boolean().optional(),
  isLocked: z.boolean().optional(),
});

const paragraphBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal('paragraph'),
  text: z.string(),
  styles: textStylesSchema,
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().min(0).optional(),
  height: z.number().min(0).optional(),
  page: z.number().min(0).optional(),
  ignoreMargins: z.boolean().optional(),
  isLocked: z.boolean().optional(),
});

const tableColumnSchema = z.object({
  header: z.string(),
  width: z
    .string()
    .regex(/^\d+(\.\d+)?%$/, 'Column width must be a percentage (e.g. "60%")'),
  value: z.string(),
  align: z.enum(['left', 'center', 'right']).optional(),
});

const tableBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal('table'),
  loopOver: z.string().min(1),
  columns: z.array(tableColumnSchema).min(1),
  styles: tableStylesSchema,
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().min(0).optional(),
  height: z.number().min(0).optional(),
  page: z.number().min(0).optional(),
  ignoreMargins: z.boolean().optional(),
  isLocked: z.boolean().optional(),
});

const imageBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal('image'),
  src: z.string().min(1),
  alt: z.string(),
  styles: imageStylesSchema,
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().min(0).optional(),
  height: z.number().min(0).optional(),
  page: z.number().min(0).optional(),
  ignoreMargins: z.boolean().optional(),
  isLocked: z.boolean().optional(),
});

const dividerBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal('divider'),
  styles: dividerStylesSchema,
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().min(0).optional(),
  height: z.number().min(0).optional(),
  page: z.number().min(0).optional(),
  ignoreMargins: z.boolean().optional(),
  isLocked: z.boolean().optional(),
});

const spacerBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal('spacer'),
  height: z.number().min(1).max(500),
  styles: baseStylesSchema,
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().min(0).optional(),
  page: z.number().min(0).optional(),
  ignoreMargins: z.boolean().optional(),
  isLocked: z.boolean().optional(),
});

const pageBreakBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal('page-break'),
  styles: baseStylesSchema,
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().min(0).optional(),
  height: z.number().min(0).optional(),
  page: z.number().min(0).optional(),
  ignoreMargins: z.boolean().optional(),
  isLocked: z.boolean().optional(),
});

// Forward declaration for nested blocks (columns, header, footer)
// We use z.lazy to handle the recursive reference
const docBlockSchema: z.ZodType = z.lazy(() =>
  z.discriminatedUnion('type', [
    headingBlockSchema,
    paragraphBlockSchema,
    tableBlockSchema,
    imageBlockSchema,
    dividerBlockSchema,
    spacerBlockSchema,
    pageBreakBlockSchema,
    columnsBlockSchema,
    headerBlockSchema,
    footerBlockSchema,
  ]),
);

const columnsBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal('columns'),
  columns: z
    .array(
      z.object({
        width: z.string().regex(/^\d+(\.\d+)?%$/),
        blocks: z.array(docBlockSchema),
      }),
    )
    .min(2)
    .max(6),
  styles: baseStylesSchema,
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().min(0).optional(),
  height: z.number().min(0).optional(),
  page: z.number().min(0).optional(),
  ignoreMargins: z.boolean().optional(),
  isLocked: z.boolean().optional(),
});

const headerBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal('header'),
  blocks: z.array(docBlockSchema),
  styles: baseStylesSchema,
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().min(0).optional(),
  height: z.number().min(0).optional(),
  page: z.number().min(0).optional(),
  ignoreMargins: z.boolean().optional(),
  isLocked: z.boolean().optional(),
});

const footerBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal('footer'),
  blocks: z.array(docBlockSchema),
  styles: baseStylesSchema,
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().min(0).optional(),
  height: z.number().min(0).optional(),
  page: z.number().min(0).optional(),
  ignoreMargins: z.boolean().optional(),
  isLocked: z.boolean().optional(),
});

// ============================================================
// Document schema
// ============================================================

const pageMarginsSchema = z.object({
  top: z.number().min(0).max(300),
  bottom: z.number().min(0).max(300),
  left: z.number().min(0).max(300),
  right: z.number().min(0).max(300),
});

const pageMetadataSchema = z.object({
  title: z.string().min(1),
  pageSize: z.enum(['LETTER', 'A4', 'LEGAL', 'A3']),
  orientation: z.enum(['portrait', 'landscape']),
  margins: pageMarginsSchema,
  author: z.string().optional(),
  subject: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  createdAt: z.string().datetime().optional(),
  customVariables: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
  uploadedJson: z.string().optional(),
});

export const docFlowSchemaValidator = z.object({
  $schema: z.string().url(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must follow semver (e.g. 1.0.0)'),
  metadata: pageMetadataSchema,
  ast: z.array(docBlockSchema).min(0),
});

// ============================================================
// Public validation API
// ============================================================

export class SchemaValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: z.ZodIssue[],
  ) {
    super(message);
    this.name = 'SchemaValidationError';
  }
}

/**
 * Validates input and returns a typed DocFlowSchema.
 * Throws SchemaValidationError with detailed issues on failure.
 */
export function validateSchema(input: unknown): DocFlowSchema {
  const result = docFlowSchemaValidator.safeParse(input);

  if (!result.success) {
    const summary = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');

    throw new SchemaValidationError(
      `Invalid DocFlow schema:\n${summary}`,
      result.error.issues,
    );
  }

  return result.data as DocFlowSchema;
}

/**
 * Validates input without throwing.
 * Returns { success, data } or { success, error }.
 */
export function safeValidateSchema(input: unknown) {
  return docFlowSchemaValidator.safeParse(input) as
    | { success: true; data: DocFlowSchema }
    | { success: false; error: z.ZodError };
}
