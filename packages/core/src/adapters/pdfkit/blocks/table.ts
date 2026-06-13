import type { TableBlock } from '../../../schema/types.js';
import type { PdfRenderContext } from '../registry.js';
import {
  createBlockRenderer,
  registerPdfBlockRenderer,
  resolve,
  resolveColor,
} from '../registry.js';
import { resolvePayload } from '../../../parser/interpolate.js';

function estimateRowHeight(
  doc: any,
  rowData: Record<string, unknown> | null,
  columns: any[],
  columnWidths: number[],
  cellPadding: number,
  fontSize: number,
  isHeader: boolean,
  ctx: PdfRenderContext,
): number {
  let maxHeight = 0;
  const data = ctx.data;

  const prevFont = doc._font?.name;
  const prevSize = doc._fontSize;

  doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize);

  columns.forEach((col, i) => {
    const colWidth = columnWidths[i] ?? 0;
    let text = '';
    if (isHeader) {
      text = col.header;
    } else {
      const cellTemplate = col.value;
      const rowCtx: PdfRenderContext = {
        ...ctx,
        data: { ...data, item: rowData },
      };
      text = resolve(cellTemplate, rowCtx);
    }

    const textHeight = doc.heightOfString(text, {
      width: colWidth - cellPadding * 2,
    });
    maxHeight = Math.max(maxHeight, textHeight);
  });

  if (prevFont) doc.font(prevFont);
  if (prevSize) doc.fontSize(prevSize);

  return maxHeight + cellPadding * 2;
}

function drawRow(
  doc: any,
  rowData: Record<string, unknown> | null,
  isHeader: boolean,
  y: number,
  startX: number,
  columnWidths: number[],
  columns: any[],
  cellPadding: number,
  fontSize: number,
  ctx: PdfRenderContext,
  bgColor?: string,
): number {
  const data = ctx.data;
  const rowHeight = estimateRowHeight(
    doc,
    rowData,
    columns,
    columnWidths,
    cellPadding,
    fontSize,
    isHeader,
    ctx,
  );

  if (bgColor) {
    const tableWidth = columnWidths.reduce((sum, w) => sum + w, 0);
    doc.rect(startX, y, tableWidth, rowHeight).fill(bgColor);
  }

  let currentX = startX;
  doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize);

  columns.forEach((col, i) => {
    const colWidth = columnWidths[i] ?? 0;
    let text = '';
    if (isHeader) {
      text = col.header;
      doc.fillColor(ctx.data['headerColor'] as string ?? '#111827');
    } else {
      const cellTemplate = col.value;
      const rowCtx: PdfRenderContext = {
        ...ctx,
        data: { ...data, item: rowData },
      };
      text = resolve(cellTemplate, rowCtx);
      doc.fillColor('#374151');
    }

    doc.text(text, currentX + cellPadding, y + cellPadding, {
      width: colWidth - cellPadding * 2,
      align: col.align ?? 'left',
    });

    currentX += colWidth;
  });

  return rowHeight;
}

function drawTableBorderForPage(
  doc: any,
  startY: number,
  endY: number,
  leftX: number,
  width: number,
  borderColor: string,
  borderWidth: number,
): void {
  doc
    .rect(leftX, startY, width, endY - startY)
    .strokeColor(borderColor)
    .lineWidth(borderWidth)
    .stroke();
}

function renderTable(block: TableBlock, ctx: PdfRenderContext): void {
  const { doc, data, warnings } = ctx;

  const arrayPath = block.loopOver;
  const items = resolvePayload(arrayPath, data);

  if (!Array.isArray(items) || items.length === 0) {
    // No data available — render a single preview row with raw templates
    // (consistent with canvas preview behavior)
    warnings.push({
      blockId: block.id,
      code: 'TABLE_NO_DATA',
      message: !Array.isArray(items)
        ? `loopOver path "${arrayPath}" did not resolve to an array. Showing preview row.`
        : `loopOver path "${arrayPath}" resolved to an empty array. Showing preview row.`,
    });
  }

  const fontSize = block.styles.fontSize ?? 10;
  const cellPadding = block.styles.cellPadding ?? 6;
  const borderColor = resolveColor(block.styles.borderColor, '#E5E7EB');
  const headerBg = resolveColor(block.styles.headerBg, '#F9FAFB');
  const marginBottom = block.styles.marginBottom ?? 12;

  const pageWidth = doc.page.width;
  const margins = doc.page.margins as { left: number; right: number };
  const tableWidth = pageWidth - margins.left - margins.right;

  const columnWidths = block.columns.map((col) => {
    const pct = parseFloat(col.width) / 100;
    return tableWidth * pct;
  });

  const startX = doc.page.margins.left as number;
  let tablePageStartY = doc.y;

  const headerHeight = estimateRowHeight(
    doc,
    null,
    block.columns,
    columnWidths,
    cellPadding,
    fontSize,
    true,
    ctx,
  );

  const pageHeight = ctx.pageHeight;
  if (doc.y + headerHeight > pageHeight) {
    doc.addPage();
    tablePageStartY = doc.y;
  }

  const drawHeader = (yPos: number) => {
    return drawRow(
      doc,
      null,
      true,
      yPos,
      startX,
      columnWidths,
      block.columns,
      cellPadding,
      fontSize,
      ctx,
      headerBg,
    );
  };

  let currentY = doc.y;
  const actualHeaderHeight = drawHeader(currentY);
  currentY += actualHeaderHeight;
  doc.y = currentY;

  const stripedRows = block.styles.stripedRows ?? false;
  const stripedColor = resolveColor(block.styles.stripedColor, '#F3F4F6');

  // Use actual data rows if available, otherwise render a single preview row
  let dataRows: Record<string, unknown>[] = [{}]; // default: single preview row
  if (Array.isArray(items) && items.length > 0) {
    const filtered = (items as Record<string, unknown>[]).filter(
      (item): item is Record<string, unknown> =>
        typeof item === 'object' && item !== null,
    );
    if (filtered.length > 0) {
      dataRows = filtered;
    }
  }

  dataRows.forEach((rowData, rowIndex) => {

    const rowHeight = estimateRowHeight(
      doc,
      rowData,
      block.columns,
      columnWidths,
      cellPadding,
      fontSize,
      false,
      ctx,
    );

    if (currentY + rowHeight > pageHeight) {
      drawTableBorderForPage(
        doc,
        tablePageStartY,
        currentY,
        startX,
        tableWidth,
        borderColor,
        block.styles.borderWidth ?? 0.5,
      );

      doc.addPage();

      tablePageStartY = doc.y;
      currentY = doc.y;

      const repeatedHeaderHeight = drawHeader(currentY);
      currentY += repeatedHeaderHeight;
    }

    const bgColor =
      stripedRows && rowIndex % 2 === 1 ? stripedColor : undefined;

    const actualRowHeight = drawRow(
      doc,
      rowData,
      false,
      currentY,
      startX,
      columnWidths,
      block.columns,
      cellPadding,
      fontSize,
      ctx,
      bgColor,
    );

    doc
      .moveTo(startX, currentY + actualRowHeight)
      .lineTo(startX + tableWidth, currentY + actualRowHeight)
      .strokeColor(borderColor)
      .lineWidth(0.25)
      .stroke();

    currentY += actualRowHeight;
    doc.y = currentY;
  });

  drawTableBorderForPage(
    doc,
    tablePageStartY,
    currentY,
    startX,
    tableWidth,
    borderColor,
    block.styles.borderWidth ?? 0.5,
  );

  doc.y = currentY;
  doc.moveDown(marginBottom / fontSize);
}

registerPdfBlockRenderer('table', createBlockRenderer<TableBlock>(renderTable));
