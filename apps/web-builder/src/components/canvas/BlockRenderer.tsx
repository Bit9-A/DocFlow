'use client';

import type { DocBlock, TableColumn } from '@docflow/core';
import { interpolate, resolvePayload, extractVariables } from '@docflow/core/parser/interpolate';
import { useDocumentStore } from '@/store/useDocumentStore';
import { buildPreviewData } from '@/lib/buildPreviewData';
import { useState, useMemo } from 'react';
import { Autocomplete } from '../ui/Autocomplete';
import { SortableBlock } from './SortableBlock';
import { AlertCircle } from 'lucide-react';

function hasPath(obj: any, path: string): boolean {
  if (!obj || typeof obj !== 'object') return false;
  const segments = path.trim().split('.');
  let current: any = obj;
  for (const segment of segments) {
    const key = segment.trim();
    if (!current || typeof current !== 'object') return false;
    if (!(key in current)) return false;
    current = current[key];
  }
  return true;
}

function createDefaultBlockFallback(type: any) {
  const id = `blk_${Math.random().toString(36).substring(2, 10)}`;
  switch (type) {
    case 'heading':
      return { id, type: 'heading', level: 2, text: 'Heading', styles: { fontSize: 18, color: '#111827' } };
    case 'paragraph':
      return { id, type: 'paragraph', text: 'Paragraph text...', styles: { fontSize: 11, color: '#374151' } };
    case 'divider':
      return { id, type: 'divider', styles: { color: '#E5E7EB', thickness: 1 } };
    case 'spacer':
      return { id, type: 'spacer', height: 20, styles: {} };
    case 'image':
      return { id, type: 'image', src: '', alt: 'Image description', styles: { width: '100%' } };
    case 'page-number':
      return { id, type: 'page-number', format: 'Página {{currentPage}} de {{totalPages}}', styles: { fontSize: 9, color: '#6B7280' } };
    case 'signature':
      return { id, type: 'signature', label: 'Firma Autorizada', styles: { lineWidth: 1, lineColor: '#9CA3AF' } };
    case 'container':
      return { id, type: 'container', blocks: [], styles: { padding: 8, borderRadius: 4, borderWidth: 1, borderColor: '#E5E7EB' } };
    case 'barcode':
      return { id, type: 'barcode', format: 'qr', value: 'DOCFLOW', styles: { width: 80, height: 80 } };
    case 'list':
      return { id, type: 'list', ordered: false, items: ['Item 1', 'Item 2'], styles: { fontSize: 11, color: '#374151' } };
    case 'chart':
      return { id, type: 'chart', chartType: 'bar', loopOver: 'ventas', labelKey: 'mes', valueKey: 'monto', styles: { width: 300, height: 120 } };
    default:
      return { id, type, styles: {} };
  }
}

function VariableWarningIndicator({
  template,
  previewData,
  itemData,
}: {
  template: string;
  previewData: Record<string, unknown>;
  itemData?: Record<string, unknown>;
}) {
  const vars = extractVariables(template);
  const unresolved = vars.filter((v) => {
    if (v.startsWith('item.')) {
      const cleanPath = v.slice(5);
      if (itemData) {
        return !hasPath(itemData, cleanPath);
      }
      return false;
    }
    return !hasPath(previewData, v);
  });

  if (unresolved.length === 0) return null;

  return (
    <span
      className="inline-flex items-center text-amber-500 hover:text-amber-600 transition-colors cursor-help select-none ml-1 shrink-0 align-middle"
      title={`Variable(s) no mapeada(s): ${unresolved.join(', ')}`}
      aria-label={`Warning: Unmapped variables: ${unresolved.join(', ')}`}
    >
      <AlertCircle size={14} className="inline" />
    </span>
  );
}

interface BlockRendererProps {
  block: DocBlock;
  isSelected: boolean;
}

export function BlockRenderer({ block, isSelected: _isSelected }: BlockRendererProps) {
  const updateBlock = useDocumentStore((s) => s.updateBlock);
  const metadata = useDocumentStore((s) => s.metadata);

  // Build resolved preview data from custom variables + uploaded JSON
  const previewData = useMemo(() => buildPreviewData(metadata), [metadata]);

  const [acState, setAcState] = useState<{
    show: boolean;
    query: string;
    coords: { top: number; left: number } | null;
    element: HTMLElement | null;
  }>({ show: false, query: '', coords: null, element: null });

  function handleInput(e: React.FormEvent<HTMLElement>) {
    const el = e.currentTarget;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);

    const node = range.startContainer;
    const offset = range.startOffset;
    if (node.nodeType === Node.TEXT_NODE) {
      const textBefore = node.textContent?.slice(0, offset) ?? '';
      const triggerMatch = textBefore.match(/(?:\{\{|\(|\,)\s*([a-zA-Z0-9._]*)$/);
      if (triggerMatch) {
        const rects = range.getClientRects();
        const coords = rects.length > 0
          ? { top: rects[0].top + window.scrollY, left: rects[0].left + window.scrollX }
          : { top: el.getBoundingClientRect().bottom + window.scrollY, left: el.getBoundingClientRect().left + window.scrollX };

        setAcState({
          show: true,
          query: triggerMatch[1] ?? '',
          coords: {
            top: coords.top + 20,
            left: coords.left,
          },
          element: el,
        });
        return;
      }
    }
    setAcState({ show: false, query: '', coords: null, element: null });
  }

  function handleSelect(variable: string) {
    if (!acState.element) return;
    const el = acState.element;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    const offset = range.startOffset;

    if (node.nodeType === Node.TEXT_NODE) {
      const textVal = node.textContent ?? '';
      const beforeCursor = textVal.slice(0, offset);
      const afterCursor = textVal.slice(offset);

      const updatedBefore = beforeCursor.replace(/(?:(\{\{|\(|\,)\s*)([a-zA-Z0-9._]*)$/, (_, trigger, _query) => {
        const suffix = trigger === '{{' ? '}}' : '';
        return `${trigger}${variable}${suffix}`;
      });
      node.textContent = updatedBefore + afterCursor;

      const newRange = document.createRange();
      newRange.setStart(node, updatedBefore.length);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
    }

    if (block.type === 'heading' || block.type === 'paragraph') {
      updateBlock(block.id, { text: el.innerText } as Partial<DocBlock>);
    } else if (block.type === 'table') {
      const isHeader = el.tagName.toLowerCase() === 'th';
      const colIdx = Number(el.getAttribute('data-col-idx'));
      if (!isNaN(colIdx)) {
        const newColumns = block.columns.map((col, idx) => {
          if (idx === colIdx) {
            return isHeader ? { ...col, header: el.innerText } : { ...col, value: el.innerText };
          }
          return col;
        });
        updateBlock(block.id, { columns: newColumns } as Partial<DocBlock>);
      }
    }
    setAcState({ show: false, query: '', coords: null, element: null });
  }

  function handleHeadingBlur(e: React.FocusEvent<HTMLHeadingElement>) {
    updateBlock(block.id, { text: e.currentTarget.innerText } as Partial<DocBlock>);
  }

  function handleParagraphBlur(e: React.FocusEvent<HTMLParagraphElement>) {
    updateBlock(block.id, { text: e.currentTarget.innerText } as Partial<DocBlock>);
  }

  const renderedElement = (() => {
    switch (block.type) {
    case 'heading': {
      const headingStyle = {
        color: block.styles.color,
        fontSize: block.styles.fontSize ? `${block.styles.fontSize}px` : undefined,
        fontWeight: (block.styles.fontWeight ?? 'bold') as React.CSSProperties['fontWeight'],
        textAlign: block.styles.textAlign as React.CSSProperties['textAlign'],
        marginBottom: block.styles.marginBottom,
        lineHeight: block.styles.lineHeight,
      };
      const sizeClass = ['', 'text-3xl', 'text-2xl', 'text-xl', 'text-lg', 'text-base', 'text-sm'][block.level] ?? 'text-2xl';
      const commonProps = {
        contentEditable: true as const,
        suppressContentEditableWarning: true as const,
        onBlur: handleHeadingBlur,
        onInput: handleInput,
        onKeyUp: handleInput,
        style: headingStyle,
        className: `font-bold outline-none flex-1 cursor-text min-h-[1.5em] ${sizeClass}`,
        'aria-label': `Heading level ${block.level}, editable`,
      };

      const headingText = interpolate(block.text, previewData);
      const renderHeading = () => {
        if (block.level === 1) return <h1 {...commonProps}>{headingText}</h1>;
        if (block.level === 2) return <h2 {...commonProps}>{headingText}</h2>;
        if (block.level === 3) return <h3 {...commonProps}>{headingText}</h3>;
        if (block.level === 4) return <h4 {...commonProps}>{headingText}</h4>;
        if (block.level === 5) return <h5 {...commonProps}>{headingText}</h5>;
        return <h6 {...commonProps}>{headingText}</h6>;
      };

      return (
        <div className="flex items-center gap-1.5 w-full">
          {renderHeading()}
          <VariableWarningIndicator template={block.text} previewData={previewData} />
        </div>
      );
    }


    case 'paragraph':
      return (
        <div className="flex items-start gap-1.5 w-full">
          <p
            contentEditable
            suppressContentEditableWarning
            onBlur={handleParagraphBlur}
            onInput={handleInput}
            onKeyUp={handleInput}
            style={{
              color: block.styles.color,
              fontSize: block.styles.fontSize ? `${block.styles.fontSize}px` : undefined,
              textAlign: block.styles.textAlign,
              lineHeight: block.styles.lineHeight,
              fontWeight: block.styles.fontWeight,
              marginBottom: block.styles.marginBottom,
            }}
            className="outline-none flex-1 cursor-text min-h-[1.5em] text-sm leading-relaxed"
            aria-label="Paragraph, editable"
          >
            {interpolate(block.text, previewData)}
          </p>
          <VariableWarningIndicator template={block.text} previewData={previewData} />
        </div>
      );

    case 'table':
      return <TablePreviewRenderer block={block} previewData={previewData} onInput={handleInput} />;

    case 'image': {
      const imgWidth = block.width !== undefined ? `${block.width}px` : (typeof block.styles.width === 'number' ? `${block.styles.width}px` : (block.styles.width ?? '100%'));
      const imgHeight = block.height !== undefined ? `${block.height}px` : (typeof block.styles.height === 'number' ? `${block.styles.height}px` : 'auto');
      const resolvedSrc = interpolate(block.src, previewData);
      const resolvedAlt = interpolate(block.alt, previewData);

      return (
        <div 
          style={{ width: imgWidth, height: imgHeight }} 
          className="flex items-center justify-center border border-dashed border-gray-200 rounded bg-gray-50 overflow-hidden"
        >
          {resolvedSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolvedSrc}
              alt={resolvedAlt}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="text-center text-gray-400 p-2">
              <div className="text-xl">🖼</div>
              <p className="text-[10px]">Image URL</p>
            </div>
          )}
        </div>
      );
    }

    case 'divider':
      return (
        <hr
          style={{
            borderColor: block.styles.color ?? '#E5E7EB',
            borderTopWidth: block.styles.thickness ?? 1,
            borderStyle: block.styles.style ?? 'solid',
            marginTop: block.styles.marginTop,
            marginBottom: block.styles.marginBottom,
          }}
          className="my-2"
          aria-label="Horizontal divider"
        />
      );

    case 'spacer':
      return (
        <div
          style={{ height: block.height }}
          className="bg-blue-50/50 border border-dashed border-blue-200 rounded flex items-center justify-center"
          aria-label={`Spacer, ${block.height}px`}
        >
          <span className="text-[10px] text-blue-400">{block.height}px space</span>
        </div>
      );

    case 'columns': {
      const selectedBlockId = useDocumentStore.getState().selectedBlockId;
      const selectBlock = useDocumentStore.getState().selectBlock;
      const addBlockToColumn = useDocumentStore.getState().addBlockToColumn;

      const handleDragOver = (e: React.DragEvent) => {
        if (e.dataTransfer.types.includes('application/docflow-block-type')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }
      };

      const handleDrop = (e: React.DragEvent, colIdx: number) => {
        e.preventDefault();
        e.stopPropagation();
        const blockType = e.dataTransfer.getData('application/docflow-block-type') as any;
        if (blockType) {
          addBlockToColumn(block.id, colIdx, blockType);
        }
      };

      return (
        <div className="flex gap-4 my-2 border border-dashed border-indigo-200/40 rounded-lg p-2.5 bg-indigo-50/5 pointer-events-auto" aria-label="Columns block">
          {block.columns.map((col, colIdx) => (
            <div
              key={colIdx}
              style={{ width: col.width }}
              className="border border-dashed border-indigo-200/20 rounded p-2.5 bg-indigo-50/10 min-h-[100px] flex flex-col gap-2 relative transition-all hover:border-indigo-400/30"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, colIdx)}
            >
              <div className="text-[8px] font-bold text-indigo-400/50 uppercase select-none pointer-events-none mb-1">
                Col {colIdx + 1} ({col.width})
              </div>
              
              {col.blocks && col.blocks.length > 0 ? (
                <div className="flex flex-col gap-2.5">
                  {col.blocks.map((child) => (
                    <SortableBlock
                      key={child.id}
                      block={child}
                      isSelected={selectedBlockId === child.id}
                      onSelect={() => selectBlock(child.id)}
                      isNested={true}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center border border-dashed border-indigo-200/10 rounded py-5 pointer-events-none">
                  <span className="text-[9px] text-indigo-400/30 italic">Drag block here</span>
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }

    case 'page-break':
      return (
        <div
          className="my-3 flex items-center gap-3"
          aria-label="Page break"
        >
          <div className="flex-1 border-t-2 border-dashed border-orange-300" />
          <span className="text-[10px] font-semibold text-orange-400 uppercase tracking-wider whitespace-nowrap">
            Page Break
          </span>
          <div className="flex-1 border-t-2 border-dashed border-orange-300" />
        </div>
      );

    case 'header':
    case 'footer': {
      const isHeader = block.type === 'header';
      const themeClass = isHeader
        ? 'bg-blue-50/10 border-blue-200/50 text-blue-400 hover:bg-blue-50/20'
        : 'bg-purple-50/10 border-purple-200/50 text-purple-400 hover:bg-purple-50/20';
      const label = isHeader ? 'Header (Encabezado)' : 'Footer (Pie de página)';

      return (
        <div
          className={`border border-dashed rounded p-3 text-xs relative group cursor-pointer transition-all ${themeClass}`}
          aria-label={label}
        >
          <span className="absolute -top-2 left-2 px-1.5 py-0.5 text-[8px] uppercase tracking-wider font-bold bg-[#111122] rounded border border-white/5 text-white/50">
            {label}
          </span>
          {block.blocks && block.blocks.length > 0 ? (
            <div className="space-y-1.5 pt-1">
              {block.blocks.map((sub, i) => {
                const rawText = (sub as any).text ?? '';
                const textVal = interpolate(rawText, previewData);
                const subStyles = (sub.styles ?? {}) as any;
                const align = subStyles.textAlign ?? 'center';
                const color = subStyles.color ?? 'inherit';
                const fontSize = subStyles.fontSize ?? 10;
                return (
                  <div
                    key={i}
                    style={{
                      textAlign: align as any,
                      color,
                      fontSize: `${fontSize}px`,
                    }}
                    className="font-medium"
                  >
                    {textVal}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center italic opacity-40 py-1">
              No content. Select header/footer in page settings to add sub-blocks.
            </p>
          )}
        </div>
      );
    }

    case 'page-number': {
      const text = block.format
        .replace(/{{current}}/g, '1')
        .replace(/{{total}}/g, '1')
        .replace(/{{currentPage}}/g, '1')
        .replace(/{{totalPages}}/g, '1');
      return (
        <div
          style={{
            color: block.styles.color ?? '#6B7280',
            fontSize: block.styles.fontSize ? `${block.styles.fontSize}px` : '9px',
            textAlign: block.styles.textAlign as React.CSSProperties['textAlign'],
            fontWeight: block.styles.fontWeight as any,
            marginBottom: block.styles.marginBottom,
          }}
          className="w-full select-none italic text-xs py-1"
        >
          {text}
        </div>
      );
    }

    case 'signature': {
      const sigWidth = block.width !== undefined ? `${block.width}px` : '150px';
      const gap = block.styles.gap ?? 8;
      const fontSize = block.styles.fontSize ?? 10;
      const color = block.styles.color ?? '#374151';
      const lineColor = block.styles.lineColor ?? '#9CA3AF';
      const thickness = block.styles.lineWidth ?? 1;

      return (
        <div
          style={{
            width: sigWidth,
            marginTop: block.styles.marginTop,
            marginBottom: block.styles.marginBottom,
          }}
          className="inline-block select-none"
        >
          <div style={{ borderTop: `${thickness}px solid ${lineColor}`, marginBottom: `${gap}px` }} />
          <div
            style={{
              textAlign: 'center',
              fontSize: `${fontSize}px`,
              color,
              lineHeight: 1.4,
            }}
            className="font-medium text-xs text-gray-700"
          >
            <div>{block.label}</div>
            {block.name && <div className="font-bold">{block.name}</div>}
            {block.title && <div className="italic text-gray-500">{block.title}</div>}
          </div>
        </div>
      );
    }

    case 'container': {
      const selectedBlockId = useDocumentStore.getState().selectedBlockId;
      const selectBlock = useDocumentStore.getState().selectBlock;
      const updateBlock = useDocumentStore.getState().updateBlock;

      const handleDragOver = (e: React.DragEvent) => {
        if (e.dataTransfer.types.includes('application/docflow-block-type')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }
      };

      const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const blockType = e.dataTransfer.getData('application/docflow-block-type') as any;
        if (blockType) {
          const newBlock = createDefaultBlockFallback(blockType) as any;
          updateBlock(block.id, { blocks: [...(block.blocks ?? []), newBlock] });
        }
      };

      return (
        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          style={{
            backgroundColor: block.styles.backgroundColor ?? '#F9FAFB',
            borderColor: block.styles.borderColor ?? '#E5E7EB',
            borderWidth: block.styles.borderWidth ?? 1,
            borderStyle: 'solid',
            borderRadius: block.styles.borderRadius ? `${block.styles.borderRadius}px` : '6px',
            padding: block.styles.padding !== undefined ? `${block.styles.padding}px` : '12px',
            width: block.width !== undefined ? `${block.width}px` : '100%',
            minHeight: '80px',
          }}
          className="flex flex-col gap-2.5 transition-all hover:border-indigo-400/40 relative select-none pointer-events-auto"
        >
          {block.blocks && block.blocks.length > 0 ? (
            <div className="flex flex-col gap-2.5">
              {block.blocks.map((child) => (
                <SortableBlock
                  key={child.id}
                  block={child}
                  isSelected={selectedBlockId === child.id}
                  onSelect={() => selectBlock(child.id)}
                  isNested={true}
                />
              ))}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center border border-dashed border-gray-300 rounded py-6 pointer-events-none">
              <span className="text-[10px] text-gray-400 italic">Arrastra bloques aquí / Drag blocks here</span>
            </div>
          )}
        </div>
      );
    }

    case 'barcode': {
      const value = interpolate(block.value, previewData) || 'DOCFLOW';
      const width = block.styles.width ?? 100;
      const height = block.styles.height ?? 100;
      const color = block.styles.color ?? '#000000';

      if (block.format === 'qr') {
        const size = 21;
        const moduleSize = 4;
        const svgW = size * moduleSize;
        const svgH = size * moduleSize;

        let hash = 0;
        for (let i = 0; i < value.length; i++) {
          hash = value.charCodeAt(i) + ((hash << 5) - hash);
        }
        const pseudoRandom = () => {
          const x = Math.sin(hash++) * 10000;
          return x - Math.floor(x);
        };

        const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

        const drawFinder = (rowOffset: number, colOffset: number) => {
          for (let r = 0; r < 7; r++) {
            for (let c = 0; c < 7; c++) {
              const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
              const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
              if (isBorder || isCenter) matrix[rowOffset + r]![colOffset + c] = true;
            }
          }
        };

        drawFinder(0, 0);
        drawFinder(0, size - 7);
        drawFinder(size - 7, 0);

        for (let i = 7; i < size - 7; i++) {
          const isEven = i % 2 === 0;
          matrix[6]![i] = isEven;
          matrix[i]![6] = isEven;
        }

        for (let r = 14; r < 17; r++) {
          for (let c = 14; c < 17; c++) {
            const isBorder = r === 14 || r === 16 || c === 14 || c === 16;
            const isCenter = r === 15 && c === 15;
            if (isBorder || isCenter) matrix[r]![c] = true;
          }
        }

        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
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

        return (
          <div style={{ width: `${width}px`, height: `${height}px` }} className="flex items-center justify-center p-1 select-none">
            <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-full">
              {matrix.map((row, r) =>
                row.map((val, c) =>
                  val ? <rect key={`${r}-${c}`} x={c * moduleSize} y={r * moduleSize} width={moduleSize} height={moduleSize} fill={color} /> : null
                )
              )}
            </svg>
          </div>
        );
      } else {
        let hash = 0;
        for (let i = 0; i < value.length; i++) {
          hash = value.charCodeAt(i) + ((hash << 5) - hash);
        }
        const pseudoRandom = () => {
          const x = Math.sin(hash++) * 10000;
          return x - Math.floor(x);
        };

        const pattern = [2, 1, 1, 2];
        for (let i = 0; i < 15; i++) {
          pattern.push(Math.floor(pseudoRandom() * 3) + 1);
          pattern.push(Math.floor(pseudoRandom() * 3) + 1);
        }
        pattern.push(2, 1, 2, 1);

        const totalUnits = pattern.reduce((sum, val) => sum + val, 0);
        const svgW = totalUnits * 2;
        let currentX = 0;

        return (
          <div style={{ width: `${width}px` }} className="flex flex-col items-center select-none text-[8px] font-mono p-1">
            <svg viewBox={`0 0 ${svgW} ${height - 12}`} className="w-full" style={{ height: `${height - 12}px` }}>
              {pattern.map((unitCount, idx) => {
                const isBar = idx % 2 === 0;
                const stripeWidth = unitCount * 2;
                const xPos = currentX;
                currentX += stripeWidth;
                return isBar ? <rect key={idx} x={xPos} y={0} width={stripeWidth} height={height - 12} fill={color} /> : null;
              })}
            </svg>
            <div style={{ color }} className="mt-1">{value}</div>
          </div>
        );
      }
    }

    case 'list': {
      const spacing = block.styles.itemSpacing ?? 4;
      const fontSize = block.styles.fontSize ? `${block.styles.fontSize}px` : '11px';
      const color = block.styles.color ?? '#374151';

      let listStyleClass = 'list-disc';
      if (block.ordered) listStyleClass = 'list-decimal';
      else if (block.styles.bulletStyle === 'dash') listStyleClass = 'list-none [&>li]:before:content-["-\\00a0"]';
      else if (block.styles.bulletStyle === 'checkmark') listStyleClass = 'list-none [&>li]:before:content-["\\2713\\00a0"]';

      return (
        <div
          style={{
            fontSize,
            color,
            fontWeight: block.styles.fontWeight as any,
            lineHeight: block.styles.lineHeight,
          }}
          className="w-full pl-5 py-1"
        >
          <ul className={`${listStyleClass} space-y-1`}>
            {block.items.map((item, index) => (
              <li key={index} style={{ marginBottom: `${spacing}px` }}>
                {interpolate(item, previewData)}
              </li>
            ))}
          </ul>
        </div>
      );
    }

    case 'chart': {
      const rawData = resolvePayload(block.loopOver, previewData);
      const dataList = Array.isArray(rawData) ? rawData : [];

      const labels: string[] = [];
      const values: number[] = [];

      dataList.forEach((item) => {
        if (item && typeof item === 'object') {
          const label = String((item as any)[block.labelKey] ?? '');
          const value = parseFloat((item as any)[block.valueKey]);
          labels.push(label);
          values.push(isNaN(value) ? 0 : value);
        }
      });

      let chartLabels = labels;
      let chartValues = values;
      if (chartLabels.length === 0) {
        chartLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May'];
        chartValues = [30, 75, 45, 90, 60];
      }

      const width = block.styles.width ?? 350;
      const height = block.styles.height ?? 150;
      const colors = block.styles.colors ?? ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

      if (block.chartType === 'pie') {
        const total = chartValues.reduce((sum, v) => sum + v, 0) || 1;
        const radius = Math.min(width, height) * 0.4;
        const centerX = width / 3;
        const centerY = height / 2;

        let currentAngle = 0;
        const paths: string[] = [];
        chartValues.forEach((val, i) => {
          const sliceAngle = (val / total) * 360;
          const col = colors[i % colors.length] ?? '#3B82F6';

          const x1 = centerX + radius * Math.cos((currentAngle - 90) * Math.PI / 180);
          const y1 = centerY + radius * Math.sin((currentAngle - 90) * Math.PI / 180);
          const x2 = centerX + radius * Math.cos((currentAngle + sliceAngle - 90) * Math.PI / 180);
          const y2 = centerY + radius * Math.sin((currentAngle + sliceAngle - 90) * Math.PI / 180);

          const largeArcFlag = sliceAngle > 180 ? 1 : 0;
          paths.push(`M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z|||${col}`);
          currentAngle += sliceAngle;
        });

        const legendX = (width * 2) / 3 - 10;
        const legendY = 15;
        const itemHeight = 14;

        return (
          <div style={{ width: `${width}px`, height: `${height}px` }} className="bg-white border rounded p-2 flex items-center justify-center select-none shadow-sm">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
              {paths.map((pStr, i) => {
                const [pathData, col] = pStr.split('|||');
                return <path key={i} d={pathData} fill={col} />;
              })}
              {chartValues.map((val, i) => {
                if (i > 8) return null;
                const col = colors[i % colors.length] ?? '#3B82F6';
                const percent = ((val / total) * 100).toFixed(0);
                return (
                  <g key={i}>
                    <rect x={legendX} y={legendY + i * itemHeight} width={8} height={8} fill={col} />
                    <text x={legendX + 14} y={legendY + i * itemHeight + 7} fontFamily="sans-serif" fontSize="8px" fill="#374151">
                      {chartLabels[i]}: {val} ({percent}%)
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        );
      } else {
        const paddingLeft = 35;
        const paddingBottom = 20;
        const paddingTop = 15;
        const paddingRight = 10;
        const chartW = width - paddingLeft - paddingRight;
        const chartH = height - paddingTop - paddingBottom;
        const originX = paddingLeft;
        const originY = height - paddingBottom;

        const maxVal = Math.max(...chartValues, 1);
        const barCount = chartValues.length;
        const barSpacing = chartW / barCount;

        return (
          <div style={{ width: `${width}px`, height: `${height}px` }} className="bg-white border rounded p-2 flex items-center justify-center select-none shadow-sm">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
              <line x1={originX} y1={originY} x2={originX + chartW} y2={originY} stroke="#D1D5DB" strokeWidth="1" />
              <line x1={originX} y1={originY} x2={originX} y2={paddingTop} stroke="#D1D5DB" strokeWidth="1" />

              {block.chartType === 'bar' ? (
                chartValues.map((val, i) => {
                  const barWidth = barSpacing * 0.6;
                  const barH = (val / maxVal) * chartH;
                  const barX = originX + i * barSpacing + (barSpacing - barWidth) / 2;
                  const barY = originY - barH;
                  const col = colors[i % colors.length] ?? '#3B82F6';

                  return (
                    <g key={i}>
                      <rect x={barX} y={barY} width={barWidth} height={barH} fill={col} />
                      <text x={barX + barWidth / 2} y={barY - 3} fontFamily="sans-serif" fontSize="7px" fontWeight="bold" fill="#374151" textAnchor="middle">{val}</text>
                      <text x={originX + i * barSpacing + barSpacing / 2} y={originY + 12} fontFamily="sans-serif" fontSize="7px" fill="#6B7280" textAnchor="middle">{chartLabels[i]}</text>
                    </g>
                  );
                })
              ) : (
                <>
                  <path d={pathPoints} fill="none" stroke={colors[0] ?? '#3B82F6'} strokeWidth="2" />
                  {chartValues.map((val, i) => {
                    const pointX = originX + i * barSpacing + barSpacing / 2;
                    const pointY = originY - (val / maxVal) * chartH;
                    const col = colors[0] ?? '#3B82F6';
                    return (
                      <g key={i}>
                        <circle cx={pointX} cy={pointY} r="3" fill={col} />
                        <text x={pointX} y={pointY - 4} fontFamily="sans-serif" fontSize="7px" fontWeight="bold" fill="#374151" textAnchor="middle">{val}</text>
                        <text x={pointX} y={originY + 12} fontFamily="sans-serif" fontSize="7px" fill="#6B7280" text-anchor="middle">{chartLabels[i]}</text>
                      </g>
                    );
                  })}
                </>
              )}
            </svg>
          </div>
        );
      }
    }

    default: {
      const _exhaustive: never = block;
      return (
        <div className="text-red-500 text-xs p-2 border border-red-200 rounded">
          Unknown block type: {(block as { type: string }).type}
        </div>
      );
    }
    }
  })();

  return (
    <>
      {renderedElement}
      {acState.show && (
        <Autocomplete
          query={acState.query}
          coords={acState.coords}
          onSelect={handleSelect}
          onClose={() => setAcState({ show: false, query: '', coords: null, element: null })}
        />
      )}
    </>
  );
}

// ============================================================
// Table Preview Renderer
// Renders actual data rows if loopOver resolves in previewData,
// otherwise shows a single sample row with raw templates.
// ============================================================

interface TablePreviewRendererProps {
  block: Extract<DocBlock, { type: 'table' }>;
  previewData: Record<string, unknown>;
  onInput: (e: React.FormEvent<HTMLElement>) => void;
}

function TablePreviewRenderer({ block, previewData, onInput }: TablePreviewRendererProps) {
  const updateBlock = useDocumentStore((s) => s.updateBlock);
  const items = resolvePayload(block.loopOver, previewData);
  const hasArrayData = Array.isArray(items) && items.length > 0;

  const [editingCellIdx, setEditingCellIdx] = useState<number | null>(null);

  const cellStyle = (): React.CSSProperties => ({
    border: `${block.styles.borderWidth ?? 1}px solid ${block.styles.borderColor ?? '#E5E7EB'}`,
    padding: `${block.styles.cellPadding ?? 8}px`,
    textAlign: 'left' as const,
  });

  const stripeColor = block.styles.stripedRows ? (block.styles.stripedColor ?? '#F3F4F6') : undefined;

  const handleHeaderBlur = (colIdx: number, newText: string) => {
    const newColumns = block.columns.map((col, idx) => 
      idx === colIdx ? { ...col, header: newText } : col
    );
    updateBlock(block.id, { columns: newColumns } as Partial<DocBlock>);
  };

  const handleCellBlur = (colIdx: number, newText: string) => {
    const newColumns = block.columns.map((col, idx) => 
      idx === colIdx ? { ...col, value: newText } : col
    );
    updateBlock(block.id, { columns: newColumns } as Partial<DocBlock>);
    setEditingCellIdx(null);
  };

  let previewRows = hasArrayData
    ? (items as Record<string, unknown>[])
    : [undefined]; // one sample row when no data

  if (hasArrayData && block.limit && block.limit > 0) {
    previewRows = previewRows.slice(0, block.limit);
  }

  return (
    <div className="overflow-x-auto my-2">
      <table
        className="w-full text-xs border-collapse"
        style={{ fontSize: block.styles.fontSize }}
        aria-label="Table block preview"
      >
        <thead>
          <tr>
            {block.columns.map((col, i) => (
              <th
                key={i}
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => handleHeaderBlur(i, e.currentTarget.innerText)}
                onInput={onInput}
                onKeyUp={onInput}
                data-col-idx={i}
                style={{
                  width: col.width,
                  background: block.styles.headerBg ?? '#F3F4F6',
                  color: block.styles.headerColor ?? '#111827',
                  ...cellStyle(),
                }}
                className="outline-none cursor-text focus:bg-indigo-50/50 text-left"
              >
                {col.header}
              </th>
            ))}
            <th
              style={{
                width: '40px',
                background: block.styles.headerBg ?? '#F3F4F6',
                color: block.styles.headerColor ?? '#111827',
                border: `${block.styles.borderWidth ?? 1}px solid ${block.styles.borderColor ?? '#E5E7EB'}`,
                padding: '4px',
                textAlign: 'center',
              }}
              className="no-print"
            >
              <button
                type="button"
                onClick={() => {
                  const newCol = {
                    header: `Col ${block.columns.length + 1}`,
                    value: `{{item.col${block.columns.length + 1}}}`,
                    width: '15%',
                    align: 'left' as const,
                  };
                  updateBlock(block.id, { columns: [...block.columns, newCol] });
                }}
                className="w-5 h-5 flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-md mx-auto transition-all text-xs font-bold"
                title="Add column"
                aria-label="Add new column"
              >
                +
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {previewRows.map((rowData, rowIdx) => (
            <tr
              key={rowIdx}
              style={
                stripeColor !== undefined && rowIdx % 2 === 1
                  ? { background: stripeColor }
                  : undefined
              }
            >
              {block.columns.map((col, colIdx) => {
                const isEditing = editingCellIdx === colIdx && rowIdx === 0;

                return (
                  <td
                    key={colIdx}
                    style={{ ...cellStyle(), textAlign: col.align ?? 'left' } as React.CSSProperties}
                    contentEditable={isEditing}
                    suppressContentEditableWarning
                    onClick={() => {
                      if (editingCellIdx !== colIdx) {
                        setEditingCellIdx(colIdx);
                      }
                    }}
                    onBlur={(e) => {
                      if (isEditing) {
                        handleCellBlur(colIdx, e.currentTarget.innerText);
                      }
                    }}
                    onInput={onInput}
                    onKeyUp={onInput}
                    data-col-idx={colIdx}
                    className={`outline-none ${isEditing ? 'bg-indigo-50/30 cursor-text' : 'cursor-pointer hover:bg-gray-100/30'}`}
                  >
                    {isEditing ? (
                      col.value
                    ) : (
                      <div className="flex items-center justify-between gap-1 w-full">
                        <span className="flex-1">
                          {rowData !== undefined ? interpolate(col.value, { ...previewData, item: rowData }) : col.value}
                        </span>
                        <VariableWarningIndicator template={col.value} previewData={previewData} itemData={rowData} />
                      </div>
                    )}
                  </td>
                );
              })}
              <td
                style={{
                  border: `${block.styles.borderWidth ?? 1}px solid ${block.styles.borderColor ?? '#E5E7EB'}`,
                  padding: `${block.styles.cellPadding ?? 8}px`,
                }}
                className="no-print bg-gray-50/10"
              />
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[10px] text-gray-400 mt-1">
        Loops over: <code className="font-mono">{block.loopOver}</code>
        {hasArrayData && (
          <span className="text-indigo-400 ml-2">
            ({items.length} row{items.length !== 1 ? 's' : ''} in preview)
          </span>
        )}
      </p>
    </div>
  );
}
