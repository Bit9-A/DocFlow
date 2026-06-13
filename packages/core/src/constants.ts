export const PAGE_SIZES: Record<string, [number, number]> = {
  LETTER: [612, 792],      // 8.5" x 11"
  A4: [595.28, 841.89],    // 210mm x 297mm
  LEGAL: [612, 1008],      // 8.5" x 14"
  A3: [841.89, 1190.55],   // 297mm x 420mm (A3)
};

export const MM_TO_PT = 2.83465;  // 1 milímetro ≈ 2.83 puntos
export const INCH_TO_PT = 72;     // 1 pulgada = 72 puntos

export function mmToPt(mm: number): number {
  return mm * MM_TO_PT;
}

export function ptToMm(pt: number): number {
  return pt / MM_TO_PT;
}

// Umbral de seguridad para salto de página
export const PAGE_BREAK_THRESHOLD = 50; // puntos antes del borde inferior
