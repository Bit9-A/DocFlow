// ============================================================
// Preview Data Builder
// Merges customVariables + uploadedJson into a single
// Record<string, unknown> for template interpolation
// in both canvas and PDF preview.
// ============================================================

import type { DocumentMetadata } from '@/store/useDocumentStore';

export function buildPreviewData(
  metadata: DocumentMetadata,
): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  // 1. Custom variables — flat key-value pairs
  for (const v of metadata.customVariables ?? []) {
    data[v.key] = v.value;
  }

  // 2. Uploaded JSON payload — parsed and shallow-merged
  const rawJson = metadata.uploadedJson ?? '';
  if (rawJson.trim()) {
    try {
      const parsed = JSON.parse(rawJson);
      if (typeof parsed === 'object' && parsed !== null) {
        for (const [key, val] of Object.entries(parsed)) {
          // Don't overwrite explicit custom variables
          if (!(key in data)) {
            data[key] = val;
          }
        }
      }
    } catch {
      // silently ignore invalid JSON
    }
  }

  return data;
}
