// Schema types — the contractual backbone
export type {
  DocBlock,
  DocBlockType,
  DocFlowSchema,
  PageMetadata,
  PageSize,
  PageOrientation,
  PageMargins,
  BaseStyles,
  TextStyles,
  TableStyles,
  ImageStyles,
  DividerStyles,
  TableColumn,
  HeadingBlock,
  ParagraphBlock,
  TableBlock,
  ImageBlock,
  DividerBlock,
  SpacerBlock,
  ColumnsBlock,
  PageBreakBlock,
  HeaderBlock,
  FooterBlock,
  DocAdapter,
  RenderResult,
  RenderWarning,
  RenderMetadata,
} from './schema/types.js';

// Schema validation
export {
  validateSchema,
  safeValidateSchema,
  SchemaValidationError,
  docFlowSchemaValidator,
} from './schema/validator.js';

// Interpolation engine
export {
  interpolate,
  interpolateHtml,
  resolvePayload,
  extractVariables,
  escapeHtml,
} from './parser/interpolate.js';

// Adapters
export { PdfKitAdapter } from './adapters/pdfkit/index.js';
export { HtmlAdapter } from './adapters/html/index.js';

// Constants & Conversions
export {
  PAGE_SIZES,
  MM_TO_PT,
  INCH_TO_PT,
  mmToPt,
  ptToMm,
  PAGE_BREAK_THRESHOLD,
} from './constants.js';
