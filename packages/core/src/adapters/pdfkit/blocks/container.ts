import type { ContainerBlock, DocBlock } from '../../../schema/types.js';
import type { PdfRenderContext } from '../registry.js';
import {
  createBlockRenderer,
  registerPdfBlockRenderer,
  getPdfBlockRenderer,
  resolveColor,
} from '../registry.js';
import { interpolate } from '../../../parser/interpolate.js';
import { resolvePayload } from '../../../parser/interpolate.js';
import { estimateRowHeight } from './table.js';

export function estimateBlockHeight(block: DocBlock, ctx: PdfRenderContext, width: number): number {
  const doc = ctx.doc;
  const prevFont = (doc as any)._font;
  const prevSize = (doc as any)._fontSize;

  let height = 0;

  switch (block.type) {
    case 'heading': {
      const text = block.text;
      const resolvedText = interpolate(text, ctx.data);
      const levelSizes = { 1: 24, 2: 20, 3: 16, 4: 14, 5: 12, 6: 10 };
      const fontSize = block.styles.fontSize ?? levelSizes[block.level as 1|2|3|4|5|6] ?? 16;
      doc.fontSize(fontSize).font('Helvetica-Bold');
      const textHeight = doc.heightOfString(resolvedText, { width: width });
      height = textHeight + (block.styles.marginBottom ?? 8) + (block.styles.marginTop ?? 8);
      break;
    }
    case 'paragraph': {
      const resolvedText = interpolate(block.text, ctx.data);
      const fontSize = block.styles.fontSize ?? 11;
      const lineGap = (block.styles.lineHeight ?? 1.5) * fontSize - fontSize;
      doc.fontSize(fontSize).font(block.styles.fontWeight === 'bold' ? 'Helvetica-Bold' : 'Helvetica');
      const textHeight = doc.heightOfString(resolvedText, { width: width, lineGap });
      height = textHeight + (block.styles.marginBottom ?? 6) + (block.styles.marginTop ?? 0);
      break;
    }
    case 'divider': {
      height = (block.styles.thickness ?? 1) + (block.styles.marginTop ?? 8) + (block.styles.marginBottom ?? 8);
      break;
    }
    case 'spacer': {
      height = block.height + (block.styles.marginTop ?? 0) + (block.styles.marginBottom ?? 0);
      break;
    }
    case 'image': {
      const blockHeight = typeof block.styles.height === 'number' ? block.styles.height : (block.styles.height ? parseFloat(block.styles.height) : 150);
      height = (isNaN(blockHeight) ? 150 : blockHeight) + (block.styles.marginTop ?? 0) + (block.styles.marginBottom ?? 0);
      break;
    }
    case 'page-break': {
      height = 0;
      break;
    }
    case 'page-number': {
      const fontSize = block.styles.fontSize ?? 9;
      height = fontSize * (block.styles.lineHeight ?? 1.2) + (block.styles.marginBottom ?? 4) + (block.styles.marginTop ?? 0);
      break;
    }
    case 'signature': {
      const fontSize = block.styles.fontSize ?? 10;
      const gap = block.styles.gap ?? 8;
      let textLines = 1;
      if (block.name) textLines++;
      if (block.title) textLines++;
      height = gap + textLines * fontSize * 1.2 + (block.styles.marginBottom ?? 10) + (block.styles.marginTop ?? 0);
      break;
    }
    case 'list': {
      const fontSize = block.styles.fontSize ?? 11;
      const itemSpacing = block.styles.itemSpacing ?? 4;
      const docWidth = width - 15;
      let totalItemsHeight = 0;
      doc.fontSize(fontSize).font(block.styles.fontWeight === 'bold' ? 'Helvetica-Bold' : 'Helvetica');
      block.items.forEach((item) => {
        const resolvedText = interpolate(item, ctx.data);
        const textHeight = doc.heightOfString(resolvedText, { width: docWidth });
        totalItemsHeight += textHeight + itemSpacing;
      });
      height = totalItemsHeight + (block.styles.marginBottom ?? 6) + (block.styles.marginTop ?? 0);
      break;
    }
    case 'barcode': {
      const blockHeight = block.styles.height ?? 50;
      height = blockHeight + (block.styles.marginTop ?? 0) + (block.styles.marginBottom ?? 0);
      break;
    }
    case 'chart': {
      const blockHeight = block.styles.height ?? 150;
      height = blockHeight + (block.styles.marginTop ?? 0) + (block.styles.marginBottom ?? 0);
      break;
    }
    case 'table': {
      const fontSize = block.styles.fontSize ?? 10;
      const cellPadding = block.styles.cellPadding ?? 6;
      const columnWidths = block.columns.map((col) => {
        const percent = parseFloat(col.width) / 100;
        return percent * width;
      });

      let tableHeight = 0;
      const headerH = estimateRowHeight(doc, null, block.columns, columnWidths, cellPadding, fontSize, true, ctx);
      tableHeight += headerH;

      const rows = resolvePayload(block.loopOver, ctx.data);
      if (Array.isArray(rows)) {
        const limit = block.limit !== undefined && block.limit > 0 ? Math.min(block.limit, rows.length) : rows.length;
        for (let i = 0; i < limit; i++) {
          const rowH = estimateRowHeight(doc, rows[i], block.columns, columnWidths, cellPadding, fontSize, false, ctx);
          tableHeight += rowH;
        }
      }
      height = tableHeight + (block.styles.marginBottom ?? 10) + (block.styles.marginTop ?? 0);
      break;
    }
    case 'columns': {
      const gap = (block.styles as any).gap ?? 10;
      const totalGaps = gap * (block.columns.length - 1);
      const usableWidth = width - totalGaps;
      let maxColHeight = 0;

      block.columns.forEach((col) => {
        const colWidth = (parseFloat(col.width) / 100) * usableWidth;
        let colHeight = 0;
        col.blocks.forEach((child) => {
          colHeight += estimateBlockHeight(child, ctx, colWidth);
        });
        if (colHeight > maxColHeight) {
          maxColHeight = colHeight;
        }
      });
      height = maxColHeight + (block.styles.marginTop ?? 0) + (block.styles.marginBottom ?? 0);
      break;
    }
    case 'container': {
      const padding = block.styles.padding ?? 8;
      const childWidth = width - 2 * padding;
      let childrenHeight = 0;
      block.blocks.forEach((child) => {
        childrenHeight += estimateBlockHeight(child, ctx, childWidth);
      });
      height = childrenHeight + 2 * padding + (block.styles.marginTop ?? 0) + (block.styles.marginBottom ?? 0);
      break;
    }
    default:
      break;
  }

  if (prevFont) doc.font(prevFont);
  if (prevSize) doc.fontSize(prevSize);

  return height;
}

function renderContainer(block: ContainerBlock, ctx: PdfRenderContext): void {
  const { doc } = ctx;
  const margins = doc.page.margins as { left: number; right: number };
  const pageWidth = doc.page.width - margins.left - margins.right;

  const width = block.width ?? pageWidth;
  const padding = block.styles.padding ?? 8;
  const borderRadius = block.styles.borderRadius ?? 0;
  const bgColor = block.styles.backgroundColor;
  const borderColor = block.styles.borderColor;
  const borderWidth = block.styles.borderWidth ?? 1;

  const marginTop = block.styles.marginTop ?? 0;
  const marginBottom = block.styles.marginBottom ?? 0;

  const startX = block.x ?? doc.x;
  const startY = block.y ?? doc.y;

  // Compute total card height using block height estimation
  const childrenHeight = block.blocks.reduce((sum, child) => {
    return sum + estimateBlockHeight(child, ctx, width - 2 * padding);
  }, 0);
  const cardHeight = childrenHeight + 2 * padding;

  // Draw container card background and borders
  doc.save();

  if (bgColor) {
    if (borderRadius > 0) {
      doc.roundedRect(startX, startY + marginTop, width, cardHeight, borderRadius).fill(bgColor);
    } else {
      doc.rect(startX, startY + marginTop, width, cardHeight).fill(bgColor);
    }
  }

  if (borderColor) {
    doc.lineWidth(borderWidth).strokeColor(borderColor);
    if (borderRadius > 0) {
      doc.roundedRect(startX, startY + marginTop, width, cardHeight, borderRadius).stroke();
    } else {
      doc.rect(startX, startY + marginTop, width, cardHeight).stroke();
    }
  }

  doc.restore();

  // Render children inside the container
  const childStartX = startX + padding;
  let childY = startY + marginTop + padding;

  block.blocks.forEach((child) => {
    const originalX = doc.x;
    const originalY = doc.y;

    doc.x = childStartX;
    doc.y = childY;

    // Temporarily narrow child width if not specified
    const originalWidth = child.width;
    if (child.width === undefined) {
      child.width = width - 2 * padding;
    }

    const renderer = getPdfBlockRenderer(child.type);
    renderer(child, ctx);

    // Calculate height of child to increment next child y position
    const childHeight = estimateBlockHeight(child, ctx, width - 2 * padding);
    childY += childHeight;

    if (originalWidth === undefined) {
      delete child.width;
    } else {
      child.width = originalWidth;
    }

    doc.x = originalX;
    doc.y = originalY;
  });

  // Position cursor below the container block in normal flow
  if (block.x === undefined && block.y === undefined) {
    doc.y = startY + marginTop + cardHeight + marginBottom;
  }
}

registerPdfBlockRenderer(
  'container',
  createBlockRenderer<ContainerBlock>(renderContainer),
);
