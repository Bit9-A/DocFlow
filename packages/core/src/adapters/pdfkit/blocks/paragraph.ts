import type { ParagraphBlock } from '../../../schema/types.js';
import type { PdfRenderContext } from '../registry.js';
import {
  checkPageBreak,
  createBlockRenderer,
  registerPdfBlockRenderer,
  resolve,
  resolveColor,
} from '../registry.js';

function renderParagraph(block: ParagraphBlock, ctx: PdfRenderContext): void {
  checkPageBreak(ctx, 60);

  const text = resolve(block.text, ctx);
  const fontSize = block.styles.fontSize ?? 11;
  const color = resolveColor(block.styles.color, '#374151');
  const marginBottom = block.styles.marginBottom ?? 6;

  const fontName =
    block.styles.fontWeight === 'bold'
      ? 'Helvetica-Bold'
      : 'Helvetica';

  ctx.doc
    .fontSize(fontSize)
    .fillColor(color)
    .font(fontName)
    .text(text, {
      align: block.styles.textAlign ?? 'left',
      lineGap: (block.styles.lineHeight ?? 1.5) * fontSize - fontSize,
      ...(block.width !== undefined && { width: block.width }),
      ...(block.height !== undefined && { height: block.height }),
    });

  ctx.doc.moveDown(marginBottom / fontSize);
}

registerPdfBlockRenderer('paragraph', createBlockRenderer<ParagraphBlock>(renderParagraph));
