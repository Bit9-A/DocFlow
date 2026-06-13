import type { DividerBlock } from '../../../schema/types.js';
import type { PdfRenderContext } from '../registry.js';
import { createBlockRenderer, registerPdfBlockRenderer, resolveColor } from '../registry.js';

function renderDivider(block: DividerBlock, ctx: PdfRenderContext): void {
  const { doc } = ctx;
  const margins = doc.page.margins as { left: number; right: number };
  const pageWidth = doc.page.width;

  const color = resolveColor(block.styles.color, '#E5E7EB');
  const thickness = block.styles.thickness ?? 1;
  const marginTop = block.styles.marginTop ?? 8;
  const marginBottom = block.styles.marginBottom ?? 8;

  if (block.y === undefined && block.x === undefined) {
    doc.moveDown(marginTop / 12);
  }

  const startX = block.x ?? margins.left;
  const endX = startX + (block.width ?? (pageWidth - margins.left - margins.right));
  const y = block.y ?? doc.y;

  doc
    .moveTo(startX, y)
    .lineTo(endX, y)
    .strokeColor(color)
    .lineWidth(thickness)
    .stroke();

  if (block.y === undefined && block.x === undefined) {
    doc.moveDown(marginBottom / 12);
  }
}

registerPdfBlockRenderer('divider', createBlockRenderer<DividerBlock>(renderDivider));
