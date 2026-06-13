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
