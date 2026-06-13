import type { SpacerBlock } from '../../../schema/types.js';
import type { PdfRenderContext } from '../registry.js';
import { createBlockRenderer, registerPdfBlockRenderer } from '../registry.js';

function renderSpacer(block: SpacerBlock, ctx: PdfRenderContext): void {
  // PDFKit uses points; height is in pixels — we treat 1px ≈ 0.75pt
  ctx.doc.moveDown(block.height / 12);
}

registerPdfBlockRenderer('spacer', createBlockRenderer<SpacerBlock>(renderSpacer));
