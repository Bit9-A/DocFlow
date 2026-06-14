// Import all block renderers — side-effect imports that register themselves
import './blocks/heading.js';
import './blocks/paragraph.js';
import './blocks/table.js';
import './blocks/image.js';
import './blocks/divider.js';
import './blocks/spacer.js';
import './blocks/page-break.js';
import './blocks/columns.js';

import PDFDocument from 'pdfkit';
import type {
  DocAdapter,
  DocFlowSchema,
  RenderResult,
  RenderWarning,
  HeaderBlock,
  FooterBlock,
} from '../../schema/types.js';
import { getPdfBlockRenderer, type PdfRenderContext } from './registry.js';

export class PdfKitAdapter implements DocAdapter<Buffer> {
  readonly name = 'pdfkit';

  async render(
    schema: DocFlowSchema,
    data: Record<string, unknown>,
  ): Promise<RenderResult<Buffer>> {
    const startTime = Date.now();
    const warnings: RenderWarning[] = [];

    const doc = new PDFDocument({
      bufferPages: true,
      size: schema.metadata.pageSize,
      layout: schema.metadata.orientation,
      margins: schema.metadata.margins,
      info: {
        Title: schema.metadata.title,
        ...(schema.metadata.author !== undefined && { Author: schema.metadata.author }),
        ...(schema.metadata.subject !== undefined && { Subject: schema.metadata.subject }),
        ...(schema.metadata.keywords !== undefined && {
          Keywords: schema.metadata.keywords.join(', '),
        }),
        CreationDate: schema.metadata.createdAt
          ? new Date(schema.metadata.createdAt)
          : new Date(),
      },
    });



    const ctx: PdfRenderContext = {
      doc,
      data,
      warnings,
      pageHeight: doc.page.height - schema.metadata.margins.bottom,
      marginBottom: schema.metadata.margins.bottom,
    };

    let blocksProcessed = 0;
    let currentPageIdx = 0;

    for (const block of schema.ast) {
      if (block.type === 'header' || block.type === 'footer') {
        continue;
      }
      const targetPageIdx = block.page ?? currentPageIdx;

      while (doc.bufferedPageRange().count <= targetPageIdx) {
        doc.addPage();
      }

      doc.switchToPage(targetPageIdx);
      if (block.page !== undefined) {
        currentPageIdx = block.page;
      }
      
      ctx.isAbsolute = block.x !== undefined || block.y !== undefined;

      if (block.x !== undefined || block.y !== undefined) {
        if (block.x !== undefined) doc.x = block.x;
        if (block.y !== undefined) doc.y = block.y;
      }

      const renderer = getPdfBlockRenderer(block.type);
      renderer(block, ctx);
      
      if (block.type === 'page-break') {
        currentPageIdx++;
      }
      
      blocksProcessed++;
    }

    const headerBlock = schema.ast.find((b) => b.type === 'header') as HeaderBlock | undefined;
    const footerBlock = schema.ast.find((b) => b.type === 'footer') as FooterBlock | undefined;
    const finalPageCount = doc.bufferedPageRange().count;

    for (let pageIdx = 0; pageIdx < finalPageCount; pageIdx++) {
      doc.switchToPage(pageIdx);

      const pageData = {
        ...data,
        currentPage: pageIdx + 1,
        totalPages: finalPageCount,
        currentDate: new Date().toLocaleDateString(),
      };

      const pageCtx: PdfRenderContext = {
        ...ctx,
        data: pageData,
        isAbsolute: true,
      };

      if (headerBlock) {
        if (headerBlock.styles?.backgroundColor || headerBlock.styles?.borderColor) {
          doc.save();
          if (headerBlock.styles.backgroundColor) {
            doc.rect(0, 0, doc.page.width, schema.metadata.margins.top)
               .fill(headerBlock.styles.backgroundColor);
          }
          if (headerBlock.styles.borderColor) {
            const width = headerBlock.styles.borderWidth ?? 1;
            doc.lineWidth(width)
               .strokeColor(headerBlock.styles.borderColor)
               .moveTo(0, schema.metadata.margins.top - width / 2)
               .lineTo(doc.page.width, schema.metadata.margins.top - width / 2)
               .stroke();
          }
          doc.restore();
        }
        if (headerBlock.blocks) {
          for (const child of headerBlock.blocks) {
            const originalX = doc.x;
            const originalY = doc.y;

            doc.x = child.x ?? schema.metadata.margins.left;
            doc.y = child.y ?? 10;

            const renderer = getPdfBlockRenderer(child.type);
            renderer(child, pageCtx);

            doc.x = originalX;
            doc.y = originalY;
          }
        }
      }

      if (footerBlock) {
        const footerStartY = doc.page.height - schema.metadata.margins.bottom;
        if (footerBlock.styles?.backgroundColor || footerBlock.styles?.borderColor) {
          doc.save();
          if (footerBlock.styles.backgroundColor) {
            doc.rect(0, footerStartY, doc.page.width, schema.metadata.margins.bottom)
               .fill(footerBlock.styles.backgroundColor);
          }
          if (footerBlock.styles.borderColor) {
            const width = footerBlock.styles.borderWidth ?? 1;
            doc.lineWidth(width)
               .strokeColor(footerBlock.styles.borderColor)
               .moveTo(0, footerStartY + width / 2)
               .lineTo(doc.page.width, footerStartY + width / 2)
               .stroke();
          }
          doc.restore();
        }
        if (footerBlock.blocks) {
          for (const child of footerBlock.blocks) {
            const originalX = doc.x;
            const originalY = doc.y;

            doc.x = child.x ?? schema.metadata.margins.left;
            doc.y = footerStartY + (child.y ?? 10);

            const renderer = getPdfBlockRenderer(child.type);
            renderer(child, pageCtx);

            doc.x = originalX;
            doc.y = originalY;
          }
        }
      }
    }

    // Collect output as Buffer
    const output = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    });

    return {
      output,
      warnings,
      metadata: {
        pageCount: finalPageCount,
        renderTimeMs: Date.now() - startTime,
        blocksProcessed,
      },
    };
  }
}
