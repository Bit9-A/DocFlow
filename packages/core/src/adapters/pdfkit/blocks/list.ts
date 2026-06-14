import type { ListBlock } from '../../../schema/types.js';
import type { PdfRenderContext } from '../registry.js';
import { createBlockRenderer, registerPdfBlockRenderer, resolve, resolveColor } from '../registry.js';

function renderList(block: ListBlock, ctx: PdfRenderContext): void {
  const { doc } = ctx;
  const fontSize = block.styles.fontSize ?? 11;
  const color = resolveColor(block.styles.color, '#374151');
  const bulletColor = resolveColor(block.styles.color, '#374151');
  const itemSpacing = block.styles.itemSpacing ?? 4;
  const marginTop = block.styles.marginTop ?? 6;
  const marginBottom = block.styles.marginBottom ?? 6;

  const width = block.width ?? (doc.page.width - doc.page.margins.left - doc.page.margins.right);
  const startX = block.x ?? doc.x;

  if (block.x === undefined && block.y === undefined) {
    doc.y += marginTop;
  }

  let currentY = block.y ?? doc.y;

  block.items.forEach((item, index) => {
    const text = resolve(item, ctx);
    let bullet = '\u2022'; // default dot
    if (block.ordered) {
      bullet = `${index + 1}.`;
    } else if (block.styles.bulletStyle === 'dash') {
      bullet = '-';
    } else if (block.styles.bulletStyle === 'checkmark') {
      bullet = '\u2713';
    } else if (block.styles.bulletStyle === 'number') {
      bullet = `${index + 1}.`;
    }

    doc.save();

    // Render bullet/number
    doc.fontSize(fontSize)
       .fillColor(bulletColor)
       .font(block.styles.fontWeight === 'bold' ? 'Helvetica-Bold' : 'Helvetica')
       .text(bullet, startX, currentY, { width: 15, align: 'right' });

    // Render item text with hanging indent
    doc.fontSize(fontSize)
       .fillColor(color)
       .font(block.styles.fontWeight === 'bold' ? 'Helvetica-Bold' : 'Helvetica')
       .text(text, startX + 20, currentY, {
         width: width - 20,
         lineGap: (block.styles.lineHeight ?? 1.3) * fontSize - fontSize
       });

    const itemHeight = doc.heightOfString(text, {
      width: width - 20,
      lineGap: (block.styles.lineHeight ?? 1.3) * fontSize - fontSize
    });

    currentY += itemHeight + itemSpacing;

    doc.restore();
  });

  if (block.x === undefined && block.y === undefined) {
    doc.y = currentY + marginBottom;
  }
}

registerPdfBlockRenderer(
  'list',
  createBlockRenderer<ListBlock>(renderList),
);
