import type {
  DocAdapter,
  DocBlock,
  DocFlowSchema,
  RenderResult,
  RenderWarning,
} from '../../schema/types.js';
import {
  escapeHtml,
  interpolateHtml,
  resolvePayload,
} from '../../parser/interpolate.js';

// ============================================================
// HTML Adapter
// Converts a DocFlowSchema + data into a self-contained HTML string.
// All interpolated values are HTML-escaped to prevent XSS.
// ============================================================

export class HtmlAdapter implements DocAdapter<string> {
  readonly name = 'html';

  async render(
    schema: DocFlowSchema,
    data: Record<string, unknown>,
  ): Promise<RenderResult<string>> {
    const startTime = Date.now();
    const warnings: RenderWarning[] = [];

    const bodyBlocks = schema.ast.filter(
      (b) => b.type !== 'header' && b.type !== 'footer',
    );

    const absoluteBlocks = bodyBlocks.filter(
      (b) => b.x !== undefined || b.y !== undefined,
    );
    const flowBlocks = bodyBlocks.filter(
      (b) => b.x === undefined && b.y === undefined,
    );

    const headerBlock = schema.ast.find((b) => b.type === 'header');
    const footerBlock = schema.ast.find((b) => b.type === 'footer');

    const mergedData = {
      ...data,
      currentPage: 1,
      totalPages: 1,
      currentDate: new Date().toLocaleDateString(),
    };

    const flowHtml = flowBlocks
      .map((block) => renderBlock(block, mergedData, warnings))
      .join('\n');

    const absoluteHtml = absoluteBlocks.length > 0
      ? `<div class="docflow-absolute-container" style="position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;overflow:hidden;">
          ${absoluteBlocks.map((block) => renderBlock(block, mergedData, warnings)).join('\n')}
         </div>`
      : '';

    const bodyHtml = `${flowHtml}\n${absoluteHtml}`;

    const headerHtml = headerBlock
      ? renderBlock(headerBlock, mergedData, warnings)
      : '';
    const footerHtml = footerBlock
      ? renderBlock(footerBlock, mergedData, warnings)
      : '';

    const headerBgColor = headerBlock?.styles?.backgroundColor ?? 'transparent';
    const headerBorderColor = headerBlock?.styles?.borderColor ?? 'transparent';
    const headerBorderWidth = headerBlock?.styles?.borderWidth ?? 0;

    const footerBgColor = footerBlock?.styles?.backgroundColor ?? 'transparent';
    const footerBorderColor = footerBlock?.styles?.borderColor ?? 'transparent';
    const footerBorderWidth = footerBlock?.styles?.borderWidth ?? 0;

    const output = buildHtmlDocument({
      title: escapeHtml(schema.metadata.title),
      pageSize: schema.metadata.pageSize,
      orientation: schema.metadata.orientation,
      margins: schema.metadata.margins,
      headerHtml,
      bodyHtml,
      footerHtml,
      headerBgColor,
      headerBorderColor,
      headerBorderWidth,
      footerBgColor,
      footerBorderColor,
      footerBorderWidth,
    });

    return {
      output,
      warnings,
      metadata: {
        pageCount: 1, // HTML doesn't have page count — consumers use print CSS
        renderTimeMs: Date.now() - startTime,
        blocksProcessed: schema.ast.length,
      },
    };
  }
}

// ============================================================
// Block renderers
// ============================================================

function renderBlock(
  block: DocBlock,
  data: Record<string, unknown>,
  warnings: RenderWarning[],
): string {
  switch (block.type) {
    case 'heading':
      return `<h${block.level} style="${absoluteStylesCss(block)};${textStyles(block.styles)}">${interpolateHtml(block.text, data)}</h${block.level}>`;

    case 'paragraph':
      return `<p style="${absoluteStylesCss(block)};${textStyles(block.styles)}">${interpolateHtml(block.text, data)}</p>`;

    case 'table':
      return renderTableHtml(block, data, warnings);

    case 'image':
      return renderImageHtml(block, data, warnings);

    case 'divider':
      return `<hr style="${absoluteStylesCss(block)};${dividerStyles(block.styles)}" />`;

    case 'spacer':
      return `<div style="${absoluteStylesCss(block)};height:${block.height}px;${baseStylesCss(block.styles)}"></div>`;

    case 'page-break':
      return `<div style="page-break-after:always;"></div>`;

    case 'columns':
      return renderColumnsHtml(block, data, warnings);

    case 'page-number': {
      const text = interpolateHtml(block.format, data)
        .replace(/{{current}}/g, String(data['currentPage'] ?? 1))
        .replace(/{{total}}/g, String(data['totalPages'] ?? 1))
        .replace(/{{currentPage}}/g, String(data['currentPage'] ?? 1))
        .replace(/{{totalPages}}/g, String(data['totalPages'] ?? 1));
      return `<div style="${absoluteStylesCss(block)};${textStyles(block.styles)}">${text}</div>`;
    }

    case 'signature': {
      const thickness = block.styles.lineWidth ?? 1;
      const lineColor = block.styles.lineColor ?? '#9CA3AF';
      const gap = block.styles.gap ?? 8;
      const fontSize = block.styles.fontSize ?? 10;
      const color = block.styles.color ?? '#374151';
      const width = block.width !== undefined ? `${block.width}pt` : '150px';
      const label = escapeHtml(block.label);
      const name = block.name ? `<strong>${escapeHtml(block.name)}</strong>` : '';
      const title = block.title ? `<em>${escapeHtml(block.title)}</em>` : '';
      return `
        <div style="${absoluteStylesCss(block)};display:inline-block;width:${width};${baseStylesCss(block.styles)}">
          <div style="border-top:${thickness}px solid ${lineColor};margin-bottom:${gap}px;width:100%;"></div>
          <div style="text-align:center;font-size:${fontSize}px;color:${color};font-family:sans-serif;line-height:1.4;">
            <div>${label}</div>
            ${name ? `<div>${name}</div>` : ''}
            ${title ? `<div>${title}</div>` : ''}
          </div>
        </div>`;
    }

    case 'container': {
      const padding = block.styles.padding ?? 8;
      const borderRadius = block.styles.borderRadius ?? 0;
      const bgColor = block.styles.backgroundColor ?? 'transparent';
      const borderColor = block.styles.borderColor ?? 'transparent';
      const borderWidth = block.styles.borderWidth ?? 0;
      const innerHtml = block.blocks.map((b) => renderBlock(b, data, warnings)).join('\n');
      const borderStyle = borderWidth > 0 ? `${borderWidth}px solid ${borderColor}` : 'none';
      const containerWidth = block.width !== undefined ? `width:${block.width}pt;` : 'width:100%;';
      return `
        <div style="${absoluteStylesCss(block)};${containerWidth}background-color:${bgColor};border:${borderStyle};border-radius:${borderRadius}px;padding:${padding}px;${baseStylesCss(block.styles)}">
          ${innerHtml}
        </div>`;
    }

    case 'barcode':
      return renderBarcodeHtml(block, data);

    case 'list': {
      const listTag = block.ordered ? 'ol' : 'ul';
      const fontStyle = textStyles(block.styles);
      const spacing = block.styles.itemSpacing !== undefined ? `margin-bottom:${block.styles.itemSpacing}px;` : '';
      
      let listStyleType = '';
      if (!block.ordered) {
        if (block.styles.bulletStyle === 'dash') listStyleType = 'list-style-type:dash;';
        else if (block.styles.bulletStyle === 'checkmark') listStyleType = 'list-style-type:"\\2713  ";';
        else listStyleType = 'list-style-type:disc;';
      } else {
        listStyleType = 'list-style-type:decimal;';
      }

      const itemsHtml = block.items
        .map((item) => `<li style="${spacing}">${interpolateHtml(item, data)}</li>`)
        .join('\n');

      return `<${listTag} style="${absoluteStylesCss(block)};${fontStyle};${listStyleType}">${itemsHtml}</${listTag}>`;
    }

    case 'chart':
      return renderChartHtml(block, data);

    case 'header':
    case 'footer':
      return block.blocks
        .map((b) => renderBlock(b, data, warnings))
        .join('\n');

    default: {
      // Exhaustive check — if TypeScript reaches here a block type was missed
      const _exhaustive: never = block;
      warnings.push({
        blockId: (_exhaustive as DocBlock).id,
        code: 'UNKNOWN_BLOCK_TYPE',
        message: `Unknown block type "${(block as DocBlock).type}". Skipped.`,
      });
      return '';
    }
  }
}

function renderTableHtml(
  block: Extract<DocBlock, { type: 'table' }>,
  data: Record<string, unknown>,
  warnings: RenderWarning[],
): string {
  const items = resolvePayload(block.loopOver, data);

  if (!Array.isArray(items)) {
    warnings.push({
      blockId: block.id,
      code: 'TABLE_DATA_NOT_ARRAY',
      message: `loopOver path "${block.loopOver}" did not resolve to an array.`,
    });
    return '';
  }

  const headerBg = block.styles.headerBg ?? '#F9FAFB';
  const borderColor = block.styles.borderColor ?? '#E5E7EB';
  const borderWidth = block.styles.borderWidth ?? 1;

  const headerCells = block.columns
    .map(
      (col) =>
        `<th style="background:${escapeHtml(headerBg)};padding:${block.styles.cellPadding ?? 8}px;text-align:${col.align ?? 'left'};width:${escapeHtml(col.width)};border:${borderWidth}px solid ${escapeHtml(borderColor)}">${escapeHtml(col.header)}</th>`,
    )
    .join('');

  const dataRows = items
    .map((item: unknown, i) => {
      if (typeof item !== 'object' || item === null) return '';
      const rowData = item as Record<string, unknown>;
      const isStriped = block.styles.stripedRows && i % 2 === 1;
      const rowBg = isStriped ? (block.styles.stripedColor ?? '#F3F4F6') : 'transparent';

      const cells = block.columns
        .map((col) => {
          const resolvedValue = interpolateHtml(col.value, {
            ...data,
            item: rowData,
          });
          return `<td style="padding:${block.styles.cellPadding ?? 8}px;text-align:${col.align ?? 'left'};border:${borderWidth}px solid ${escapeHtml(borderColor)}">${resolvedValue}</td>`;
        })
        .join('');

      return `<tr style="background:${escapeHtml(rowBg)}">${cells}</tr>`;
    })
    .join('');

  const absStyles = absoluteStylesCss(block);
  const widthStyle = block.width !== undefined ? `width:${block.width}pt;` : 'width:100%;';

  return `
<table style="${absStyles};${widthStyle}border-collapse:collapse;${baseStylesCss(block.styles)}">
  <thead><tr>${headerCells}</tr></thead>
  <tbody>${dataRows}</tbody>
</table>`;
}

function renderImageHtml(
  block: Extract<DocBlock, { type: 'image' }>,
  data: Record<string, unknown>,
  warnings: RenderWarning[],
): string {
  const src = interpolateHtml(block.src, data);

  if (!src) {
    warnings.push({
      blockId: block.id,
      code: 'IMAGE_SRC_EMPTY',
      message: 'Image block has no src. Skipped.',
    });
    return '';
  }

  const absStyles = absoluteStylesCss(block);
  const width = block.width !== undefined ? `${block.width}pt` : (typeof block.styles.width === 'number' ? `${block.styles.width}px` : (block.styles.width ?? '100%'));
  const height = block.height !== undefined ? `${block.height}pt` : (typeof block.styles.height === 'number' ? `${block.styles.height}px` : (block.styles.height ?? 'auto'));

  return `<img src="${src}" alt="${escapeHtml(block.alt)}" style="${absStyles};display:block;width:${escapeHtml(String(width))};height:${escapeHtml(String(height))};object-fit:${block.styles.objectFit ?? 'contain'};border-radius:${block.styles.borderRadius ?? 0}px;${baseStylesCss(block.styles)}" />`;
}

function renderColumnsHtml(
  block: Extract<DocBlock, { type: 'columns' }>,
  data: Record<string, unknown>,
  warnings: RenderWarning[],
): string {
  const cols = block.columns
    .map((col) => {
      const inner = col.blocks
        .map((b) => renderBlock(b, data, warnings))
        .join('\n');
      return `<div style="width:${escapeHtml(col.width)};padding:0 8px;box-sizing:border-box;">${inner}</div>`;
    })
    .join('');

  return `<div style="${absoluteStylesCss(block)};display:flex;flex-wrap:wrap;${baseStylesCss(block.styles)}">${cols}</div>`;
}

// ============================================================
// CSS style helpers
// ============================================================

function baseStylesCss(styles: {
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
}): string {
  const parts: string[] = [];
  if (styles.marginTop !== undefined) parts.push(`margin-top:${styles.marginTop}px`);
  if (styles.marginBottom !== undefined) parts.push(`margin-bottom:${styles.marginBottom}px`);
  if (styles.marginLeft !== undefined) parts.push(`margin-left:${styles.marginLeft}px`);
  if (styles.marginRight !== undefined) parts.push(`margin-right:${styles.marginRight}px`);
  if (styles.paddingTop !== undefined) parts.push(`padding-top:${styles.paddingTop}px`);
  if (styles.paddingBottom !== undefined) parts.push(`padding-bottom:${styles.paddingBottom}px`);
  if (styles.paddingLeft !== undefined) parts.push(`padding-left:${styles.paddingLeft}px`);
  if (styles.paddingRight !== undefined) parts.push(`padding-right:${styles.paddingRight}px`);
  return parts.join(';');
}

function textStyles(styles: {
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  textAlign?: string;
  lineHeight?: number;
  letterSpacing?: number;
  textDecoration?: string;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
}): string {
  const parts: string[] = [baseStylesCss(styles)];
  if (styles.color) parts.push(`color:${styles.color}`);
  if (styles.fontSize) parts.push(`font-size:${styles.fontSize}px`);
  if (styles.fontFamily) parts.push(`font-family:${styles.fontFamily}`);
  if (styles.fontWeight) parts.push(`font-weight:${styles.fontWeight}`);
  if (styles.textAlign) parts.push(`text-align:${styles.textAlign}`);
  if (styles.lineHeight) parts.push(`line-height:${styles.lineHeight}`);
  if (styles.letterSpacing) parts.push(`letter-spacing:${styles.letterSpacing}px`);
  if (styles.textDecoration) parts.push(`text-decoration:${styles.textDecoration}`);
  return parts.filter(Boolean).join(';');
}

function dividerStyles(styles: {
  color?: string;
  thickness?: number;
  style?: string;
  marginTop?: number;
  marginBottom?: number;
}): string {
  const parts = [baseStylesCss(styles)];
  parts.push(`border:none`);
  parts.push(`border-top:${styles.thickness ?? 1}px ${styles.style ?? 'solid'} ${styles.color ?? '#E5E7EB'}`);
  return parts.join(';');
}

// ============================================================
// HTML document wrapper
// ============================================================

interface HtmlDocumentOptions {
  title: string;
  pageSize: string;
  orientation: string;
  margins: { top: number; bottom: number; left: number; right: number };
  headerHtml: string;
  bodyHtml: string;
  footerHtml: string;
  headerBgColor: string;
  headerBorderColor: string;
  headerBorderWidth: number;
  footerBgColor: string;
  footerBorderColor: string;
  footerBorderWidth: number;
}

function buildHtmlDocument(opts: HtmlDocumentOptions): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${opts.title}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      background: #f0f0f0;
      color: #111;
    }
    .docflow-page {
      background: white;
      position: relative;
      width: ${opts.pageSize === 'A4' ? '210mm' : '8.5in'};
      min-height: ${opts.pageSize === 'A4' ? '297mm' : '11in'};
      margin: 24px auto;
      padding: ${opts.margins.top}pt ${opts.margins.right}pt ${opts.margins.bottom}pt ${opts.margins.left}pt;
      box-shadow: 0 4px 24px rgba(0,0,0,0.12);
    }
    .docflow-header {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: ${opts.margins.top}pt;
      background-color: ${opts.headerBgColor};
      border-bottom: ${opts.headerBorderWidth}pt solid ${opts.headerBorderColor};
    }
    .docflow-footer {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: ${opts.margins.bottom}pt;
      background-color: ${opts.footerBgColor};
      border-top: ${opts.footerBorderWidth}pt solid ${opts.footerBorderColor};
    }
    @media print {
      body { background: white; }
      .docflow-page { margin: 0; box-shadow: none; width: 100%; }
      @page {
        size: ${opts.pageSize} ${opts.orientation};
        margin: ${opts.margins.top}pt ${opts.margins.right}pt ${opts.margins.bottom}pt ${opts.margins.left}pt;
      }
    }
  </style>
</head>
<body>
  <div class="docflow-page">
    ${opts.headerHtml ? `<header class="docflow-header">${opts.headerHtml}</header>` : ''}
    <main>${opts.bodyHtml}</main>
    ${opts.footerHtml ? `<footer class="docflow-footer">${opts.footerHtml}</footer>` : ''}
  </div>
</body>
  </html>`;
}

function absoluteStylesCss(block: DocBlock): string {
  const parts: string[] = [];
  if (block.x !== undefined) parts.push(`left:${block.x}pt`);
  if (block.y !== undefined) parts.push(`top:${block.y}pt`);
  if (block.width !== undefined) parts.push(`width:${block.width}pt`);
  if (block.height !== undefined) parts.push(`height:${block.height}pt`);

  if (parts.length > 0) {
    parts.push(`position:absolute`);
    parts.push(`pointer-events:auto`);
  }
  return parts.join(';');
}

function renderBarcodeHtml(
  block: Extract<DocBlock, { type: 'barcode' }>,
  data: Record<string, unknown>,
): string {
  const value = interpolateHtml(block.value, data) || 'DOCFLOW';
  const width = block.styles.width ?? 120;
  const height = block.styles.height ?? 50;
  const color = block.styles.color ?? '#000000';

  if (block.format === 'qr') {
    const size = 21;
    const moduleSize = 4;
    const svgW = size * moduleSize;
    const svgH = size * moduleSize;

    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = value.charCodeAt(i) + ((hash << 5) - hash);
    }
    const pseudoRandom = () => {
      const x = Math.sin(hash++) * 10000;
      return x - Math.floor(x);
    };

    const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

    const drawFinder = (rowOffset: number, colOffset: number) => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
          const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          if (isBorder || isCenter) matrix[rowOffset + r]![colOffset + c] = true;
        }
      }
    };

    drawFinder(0, 0);
    drawFinder(0, size - 7);
    drawFinder(size - 7, 0);

    for (let i = 7; i < size - 7; i++) {
      const isEven = i % 2 === 0;
      matrix[6]![i] = isEven;
      matrix[i]![6] = isEven;
    }

    for (let r = 14; r < 17; r++) {
      for (let c = 14; c < 17; c++) {
        const isBorder = r === 14 || r === 16 || c === 14 || c === 16;
        const isCenter = r === 15 && c === 15;
        if (isBorder || isCenter) matrix[r]![c] = true;
      }
    }

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const inTopLeftFinder = r < 9 && c < 9;
        const inTopRightFinder = r < 9 && c >= size - 9;
        const inBottomLeftFinder = r >= size - 9 && c < 9;
        const inAlignment = r >= 13 && r <= 17 && c >= 13 && c <= 17;
        const isTiming = r === 6 || c === 6;

        if (!inTopLeftFinder && !inTopRightFinder && !inBottomLeftFinder && !inAlignment && !isTiming) {
          matrix[r]![c] = pseudoRandom() > 0.5;
        }
      }
    }

    let rects = '';
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (matrix[r]![c]) {
          rects += `<rect x="${c * moduleSize}" y="${r * moduleSize}" width="${moduleSize}" height="${moduleSize}" fill="${escapeHtml(color)}" />`;
        }
      }
    }

    return `<svg viewBox="0 0 ${svgW} ${svgH}" width="${width}" height="${height}" style="${absoluteStylesCss(block)};${baseStylesCss(block.styles)}">${rects}</svg>`;
  } else {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = value.charCodeAt(i) + ((hash << 5) - hash);
    }
    const pseudoRandom = () => {
      const x = Math.sin(hash++) * 10000;
      return x - Math.floor(x);
    };

    const pattern = [2, 1, 1, 2];
    for (let i = 0; i < 15; i++) {
      pattern.push(Math.floor(pseudoRandom() * 3) + 1);
      pattern.push(Math.floor(pseudoRandom() * 3) + 1);
    }
    pattern.push(2, 1, 2, 1);

    const totalUnits = pattern.reduce((sum, val) => sum + val, 0);
    const svgW = totalUnits * 2;

    let currentX = 0;
    let rects = '';
    pattern.forEach((unitCount, idx) => {
      const isBar = idx % 2 === 0;
      const stripeWidth = unitCount * 2;
      if (isBar) {
        rects += `<rect x="${currentX}" y="0" width="${stripeWidth}" height="${height - 12}" fill="${escapeHtml(color)}" />`;
      }
      currentX += stripeWidth;
    });

    return `
      <div style="${absoluteStylesCss(block)};display:inline-block;width:${width}px;${baseStylesCss(block.styles)}">
        <svg viewBox="0 0 ${svgW} ${height - 12}" width="100%" height="${height - 12}" style="display:block;">${rects}</svg>
        <div style="font-family:sans-serif;font-size:8px;color:${color};text-align:center;margin-top:2px;">${escapeHtml(value)}</div>
      </div>`;
  }
}

function renderChartHtml(
  block: Extract<DocBlock, { type: 'chart' }>,
  data: Record<string, unknown>,
): string {
  const rawData = resolvePayload(block.loopOver, data);
  const dataList = Array.isArray(rawData) ? rawData : [];

  const labels: string[] = [];
  const values: number[] = [];

  dataList.forEach((item) => {
    if (item && typeof item === 'object') {
      const label = String((item as any)[block.labelKey] ?? '');
      const value = parseFloat((item as any)[block.valueKey]);
      labels.push(label);
      values.push(isNaN(value) ? 0 : value);
    }
  });

  let chartLabels = labels;
  let chartValues = values;
  if (chartLabels.length === 0) {
    chartLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May'];
    chartValues = [30, 75, 45, 90, 60];
  }

  const width = block.styles.width ?? 350;
  const height = block.styles.height ?? 150;
  const colors = block.styles.colors ?? ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  if (block.chartType === 'pie') {
    const total = chartValues.reduce((sum, v) => sum + v, 0) || 1;
    const radius = Math.min(width, height) * 0.4;
    const centerX = width / 3;
    const centerY = height / 2;

    let currentAngle = 0;
    let paths = '';
    chartValues.forEach((val, i) => {
      const sliceAngle = (val / total) * 360;
      const col = colors[i % colors.length] ?? '#3B82F6';

      const x1 = centerX + radius * Math.cos((currentAngle - 90) * Math.PI / 180);
      const y1 = centerY + radius * Math.sin((currentAngle - 90) * Math.PI / 180);
      const x2 = centerX + radius * Math.cos((currentAngle + sliceAngle - 90) * Math.PI / 180);
      const y2 = centerY + radius * Math.sin((currentAngle + sliceAngle - 90) * Math.PI / 180);

      const largeArcFlag = sliceAngle > 180 ? 1 : 0;

      paths += `<path d="M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z" fill="${escapeHtml(col)}" />`;

      currentAngle += sliceAngle;
    });

    let legendItems = '';
    const legendX = (width * 2) / 3 - 10;
    const legendY = 15;
    const itemHeight = 14;

    chartValues.forEach((val, i) => {
      if (i > 8) return;
      const col = colors[i % colors.length] ?? '#3B82F6';
      const percent = ((val / total) * 100).toFixed(0);
      legendItems += `
        <rect x="${legendX}" y="${legendY + i * itemHeight}" width="8" height="8" fill="${escapeHtml(col)}" />
        <text x="${legendX + 14}" y="${legendY + i * itemHeight + 7}" font-family="sans-serif" font-size="8px" fill="#374151">${escapeHtml(chartLabels[i] ?? '')}: ${val} (${percent}%)</text>`;
    });

    return `
      <svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="${absoluteStylesCss(block)};${baseStylesCss(block.styles)}">
        ${paths}
        ${legendItems}
      </svg>`;
  } else {
    const paddingLeft = 30;
    const paddingBottom = 20;
    const paddingTop = 15;
    const paddingRight = 10;
    const chartW = width - paddingLeft - paddingRight;
    const chartH = height - paddingTop - paddingBottom;

    const originX = paddingLeft;
    const originY = height - paddingBottom;

    const maxVal = Math.max(...chartValues, 1);
    const barCount = chartValues.length;
    const barSpacing = chartW / barCount;

    let elements = '';

    elements += `<line x1="${originX}" y1="${originY}" x2="${originX + chartW}" y2="${originY}" stroke="#D1D5DB" stroke-width="1" />`;
    elements += `<line x1="${originX}" y1="${originY}" x2="${originX}" y2="${paddingTop}" stroke="#D1D5DB" stroke-width="1" />`;

    if (block.chartType === 'bar') {
      const barWidth = barSpacing * 0.6;
      chartValues.forEach((val, i) => {
        const barH = (val / maxVal) * chartH;
        const barX = originX + i * barSpacing + (barSpacing - barWidth) / 2;
        const barY = originY - barH;
        const col = colors[i % colors.length] ?? '#3B82F6';

        elements += `<rect x="${barX}" y="${barY}" width="${barWidth}" height="${barH}" fill="${escapeHtml(col)}" />`;
        elements += `<text x="${barX + barWidth / 2}" y="${barY - 3}" font-family="sans-serif" font-size="7px" font-weight="bold" fill="#374151" text-anchor="middle">${val}</text>`;
        elements += `<text x="${originX + i * barSpacing + barSpacing / 2}" y="${originY + 12}" font-family="sans-serif" font-size="7px" fill="#6B7280" text-anchor="middle">${escapeHtml(chartLabels[i] ?? '')}</text>`;
      });
    } else {
      let pathPoints = '';
      chartValues.forEach((val, i) => {
        const pointX = originX + i * barSpacing + barSpacing / 2;
        const pointY = originY - (val / maxVal) * chartH;
        pathPoints += `${i === 0 ? 'M' : 'L'} ${pointX} ${pointY} `;
      });

      elements += `<path d="${pathPoints}" fill="none" stroke="${escapeHtml(colors[0] ?? '#3B82F6')}" stroke-width="2" />`;

      chartValues.forEach((val, i) => {
        const pointX = originX + i * barSpacing + barSpacing / 2;
        const pointY = originY - (val / maxVal) * chartH;
        const col = colors[0] ?? '#3B82F6';

        elements += `<circle cx="${pointX}" cy="${pointY}" r="3" fill="${escapeHtml(col)}" />`;
        elements += `<text x="${pointX}" y="${pointY - 4}" font-family="sans-serif" font-size="7px" font-weight="bold" fill="#374151" text-anchor="middle">${val}</text>`;
        elements += `<text x="${pointX}" y="${originY + 12}" font-family="sans-serif" font-size="7px" fill="#6B7280" text-anchor="middle">${escapeHtml(chartLabels[i] ?? '')}</text>`;
      });
    }

    return `
      <svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="${absoluteStylesCss(block)};${baseStylesCss(block.styles)}">
        ${elements}
      </svg>`;
  }
}
