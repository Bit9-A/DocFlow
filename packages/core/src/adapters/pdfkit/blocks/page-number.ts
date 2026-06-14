import type { PageNumberBlock } from '../../../schema/types.js';
import type { PdfRenderContext } from '../registry.js';
import {
  createBlockRenderer,
  registerPdfBlockRenderer,
  resolve,
  resolveColor,
} from '../registry.js';

function renderPageNumber(block: PageNumberBlock, ctx: PdfRenderContext): void {
  const { doc } = ctx;
  const margins = doc.page.margins as { left: number; right: number };
  const pageWidth = doc.page.width;

  // Check if we are in the second pass (header/footer/post-process rendering)
  if (ctx.data['currentPage'] !== undefined) {
    const text = resolve(block.format, ctx);
    const fontSize = block.styles.fontSize ?? 9;
    const color = resolveColor(block.styles.color, '#6B7280');
    const fontName =
      block.styles.fontWeight === 'bold'
        ? 'Helvetica-Bold'
        : block.styles.fontWeight === 'light'
        ? 'Helvetica-Light'
        : 'Helvetica';

    const width = block.width ?? (pageWidth - margins.left - margins.right);
    const align = block.styles.textAlign ?? 'right';

    doc
      .fontSize(fontSize)
      .fillColor(color)
      .font(fontName)
      .text(text, {
        align,
        width,
      });
  } else {
    // First pass: defer rendering
    const x = block.x ?? doc.x;
    const y = block.y ?? doc.y;
    const page = block.page ?? (ctx as any).currentPageIdx ?? 0;

    if (!(ctx as any).deferredPageNumbers) {
      (ctx as any).deferredPageNumbers = [];
    }
    (ctx as any).deferredPageNumbers.push({
      block,
      x,
      y,
      page,
    });

    // Move doc.y down to reserve space in page flow if it is not absolute
    if (block.x === undefined && block.y === undefined) {
      const fontSize = block.styles.fontSize ?? 9;
      const height =
        fontSize * (block.styles.lineHeight ?? 1.2) +
        (block.styles.marginBottom ?? 4) +
        (block.styles.marginTop ?? 0);
      doc.y += height;
    }
  }
}

registerPdfBlockRenderer(
  'page-number',
  createBlockRenderer<PageNumberBlock>(renderPageNumber),
);
