import type { HeadingBlock } from '../../../schema/types.js';
import type { PdfRenderContext } from '../registry.js';
import {
  checkPageBreak,
  createBlockRenderer,
  registerPdfBlockRenderer,
  resolve,
  resolveColor,
} from '../registry.js';

const LEVEL_FONT_SIZES: Record<HeadingBlock['level'], number> = {
  1: 24,
  2: 20,
  3: 17,
  4: 14,
  5: 12,
  6: 11,
};

function renderHeading(block: HeadingBlock, ctx: PdfRenderContext): void {
  checkPageBreak(ctx, 80);

  const text = resolve(block.text, ctx);
  const fontSize = block.styles.fontSize ?? LEVEL_FONT_SIZES[block.level];
  const color = resolveColor(block.styles.color, '#111827');
  const marginBottom = block.styles.marginBottom ?? 8;

  ctx.doc
    .fontSize(fontSize)
    .fillColor(color)
    .font('Helvetica-Bold')
    .text(text, {
      align: block.styles.textAlign ?? 'left',
      lineGap: (block.styles.lineHeight ?? 1.2) * fontSize - fontSize,
      ...(block.width !== undefined && { width: block.width }),
      ...(block.height !== undefined && { height: block.height }),
    });

  ctx.doc.moveDown(marginBottom / fontSize);
}

registerPdfBlockRenderer('heading', createBlockRenderer<HeadingBlock>(renderHeading));
