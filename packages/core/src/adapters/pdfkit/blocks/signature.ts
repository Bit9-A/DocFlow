import type { SignatureBlock } from '../../../schema/types.js';
import type { PdfRenderContext } from '../registry.js';
import { createBlockRenderer, registerPdfBlockRenderer, resolveColor } from '../registry.js';

function renderSignature(block: SignatureBlock, ctx: PdfRenderContext): void {
  const { doc } = ctx;

  const lineWidth = block.styles.lineWidth ?? 1;
  const lineColor = resolveColor(block.styles.lineColor, '#9CA3AF');
  const gap = block.styles.gap ?? 8;
  const fontSize = block.styles.fontSize ?? 10;
  const color = resolveColor(block.styles.color, '#374151');
  const marginTop = block.styles.marginTop ?? 10;
  const marginBottom = block.styles.marginBottom ?? 10;

  const width = block.width ?? 150;

  if (block.x === undefined && block.y === undefined) {
    doc.y += marginTop;
  }

  const startX = block.x ?? doc.x;
  const lineY = block.y ?? doc.y;

  // Draw signature line
  doc
    .moveTo(startX, lineY)
    .lineTo(startX + width, lineY)
    .strokeColor(lineColor)
    .lineWidth(lineWidth)
    .stroke();

  // Draw labels
  doc.fontSize(fontSize).fillColor(color).font('Helvetica');

  let currentY = lineY + gap;

  // Center text below line
  doc.text(block.label, startX, currentY, { width: width, align: 'center' });
  currentY += fontSize * 1.2;

  if (block.name) {
    doc
      .font('Helvetica-Bold')
      .text(block.name, startX, currentY, { width: width, align: 'center' });
    currentY += fontSize * 1.2;
  }

  if (block.title) {
    doc
      .font('Helvetica-Oblique')
      .text(block.title, startX, currentY, { width: width, align: 'center' });
    currentY += fontSize * 1.2;
  }

  if (block.x === undefined && block.y === undefined) {
    doc.y = currentY + marginBottom;
  }
}

registerPdfBlockRenderer(
  'signature',
  createBlockRenderer<SignatureBlock>(renderSignature),
);
