'use client';

import type { DocBlock } from '@docflow/core';
import { useDocumentStore } from '@/store/useDocumentStore';
import { useState } from 'react';
import { Autocomplete } from '../ui/Autocomplete';

interface BlockRendererProps {
  block: DocBlock;
  isSelected: boolean;
}

export function BlockRenderer({ block, isSelected: _isSelected }: BlockRendererProps) {
  const updateBlock = useDocumentStore((s) => s.updateBlock);

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
      const triggerMatch = textBefore.match(/\{\{([a-zA-Z0-9._]*)$/);
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

      const updatedBefore = beforeCursor.replace(/\{\{([a-zA-Z0-9._]*)$/, `{{${variable}}}`);
      node.textContent = updatedBefore + afterCursor;

      const newRange = document.createRange();
      newRange.setStart(node, updatedBefore.length);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
    }

    updateBlock(block.id, { text: el.innerText } as Partial<DocBlock>);
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
        className: `font-bold outline-none w-full cursor-text min-h-[1.5em] ${sizeClass}`,
        'aria-label': `Heading level ${block.level}, editable`,
      };

      if (block.level === 1) return <h1 {...commonProps}>{block.text}</h1>;
      if (block.level === 2) return <h2 {...commonProps}>{block.text}</h2>;
      if (block.level === 3) return <h3 {...commonProps}>{block.text}</h3>;
      if (block.level === 4) return <h4 {...commonProps}>{block.text}</h4>;
      if (block.level === 5) return <h5 {...commonProps}>{block.text}</h5>;
      return <h6 {...commonProps}>{block.text}</h6>;
    }


    case 'paragraph':
      return (
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
          className="outline-none w-full cursor-text min-h-[1.5em] text-sm leading-relaxed"
          aria-label="Paragraph, editable"
        >
          {block.text}
        </p>
      );

    case 'table':
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
                    style={{
                      width: col.width,
                      background: block.styles.headerBg ?? '#F3F4F6',
                      color: block.styles.headerColor ?? '#111827',
                      border: `${block.styles.borderWidth ?? 1}px solid ${block.styles.borderColor ?? '#E5E7EB'}`,
                      padding: `${block.styles.cellPadding ?? 8}px`,
                      textAlign: col.align ?? 'left',
                    }}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {block.columns.map((col, i) => (
                  <td
                    key={i}
                    style={{
                      border: `${block.styles.borderWidth ?? 1}px solid ${block.styles.borderColor ?? '#E5E7EB'}`,
                      padding: `${block.styles.cellPadding ?? 8}px`,
                      color: '#6B7280',
                      textAlign: col.align ?? 'left',
                    }}
                    className="italic"
                  >
                    {col.value}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          <p className="text-[10px] text-gray-400 mt-1">
            Loops over: <code className="font-mono">{block.loopOver}</code>
          </p>
        </div>
      );

    case 'image': {
      const imgWidth = block.width !== undefined ? `${block.width}px` : (typeof block.styles.width === 'number' ? `${block.styles.width}px` : (block.styles.width ?? '100%'));
      const imgHeight = block.height !== undefined ? `${block.height}px` : (typeof block.styles.height === 'number' ? `${block.styles.height}px` : 'auto');

      return (
        <div 
          style={{ width: imgWidth, height: imgHeight }} 
          className="flex items-center justify-center border border-dashed border-gray-200 rounded bg-gray-50 overflow-hidden"
        >
          {block.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={block.src}
              alt={block.alt}
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

    case 'columns':
      return (
        <div className="flex gap-2 my-2" aria-label="Columns block">
          {block.columns.map((col, i) => (
            <div
              key={i}
              style={{ width: col.width }}
              className="border border-dashed border-indigo-200 rounded p-3 bg-indigo-50/30 min-h-[60px] flex items-center justify-center"
            >
              <span className="text-xs text-indigo-400">{col.width} column</span>
            </div>
          ))}
        </div>
      );

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
                const textVal = (sub as any).text ?? '';
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
