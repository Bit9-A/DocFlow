import type { PageBreakBlock } from '../../../schema/types.js';
import type { PdfRenderContext } from '../registry.js';
import { createBlockRenderer, registerPdfBlockRenderer } from '../registry.js';

function renderPageBreak(_block: PageBreakBlock, ctx: PdfRenderContext): void {
  ctx.doc.addPage();
}

registerPdfBlockRenderer('page-break', createBlockRenderer<PageBreakBlock>(renderPageBreak));
