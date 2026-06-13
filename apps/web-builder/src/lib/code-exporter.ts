import { PAGE_SIZES } from '@docflow/core/constants';
import type { DocFlowSchema, DocBlock, TableColumn } from '@docflow/core';

// ============================================================
// Text cleaning — replaces {{path.to.var}} with either
// ${data.path?.to?.var} for plain blocks or
// ${loopOverVar[idx]?.field} for table cell values.
// ============================================================

function cleanText(text: string, tableCtx?: { loopOver: string; itemVar: string }): string {
  if (text.includes('{{')) {
    const jsTemplate = text.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
      const trimmed = path.trim();
      const parts = trimmed.split('.');

      // Inside a table column: "item.field" → "items[rowIdx]?.field"
      if (tableCtx && parts[0] === tableCtx.itemVar) {
        const restPath = parts.slice(1).map((p: string) => `?.${p}`).join('');
        return `\${${tableCtx.loopOver}[rowIdx]${restPath} ?? ''}`;
      }

      // Plain blocks: "variable" or "nested.path" → "data.variable" or "data.nested?.path"
      const safePath = parts.map((p: string, i: number) => i === 0 ? p : `?.${p}`).join('');
      return `\${data.${safePath} ?? ''}`;
    });
    return `\`${jsTemplate}\``;
  }
  return JSON.stringify(text);
}

// ============================================================
// Variable extraction — builds a mock data object from the AST
// with table-aware array generation.
// ============================================================

function extractVariables(ast: DocBlock[]): Record<string, any> {
  const vars: Record<string, any> = {};
  const regex = /\{\{([^}]+)\}\}/g;

  // Add a non-table variable path: "nested.field" → { nested: { field: "..." } }
  const addPath = (path: string) => {
    const segments = path.trim().split('.');
    let current = vars;
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]!;
      if (i === segments.length - 1) {
        current[segment] = `[${segment}]`;
      } else {
        if (!current[segment] || typeof current[segment] !== 'object') {
          current[segment] = {};
        }
        current = current[segment];
      }
    }
  };

  // Add a table variable path: table with loopOver="items" and
  // column value "{{item.name}}" → { items: [{ name: "[name]" }] }
  const addTablePath = (loopOver: string, itemVar: string, field: string) => {
    // Ensure the loopOver array exists in vars
    if (!vars[loopOver] || !Array.isArray(vars[loopOver])) {
      vars[loopOver] = [{}];
    }
    const arr = vars[loopOver] as Record<string, any>[];
    const firstItem = arr[0]!;
    firstItem[field] = `[${field}]`;
  };

  // Scan all text in a block for {{variables}}
  const checkText = (text: string, tableCtx?: { loopOver: string; itemVar: string }) => {
    let match;
    regex.lastIndex = 0;
    while ((match = regex.exec(text)) !== null) {
      if (match[1]) {
        const trimmed = match[1].trim();
        const parts = trimmed.split('.');
        // Table-context variable: item.field → added to array
        if (tableCtx && parts[0] === tableCtx.itemVar && parts.length > 1) {
          addTablePath(tableCtx.loopOver, tableCtx.itemVar, parts.slice(1).join('.'));
        } else {
          addPath(trimmed);
        }
      }
    }
  };

  for (const block of ast) {
    if (block.type === 'table') {
      const table = block as Extract<DocBlock, { type: 'table' }>;
      const loopOver = table.loopOver;

      // The item variable is whatever comes before the first dot in column values
      let itemVar = 'item';
      for (const col of table.columns) {
        if (col.value?.includes('{{')) {
          const m = col.value.match(/\{\{([^.}]+)\./);
          if (m && m[1]) {
            itemVar = m[1];
            break;
          }
        }
      }

      const tableCtx = { loopOver, itemVar };

      // Process column values with table context
      for (const col of table.columns) {
        if (col.value) checkText(col.value, tableCtx);
        if (col.header) checkText(col.header);
      }
    } else {
      // Non-table blocks: regular variable extraction
      if ('text' in block && (block as any).text) checkText((block as any).text);
      if ('src' in block && (block as any).src) checkText((block as any).src);
      if ('alt' in block && (block as any).alt) checkText((block as any).alt);
    }
  }

  return vars;
}

// ============================================================
// Build merged data object from customVariables + uploadedJson
// + AST-extracted mock variables
// ============================================================

function buildExportData(
  schema: DocFlowSchema,
  astVariables: Record<string, any>,
): Record<string, any> {
  const data: Record<string, any> = {};

  // 1. Custom variables first (flat key-value)
  for (const v of schema.metadata.customVariables ?? []) {
    data[v.key] = v.value;
  }

  // 2. Uploaded JSON payload (shallow merge)
  const rawJson = schema.metadata.uploadedJson ?? '';
  if (rawJson.trim()) {
    try {
      const parsed = JSON.parse(rawJson);
      if (typeof parsed === 'object' && parsed !== null) {
        for (const [key, val] of Object.entries(parsed)) {
          if (!(key in data)) {
            data[key] = val;
          }
        }
      }
    } catch {
      // silently ignore invalid JSON
    }
  }

  // 3. AST-extracted mock variables fill in any gaps
  for (const [key, val] of Object.entries(astVariables)) {
    if (!(key in data)) {
      data[key] = val;
    }
  }

  return data;
}

// ============================================================
// Block-to-code renderer
// ============================================================

function renderBlockToCode(block: DocBlock, schema: DocFlowSchema, indent: string, yOffsetExpr?: string): string {
  let code = '';
  switch (block.type) {
    case 'heading': {
      const fontSize = block.styles.fontSize ?? (26 - block.level * 2);
      const color = block.styles.color ?? '#111827';
      const textVal = cleanText(block.text);
      const textOptions = {
        align: block.styles.textAlign ?? 'left',
        ...(block.width !== undefined && { width: block.width }),
        ...(block.height !== undefined && { height: block.height }),
      };
      code += `${indent}doc.fontSize(${fontSize})\n`;
      code += `${indent}   .fillColor(${JSON.stringify(color)})\n`;
      code += `${indent}   .font('Helvetica-Bold')\n`;
      const x = block.x !== undefined ? block.x : schema.metadata.margins.left;
      const y = block.y !== undefined
        ? (yOffsetExpr ? `${yOffsetExpr} + ${block.y}` : block.y)
        : 10;
      code += `${indent}   .text(${textVal}, ${x}, ${y}, ${JSON.stringify(textOptions)});\n\n`;
      break;
    }

    case 'paragraph': {
      const fontSize = block.styles.fontSize ?? 11;
      const color = block.styles.color ?? '#374151';
      const fontName = block.styles.fontWeight === 'bold' ? 'Helvetica-Bold' : 'Helvetica';
      const textVal = cleanText(block.text);
      const textOptions = {
        align: block.styles.textAlign ?? 'left',
        lineGap: (block.styles.lineHeight ?? 1.5) * fontSize - fontSize,
        ...(block.width !== undefined && { width: block.width }),
        ...(block.height !== undefined && { height: block.height }),
      };
      code += `${indent}doc.fontSize(${fontSize})\n`;
      code += `${indent}   .fillColor(${JSON.stringify(color)})\n`;
      code += `${indent}   .font(${JSON.stringify(fontName)})\n`;
      const x = block.x !== undefined ? block.x : schema.metadata.margins.left;
      const y = block.y !== undefined
        ? (yOffsetExpr ? `${yOffsetExpr} + ${block.y}` : block.y)
        : 10;
      code += `${indent}   .text(${textVal}, ${x}, ${y}, ${JSON.stringify(textOptions)});\n\n`;
      break;
    }

    case 'table': {
      const table = block as Extract<DocBlock, { type: 'table' }>;
      const fontSize = table.styles.fontSize ?? 10;
      const cellPadding = table.styles.cellPadding ?? 6;
      const borderColor = table.styles.borderColor ?? '#E5E7EB';
      const borderWidth = table.styles.borderWidth ?? 1;
      const headerBg = table.styles.headerBg ?? '#F3F4F6';
      const headerColor = table.styles.headerColor ?? '#111827';
      const stripedRows = table.styles.stripedRows ?? false;
      const stripedColor = table.styles.stripedColor ?? '#F3F4F6';
      const marginBottom = table.styles.marginBottom ?? 12;

      // Determine item variable from column values
      let itemVar = 'item';
      for (const col of table.columns) {
        if (col.value?.includes('{{')) {
          const m = col.value.match(/\{\{([^.}]+)\./);
          if (m && m[1]) { itemVar = m[1]; break; }
        }
      }

      const loopOver = table.loopOver;
      const tableCtx = { loopOver, itemVar };

      // Calculate column widths as percentages of page width
      code += `${indent}const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;\n`;
      code += `${indent}const tableStartX = doc.page.margins.left;\n`;
      code += `${indent}const colWidths = [${table.columns.map((c) => `tableWidth * (${parseFloat(c.width)} / 100)`).join(', ')}];\n`;
      code += `${indent}const cellPad = ${cellPadding};\n`;

      // Draw header row
      code += `\n${indent}// Table header row\n`;
      code += `${indent}const tableHeaderStartY = doc.y;\n`;
      code += `${indent}doc.fontSize(${fontSize}).font('Helvetica-Bold');\n`;
      code += `${indent}let thX = tableStartX;\n`;
      for (const col of table.columns) {
        const headerText = JSON.stringify(col.header);
        code += `${indent}doc.fillColor(${JSON.stringify(headerColor)});\n`;
        code += `${indent}doc.rect(thX, doc.y, colWidths[${table.columns.indexOf(col)}], doc.currentLineHeight() + cellPad * 2).fill(${JSON.stringify(headerBg)});\n`;
        code += `${indent}doc.fillColor(${JSON.stringify(headerColor)});\n`;
        code += `${indent}doc.text(${headerText}, thX + cellPad, doc.y + cellPad, { width: colWidths[${table.columns.indexOf(col)}] - cellPad * 2, align: ${JSON.stringify(col.align ?? 'left')} });\n`;
        code += `${indent}thX += colWidths[${table.columns.indexOf(col)}];\n`;
      }
      code += `${indent}doc.moveDown(0.5);\n`;
      code += `${indent}const headerEndY = doc.y;\n\n`;

      // Data rows
      code += `${indent}// Table data rows (loop over ${loopOver})\n`;
      code += `${indent}const ${loopOver}Data = data.${loopOver} ?? [];\n`;
      code += `${indent}for (let rowIdx = 0; rowIdx < ${loopOver}Data.length; rowIdx++) {\n`;
      code += `${indent}  const row = ${loopOver}Data[rowIdx];\n`;
      code += `${indent}  const isOdd = rowIdx % 2 === 1;\n`;
      code += `${indent}  let rowX = tableStartX;\n`;
      code += `${indent}  const rowY = doc.y;\n`;
      code += `${indent}  doc.fontSize(${fontSize}).font('Helvetica');\n`;

      if (stripedRows) {
        code += `${indent}  if (isOdd) {\n`;
        code += `${indent}    doc.rect(tableStartX, rowY, tableWidth, doc.currentLineHeight() + cellPad * 2).fill(${JSON.stringify(stripedColor)});\n`;
        code += `${indent}  }\n`;
      }

      for (const col of table.columns) {
        const cellValue = cleanText(col.value, tableCtx);
        code += `${indent}  doc.fillColor('#374151');\n`;
        code += `${indent}  doc.text(${cellValue}, rowX + cellPad, rowY + cellPad, { width: colWidths[${table.columns.indexOf(col)}] - cellPad * 2 });\n`;
        code += `${indent}  rowX += colWidths[${table.columns.indexOf(col)}];\n`;
      }

      code += `${indent}  doc.moveDown(0.5);\n`;
      code += `${indent}}\n\n`;

      // Table border
      code += `${indent}// Table outer border\n`;
      code += `${indent}doc\n`;
      code += `${indent}  .rect(tableStartX, tableHeaderStartY, tableWidth, doc.y - tableHeaderStartY)\n`;
      code += `${indent}  .strokeColor(${JSON.stringify(borderColor)})\n`;
      code += `${indent}  .lineWidth(${borderWidth})\n`;
      code += `${indent}  .stroke();\n\n`;

      code += `${indent}doc.moveDown(${marginBottom / 12});\n\n`;
      break;
    }

    case 'divider': {
      const color = block.styles.color ?? '#E5E7EB';
      const thickness = block.styles.thickness ?? 1;
      const xStart = block.x ?? schema.metadata.margins.left;
      const sizeTuple = PAGE_SIZES[schema.metadata.pageSize] || PAGE_SIZES.LETTER;
      const pageWidth = schema.metadata.orientation === 'landscape' ? sizeTuple[1] : sizeTuple[0];
      const defaultWidth = pageWidth - schema.metadata.margins.left - schema.metadata.margins.right;
      const xEnd = xStart + (block.width ?? defaultWidth);
      const yVal = block.y !== undefined
        ? (yOffsetExpr ? `${yOffsetExpr} + ${block.y}` : block.y)
        : `doc.y`;
      code += `${indent}doc.moveTo(${xStart}, ${yVal})\n`;
      code += `${indent}   .lineTo(${xEnd}, ${yVal})\n`;
      code += `${indent}   .strokeColor(${JSON.stringify(color)})\n`;
      code += `${indent}   .lineWidth(${thickness})\n`;
      code += `${indent}   .stroke();\n\n`;
      break;
    }

    case 'image': {
      const srcVal = cleanText(block.src);
      const imgWidth = block.width ?? 150;
      const imgHeight = block.height ?? 100;
      const xVal = block.x ?? 50;
      const yVal = block.y !== undefined
        ? (yOffsetExpr ? `${yOffsetExpr} + ${block.y}` : block.y)
        : 100;
      code += `${indent}doc.image(${srcVal}, ${xVal}, ${yVal}, { width: ${imgWidth}, height: ${imgHeight} });\n\n`;
      break;
    }

    case 'spacer': {
      code += `${indent}doc.moveDown(${block.height / 12});\n\n`;
      break;
    }

    case 'page-break': {
      code += `${indent}doc.addPage();\n`;
      break;
    }

    default:
      code += `${indent}// [Warning] Block type ${block.type} translation is not fully supported.\n\n`;
  }
  return code;
}

// ============================================================
// Main export function
// ============================================================

export function exportToPdfKit(schema: DocFlowSchema, lang: 'typescript' | 'javascript' = 'typescript'): string {
  const astVariables = extractVariables(schema.ast);
  const mergedData = buildExportData(schema, astVariables);

  const headerBlock = schema.ast.find((b) => b.type === 'header');
  const footerBlock = schema.ast.find((b) => b.type === 'footer');

  // Sort body blocks by page, then Y, then X to render sequentially
  const sortedBlocks = [...schema.ast]
    .filter((b) => b.type !== 'header' && b.type !== 'footer')
    .sort((a, b) => {
      const pA = a.page ?? 0;
      const pB = b.page ?? 0;
      if (pA !== pB) return pA - pB;
      const yA = a.y ?? 0;
      const yB = b.y ?? 0;
      return yA - yB;
    });

  const imports = lang === 'typescript'
    ? `import PDFDocument from 'pdfkit';\nimport * as fs from 'fs';`
    : `const PDFDocument = require('pdfkit');\nconst fs = require('fs');`;

  const dataDecl = `// Payload data for interpolation\nconst data = ${JSON.stringify(mergedData, null, 2)};\n`;

  let code = `/**\n * Generated by DocFlow PDF Exporter\n */\n\n${imports}\n\n${dataDecl}\n`;
  code += `function generatePDF() {\n`;
  code += `  const doc = new PDFDocument({\n`;
  code += `    size: ${JSON.stringify(schema.metadata.pageSize)},\n`;
  code += `    layout: ${JSON.stringify(schema.metadata.orientation)},\n`;
  code += `    margins: ${JSON.stringify(schema.metadata.margins)},\n`;
  code += `  });\n\n`;
  code += `  doc.pipe(fs.createWriteStream('output.pdf'));\n\n`;

  let currentPage = 0;

  for (const block of sortedBlocks) {
    const blockPage = block.page ?? 0;
    while (currentPage < blockPage) {
      code += `  doc.addPage();\n`;
      currentPage++;
    }

    code += `  // Block ID: ${block.id} (${block.type})\n`;
    code += renderBlockToCode(block, schema, '  ');
  }

  if (headerBlock || footerBlock) {
    code += `  // Draw repeating headers and footers on all pages\n`;
    code += `  const totalPages = doc.bufferedPageRange().count;\n`;
    code += `  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {\n`;
    code += `    doc.switchToPage(pageIdx);\n\n`;

    if (headerBlock) {
      code += `    // Header styling & sub-blocks\n`;
      if (headerBlock.styles?.backgroundColor || headerBlock.styles?.borderColor) {
        code += `    doc.save();\n`;
        if (headerBlock.styles.backgroundColor) {
          code += `    doc.rect(0, 0, doc.page.width, ${schema.metadata.margins.top}).fill(${JSON.stringify(headerBlock.styles.backgroundColor)});\n`;
        }
        if (headerBlock.styles.borderColor) {
          const w = headerBlock.styles.borderWidth ?? 1;
          code += `    doc.lineWidth(${w}).strokeColor(${JSON.stringify(headerBlock.styles.borderColor)}).moveTo(0, ${schema.metadata.margins.top - w / 2}).lineTo(doc.page.width, ${schema.metadata.margins.top - w / 2}).stroke();\n`;
        }
        code += `    doc.restore();\n`;
      }
      if (headerBlock.blocks) {
        for (const child of headerBlock.blocks) {
          code += `    // Header child: ${child.type}\n`;
          code += renderBlockToCode(child, schema, '    ');
        }
      }
    }

    if (footerBlock) {
      code += `    // Footer styling & sub-blocks\n`;
      code += `    const footerStartY = doc.page.height - ${schema.metadata.margins.bottom};\n`;
      if (footerBlock.styles?.backgroundColor || footerBlock.styles?.borderColor) {
        code += `    doc.save();\n`;
        if (footerBlock.styles.backgroundColor) {
          code += `    doc.rect(0, footerStartY, doc.page.width, ${schema.metadata.margins.bottom}).fill(${JSON.stringify(footerBlock.styles.backgroundColor)});\n`;
        }
        if (footerBlock.styles.borderColor) {
          const w = footerBlock.styles.borderWidth ?? 1;
          code += `    doc.lineWidth(${w}).strokeColor(${JSON.stringify(footerBlock.styles.borderColor)}).moveTo(0, footerStartY + w / 2).lineTo(doc.page.width, footerStartY + w / 2).stroke();\n`;
        }
        code += `    doc.restore();\n`;
      }
      if (footerBlock.blocks) {
        for (const child of footerBlock.blocks) {
          code += `    // Footer child: ${child.type}\n`;
          code += renderBlockToCode(child, schema, '    ', 'footerStartY');
        }
      }
    }

    code += `  }\n\n`;
  }

  code += `  doc.end();\n`;
  code += `}\n\n`;
  code += `generatePDF();\n`;

  return code;
}
