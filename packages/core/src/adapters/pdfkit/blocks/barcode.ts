import type { BarcodeBlock } from '../../../schema/types.js';
import type { PdfRenderContext } from '../registry.js';
import { createBlockRenderer, registerPdfBlockRenderer, resolve, resolveColor } from '../registry.js';

function renderBarcode(block: BarcodeBlock, ctx: PdfRenderContext): void {
  const { doc } = ctx;
  const value = resolve(block.value, ctx) || 'DOCFLOW';
  const width = block.styles.width ?? 120;
  const height = block.styles.height ?? 50;
  const color = resolveColor(block.styles.color, '#000000');
  const marginTop = block.styles.marginTop ?? 8;
  const marginBottom = block.styles.marginBottom ?? 8;

  if (block.x === undefined && block.y === undefined) {
    doc.y += marginTop;
  }

  const startX = block.x ?? doc.x;
  const startY = block.y ?? doc.y;

  if (block.format === 'qr') {
    // Generate a 21x21 QR Matrix deterministically
    const size = 21;
    const moduleSize = Math.min(width, height) / size;
    
    // Seeded random helper based on string hash
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = value.charCodeAt(i) + ((hash << 5) - hash);
    }
    const pseudoRandom = () => {
      const x = Math.sin(hash++) * 10000;
      return x - Math.floor(x);
    };

    const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

    // 1. Draw Finder Patterns (7x7)
    const drawFinder = (rowOffset: number, colOffset: number) => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
          const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          if (isBorder || isCenter) {
            matrix[rowOffset + r]![colOffset + c] = true;
          }
        }
      }
    };

    drawFinder(0, 0); // Top-Left
    drawFinder(0, size - 7); // Top-Right
    drawFinder(size - 7, 0); // Bottom-Left

    // 2. Draw Timing Patterns (alternating dots along row 6 and col 6)
    for (let i = 7; i < size - 7; i++) {
      const isEven = i % 2 === 0;
      matrix[6]![i] = isEven;
      matrix[i]![6] = isEven;
    }

    // 3. Draw Alignment Pattern (3x3 at 14, 14)
    for (let r = 14; r < 17; r++) {
      for (let c = 14; c < 17; c++) {
        const isBorder = r === 14 || r === 16 || c === 14 || c === 16;
        const isCenter = r === 15 && c === 15;
        if (isBorder || isCenter) {
          matrix[r]![c] = true;
        }
      }
    }

    // 4. Fill in the rest deterministically
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        // Skip finder, timing and alignment areas
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

    // Render the QR code pixels using rects
    doc.save();
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (matrix[r]![c]) {
          doc.rect(startX + c * moduleSize, startY + r * moduleSize, moduleSize, moduleSize).fill(color);
        }
      }
    }
    doc.restore();

    if (block.x === undefined && block.y === undefined) {
      doc.y = startY + Math.min(width, height) + marginBottom;
    }
  } else {
    // Barcode: Code 128 or EAN 13
    // We render alternating black/white stripes of varying widths
    // Seeded hash for deterministic stripe sequence
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = value.charCodeAt(i) + ((hash << 5) - hash);
    }
    const pseudoRandom = () => {
      const x = Math.sin(hash++) * 10000;
      return x - Math.floor(x);
    };

    // Construct a realistic bar width pattern
    const pattern: number[] = [2, 1, 1, 2]; // start guard
    for (let i = 0; i < 15; i++) {
      pattern.push(Math.floor(pseudoRandom() * 3) + 1);
      pattern.push(Math.floor(pseudoRandom() * 3) + 1);
    }
    pattern.push(2, 1, 2, 1); // stop guard

    const totalUnits = pattern.reduce((sum, val) => sum + val, 0);
    const unitWidth = width / totalUnits;

    doc.save();
    let currentX = startX;
    pattern.forEach((unitCount, idx) => {
      const isBar = idx % 2 === 0;
      const stripeWidth = unitCount * unitWidth;
      if (isBar) {
        doc.rect(currentX, startY, stripeWidth, height - 12).fill(color);
      }
      currentX += stripeWidth;
    });
    doc.restore();

    // Render text value below the stripes
    doc.fontSize(8)
       .fillColor(color)
       .font('Helvetica')
       .text(value, startX, startY + height - 10, { width, align: 'center' });

    if (block.x === undefined && block.y === undefined) {
      doc.y = startY + height + marginBottom;
    }
  }
}

registerPdfBlockRenderer(
  'barcode',
  createBlockRenderer<BarcodeBlock>(renderBarcode),
);
