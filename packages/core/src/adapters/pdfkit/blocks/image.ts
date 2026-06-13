import type { ImageBlock } from '../../../schema/types.js';
import type { PdfRenderContext } from '../registry.js';
import { checkPageBreak, createBlockRenderer, registerPdfBlockRenderer, resolve } from '../registry.js';

function renderImage(block: ImageBlock, ctx: PdfRenderContext): void {
  const { doc, warnings } = ctx;

  const src = resolve(block.src, ctx);

  if (!src) {
    warnings.push({
      blockId: block.id,
      code: 'IMAGE_SRC_EMPTY',
      message: 'Image block has no src after variable resolution. Skipped.',
    });
    return;
  }

  // Resolve dimensions
  const margins = doc.page.margins as { left: number; right: number };
  const pageWidth = doc.page.width - margins.left - margins.right;

  const rawWidth = block.width ?? block.styles.width;
  const rawHeight = block.height ?? block.styles.height;

  const width =
    typeof rawWidth === 'string'
      ? (parseFloat(rawWidth) / 100) * pageWidth
      : (rawWidth ?? pageWidth);

  const height = typeof rawHeight === 'number' ? rawHeight : undefined;
  const marginBottom = block.styles.marginBottom ?? 8;

  checkPageBreak(ctx, (height ?? 100) + 20);

  try {
    const imgOptions: { width: number; height?: number; fit?: [number, number] } = { width };
    if (height !== undefined) {
      imgOptions.fit = [width, height];
    }

    // PDFKit image align accepts 'center' | 'right' only — omit for left-aligned (default)
    if (block.x !== undefined || block.y !== undefined) {
      doc.image(src, block.x ?? doc.x, block.y ?? doc.y, imgOptions);
    } else {
      doc.image(src, imgOptions);
    }
    doc.moveDown(marginBottom / 12);
  } catch {
    warnings.push({
      blockId: block.id,
      code: 'IMAGE_LOAD_FAILED',
      message: `Failed to load image from src "${src.slice(0, 60)}". Block skipped.`,
    });
  }
}

registerPdfBlockRenderer('image', createBlockRenderer<ImageBlock>(renderImage));
