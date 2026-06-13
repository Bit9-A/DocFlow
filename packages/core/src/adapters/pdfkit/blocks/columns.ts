import type { ColumnsBlock, HeaderBlock, FooterBlock } from '../../../schema/types.js';
import type { PdfRenderContext } from '../registry.js';
import {
  createBlockRenderer,
  registerPdfBlockRenderer,
  getPdfBlockRenderer,
} from '../registry.js';

function renderColumns(block: ColumnsBlock, ctx: PdfRenderContext): void {
  const { doc } = ctx;
  const margins = doc.page.margins as { left: number; right: number };
  const pageWidth = doc.page.width - margins.left - margins.right;

  const gap = (block.styles as any).gap ?? 10;
  const totalGaps = gap * (block.columns.length - 1);
  const usableWidth = pageWidth - totalGaps;

  const startY = doc.y;
  let maxY = startY;
  let currentX = margins.left;
  const originalX = doc.x;

  block.columns.forEach((col) => {
    const colWidth = (parseFloat(col.width) / 100) * usableWidth;

    // Position cursor at the start of this column
    doc.x = currentX;
    doc.y = startY;

    col.blocks.forEach((childBlock) => {
      const originalWidth = childBlock.width;
      if (childBlock.width === undefined) {
        childBlock.width = colWidth;
      }
      const renderer = getPdfBlockRenderer(childBlock.type);
      renderer(childBlock, ctx);
      
      if (originalWidth === undefined) {
        delete childBlock.width;
      } else {
        childBlock.width = originalWidth;
      }
    });

    maxY = Math.max(maxY, doc.y);
    currentX += colWidth + gap;
  });

  // Advance past the tallest column
  doc.x = originalX;
  doc.y = maxY;
}

function renderHeaderOrFooter(
  block: HeaderBlock | FooterBlock,
  ctx: PdfRenderContext,
): void {
  // Header/footer are handled at page-level by the adapter — no inline rendering
  void block;
  void ctx;
}

registerPdfBlockRenderer('columns', createBlockRenderer<ColumnsBlock>(renderColumns));
registerPdfBlockRenderer('header', createBlockRenderer<HeaderBlock>(renderHeaderOrFooter));
registerPdfBlockRenderer('footer', createBlockRenderer<FooterBlock>(renderHeaderOrFooter));
