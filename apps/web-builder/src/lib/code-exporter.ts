import { PAGE_SIZES } from '@docflow/core/constants';
import type { DocFlowSchema, DocBlock } from '@docflow/core';

function cleanText(text: string): string {
  if (text.includes('{{')) {
    // Replace {{path.to.val}} with ${data.path?.to?.val ?? ''}
    const jsTemplate = text.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
      const parts = path.trim().split('.');
      const safePath = parts.map((p: string, i: number) => i === 0 ? p : `?.${p}`).join('');
      return `\${data.${safePath} ?? ''}`;
    });
    return `\`${jsTemplate}\``;
  }
  return JSON.stringify(text);
}

function extractVariables(ast: DocBlock[]): Record<string, any> {
  const vars: Record<string, any> = {};
  const regex = /\{\{([^}]+)\}\}/g;

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

  const checkText = (text: string) => {
    let match;
    regex.lastIndex = 0;
    while ((match = regex.exec(text)) !== null) {
      if (match[1]) {
        addPath(match[1]);
      }
    }
  };

  for (const block of ast) {
    if ('text' in block && block.text) checkText(block.text);
    if ('columns' in block && Array.isArray(block.columns)) {
      for (const col of block.columns) {
        if ('value' in col && col.value) checkText(col.value);
        if ('header' in col && col.header) checkText(col.header);
      }
    }
  }

  return vars;
}

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

export function exportToPdfKit(schema: DocFlowSchema, lang: 'typescript' | 'javascript' = 'typescript'): string {
  const variables = extractVariables(schema.ast);

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

  const dataDecl = `// Mock payload data for interpolation\nconst data = ${JSON.stringify(variables, null, 2)};\n`;

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
