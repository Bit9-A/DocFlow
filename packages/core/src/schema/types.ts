// ============================================================
// DocFlow AST Type System
// All block types are discriminated unions keyed on `type`.
// Adding a new block = add it here + TypeScript enforces
// every adapter handles it via exhaustive switch.
// ============================================================

// -- Shared base styles (spacing only — applies to all blocks)
export interface BaseStyles {
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
  backgroundColor?: string;
  color?: string;
  borderColor?: string;
  borderWidth?: number;
}

// -- Text block styles
export interface TextStyles extends BaseStyles {
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: 'normal' | 'bold' | 'light';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: number;
  letterSpacing?: number;
  textDecoration?: 'none' | 'underline' | 'line-through';
}

// -- Table styles
export interface TableStyles extends BaseStyles {
  headerBg?: string;
  headerColor?: string;
  borderColor?: string;
  borderWidth?: number;
  cellPadding?: number;
  stripedRows?: boolean;
  stripedColor?: string;
  fontSize?: number;
  fontFamily?: string;
}

// -- Image styles
export interface ImageStyles extends BaseStyles {
  width?: number | string;
  height?: number | string;
  objectFit?: 'contain' | 'cover' | 'fill';
  borderRadius?: number;
  border?: string;
}

// -- Divider styles
export interface DividerStyles extends BaseStyles {
  color?: string;
  thickness?: number;
  style?: 'solid' | 'dashed' | 'dotted';
}

// ============================================================
// Block type definitions
// ============================================================

export interface BaseBlock {
  id: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  page?: number;
  ignoreMargins?: boolean;
  isLocked?: boolean;
}

export interface HeadingBlock extends BaseBlock {
  type: 'heading';
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  styles: TextStyles;
}

export interface ParagraphBlock extends BaseBlock {
  type: 'paragraph';
  text: string;
  styles: TextStyles;
}

export interface TableColumn {
  header: string;
  width: string;
  value: string;
  align?: 'left' | 'center' | 'right';
}

export interface TableBlock extends BaseBlock {
  type: 'table';
  loopOver: string;
  columns: TableColumn[];
  styles: TableStyles;
  limit?: number;
}

export interface ImageBlock extends BaseBlock {
  type: 'image';
  src: string; // URL, data URI, or asset reference
  alt: string;
  styles: ImageStyles;
}

export interface DividerBlock extends BaseBlock {
  type: 'divider';
  styles: DividerStyles;
}

export interface SpacerBlock extends BaseBlock {
  type: 'spacer';
  height: number;
  styles: BaseStyles;
}

export interface ColumnsBlock extends BaseBlock {
  type: 'columns';
  columns: Array<{
    width: string; // percentage e.g. "50%"
    blocks: DocBlock[];
  }>;
  styles: BaseStyles;
}

export interface PageBreakBlock extends BaseBlock {
  type: 'page-break';
  styles: BaseStyles;
}

// -- Repeating header/footer (rendered on every page by adapter)
export interface HeaderBlock extends BaseBlock {
  type: 'header';
  blocks: DocBlock[];
  styles: BaseStyles;
}

export interface FooterBlock extends BaseBlock {
  type: 'footer';
  blocks: DocBlock[];
  styles: BaseStyles;
}

// -- 6 Professional Blocks

export interface PageNumberBlock extends BaseBlock {
  type: 'page-number';
  format: string; // e.g. "Página {current} de {total}"
  styles: TextStyles;
}

export interface SignatureStyles extends BaseStyles {
  lineWidth?: number;
  lineColor?: string;
  gap?: number;
  fontSize?: number;
  color?: string;
}

export interface SignatureBlock extends BaseBlock {
  type: 'signature';
  label: string;
  name?: string;
  title?: string;
  styles: SignatureStyles;
}

export interface ContainerStyles extends BaseStyles {
  padding?: number;
  borderRadius?: number;
}

export interface ContainerBlock extends BaseBlock {
  type: 'container';
  blocks: DocBlock[];
  styles: ContainerStyles;
}

export interface BarcodeStyles extends BaseStyles {
  width?: number;
  height?: number;
  color?: string;
}

export interface BarcodeBlock extends BaseBlock {
  type: 'barcode';
  format: 'qr' | 'code128' | 'ean13';
  value: string;
  styles: BarcodeStyles;
}

export interface ListStyles extends TextStyles {
  bulletStyle?: 'dot' | 'number' | 'dash' | 'checkmark';
  itemSpacing?: number;
}

export interface ListBlock extends BaseBlock {
  type: 'list';
  ordered: boolean;
  items: string[];
  styles: ListStyles;
}

export interface ChartStyles extends BaseStyles {
  width?: number;
  height?: number;
  colors?: string[];
}

export interface ChartBlock extends BaseBlock {
  type: 'chart';
  chartType: 'bar' | 'pie' | 'line';
  loopOver: string;
  labelKey: string;
  valueKey: string;
  styles: ChartStyles;
}

// -- The discriminated union
export type DocBlock =
  | HeadingBlock
  | ParagraphBlock
  | TableBlock
  | ImageBlock
  | DividerBlock
  | SpacerBlock
  | ColumnsBlock
  | PageBreakBlock
  | HeaderBlock
  | FooterBlock
  | PageNumberBlock
  | SignatureBlock
  | ContainerBlock
  | BarcodeBlock
  | ListBlock
  | ChartBlock;

// Convenience type for block type string literals
export type DocBlockType = DocBlock['type'];

// ============================================================
// Document schema
// ============================================================

export interface PageMargins {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export type PageSize = 'LETTER' | 'A4' | 'LEGAL' | 'A3';
export type PageOrientation = 'portrait' | 'landscape';

export interface PageMetadata {
  title: string;
  pageSize: PageSize;
  orientation: PageOrientation;
  margins: PageMargins;
  author?: string;
  subject?: string;
  keywords?: string[];
  createdAt?: string;
  customVariables?: Array<{ key: string; value: string }>;
  uploadedJson?: string;
}

export interface DocFlowSchema {
  $schema: string;
  version: string;
  metadata: PageMetadata;
  ast: DocBlock[];
}

// ============================================================
// Render result types
// ============================================================

export interface RenderWarning {
  blockId: string;
  code: string;
  message: string;
}

export interface RenderMetadata {
  pageCount: number;
  renderTimeMs: number;
  blocksProcessed: number;
}

export interface RenderResult<T> {
  output: T;
  warnings: RenderWarning[];
  metadata: RenderMetadata;
}

// ============================================================
// Adapter interface — all renderers must satisfy this
// ============================================================

export interface DocAdapter<T> {
  readonly name: string;
  render(
    schema: DocFlowSchema,
    data: Record<string, unknown>,
  ): Promise<RenderResult<T>>;
}
