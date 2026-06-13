import type PDFDocument from 'pdfkit';
import type { DocBlock, RenderWarning } from '../../schema/types.js';
import { interpolate } from '../../parser/interpolate.js';

// ============================================================
// PDFKit block renderer context
// Carries shared render state across all block renderers
// ============================================================

export interface PdfRenderContext {
  doc: InstanceType<typeof PDFDocument>;
  data: Record<string, unknown>;
  warnings: RenderWarning[];
  marginBottom: number; // bottom boundary for page break detection
  pageHeight: number;
  isAbsolute?: boolean;
}

// ============================================================
// Block renderer function type
// ============================================================

// Each renderer receives a narrowed block type but is stored as a DocBlock handler.
// The registry guarantees the correct renderer is called for the correct type.
export type PdfBlockRenderer = (block: DocBlock, ctx: PdfRenderContext) => void;

// Typed registration helper — lets individual renderers keep their specific types
// while the registry stores the wider union type.
export function createBlockRenderer<T extends DocBlock>(
  renderer: (block: T, ctx: PdfRenderContext) => void,
): PdfBlockRenderer {
  return renderer as PdfBlockRenderer;
}

// ============================================================
// Registry
// ============================================================

const rendererRegistry = new Map<DocBlock['type'], PdfBlockRenderer>();

export function registerPdfBlockRenderer(
  type: DocBlock['type'],
  renderer: PdfBlockRenderer,
): void {
  rendererRegistry.set(type, renderer);
}

export function getPdfBlockRenderer(type: DocBlock['type']): PdfBlockRenderer {
  const renderer = rendererRegistry.get(type);

  if (renderer === undefined) {
    // Fallback: skip unknown blocks with a warning instead of crashing
    return (block, ctx) => {
      ctx.warnings.push({
        blockId: block.id,
        code: 'UNKNOWN_BLOCK_TYPE',
        message: `No PDF renderer registered for block type "${block.type}". Block skipped.`,
      });
    };
  }

  return renderer;
}

// ============================================================
// Shared utilities for block renderers
// ============================================================

/**
 * Checks if the current Y position would overflow the page.
 * Adds a new page if needed.
 */
export function checkPageBreak(ctx: PdfRenderContext, reservedHeight = 60): void {
  if (ctx.isAbsolute) {
    return;
  }
  if (ctx.doc.y > ctx.pageHeight - reservedHeight) {
    ctx.doc.addPage();
  }
}

/**
 * Resolves a hex color with a fallback.
 */
export function resolveColor(
  color: string | undefined,
  fallback: string,
): string {
  return color ?? fallback;
}

/**
 * Interpolates a string using the render context's data.
 */
export function resolve(template: string, ctx: PdfRenderContext): string {
  return interpolate(template, ctx.data);
}
