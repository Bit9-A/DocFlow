'use client';

import { useDocumentStore } from '@/store/useDocumentStore';
import { SortableBlock } from './SortableBlock';
import { EmptyCanvas } from './EmptyCanvas';
import { PAGE_SIZES } from '@docflow/core/constants';
import { useEffect, useState, useRef } from 'react';

export function Canvas() {
  const ast = useDocumentStore((s) => s.ast);
  const metadata = useDocumentStore((s) => s.metadata);
  const selectedBlockId = useDocumentStore((s) => s.selectedBlockId);
  const selectBlock = useDocumentStore((s) => s.selectBlock);
  const updateMetadata = useDocumentStore((s) => s.updateMetadata);
  const containerRef = useRef<HTMLDivElement>(null);
  const [paperScale, setPaperScale] = useState(1);

  // Page size dimensions (in points)
  const sizeTuple = PAGE_SIZES[metadata.pageSize] || PAGE_SIZES.LETTER;
  const width = sizeTuple[0];
  const height = sizeTuple[1];
  const paperWidth = metadata.orientation === 'landscape' ? height : width;
  const paperHeight = metadata.orientation === 'landscape' ? width : height;

  // Responsive paper scaling
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function calculateScale() {
      if (!containerRef.current) return;
      // Available width = container width minus padding
      const availableWidth = containerRef.current.clientWidth - 32;
      if (availableWidth < paperWidth) {
        const newScale = Math.max(0.35, availableWidth / paperWidth);
        setPaperScale(newScale);
      } else {
        setPaperScale(1);
      }
    }

    calculateScale();
    const observer = new ResizeObserver(calculateScale);
    observer.observe(el);
    return () => observer.disconnect();
  }, [paperWidth]);

  const pageStyle: React.CSSProperties = {
    width: `${paperWidth}px`,
    minHeight: `${paperHeight}px`,
    position: 'relative' as const,
    transform: paperScale < 1 ? `scale(${paperScale})` : undefined,
    transformOrigin: 'top center',
  };

  // The wrapper height accounts for scaled paper
  const wrapperStyle: React.CSSProperties = paperScale < 1
    ? { height: `${paperHeight * paperScale + 48}px` }
    : {};

  const marginStyle = {
    paddingTop: `${metadata.margins.top}px`,
    paddingBottom: `${metadata.margins.bottom}px`,
    paddingLeft: `${metadata.margins.left}px`,
    paddingRight: `${metadata.margins.right}px`,
  };

  const headerBlock = ast.find((b) => b.type === 'header');
  const footerBlock = ast.find((b) => b.type === 'footer');
  const mainBlocks = ast.filter((b) => b.type !== 'header' && b.type !== 'footer');

  const handleHeaderResizeStart = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const startY = e.clientY;
    const startTop = metadata.margins.top;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dy = moveEvent.clientY - startY;
      const newTop = Math.min(Math.max(startTop + dy, 20), 250);
      updateMetadata({
        margins: {
          ...metadata.margins,
          top: newTop,
        },
      });
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handleFooterResizeStart = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const startY = e.clientY;
    const startBottom = metadata.margins.bottom;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dy = moveEvent.clientY - startY;
      const newBottom = Math.min(Math.max(startBottom - dy, 20), 250);
      updateMetadata({
        margins: {
          ...metadata.margins,
          bottom: newBottom,
        },
      });
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  return (
    <main
      ref={containerRef}
      className="flex-1 bg-[#0f0f23] overflow-auto docflow-canvas"
      onClick={(e) => {
        if (e.target === e.currentTarget) selectBlock(null);
      }}
      aria-label="Document canvas"
    >
      {/* Live region for screen reader announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        id="canvas-announcer"
      />

      <div className="flex justify-center py-8 md:py-12 px-2 md:px-6" style={wrapperStyle}>
        {/* The paper */}
        <section
          style={pageStyle}
          className="bg-white shadow-2xl shadow-black/40 relative select-none overflow-hidden flex-shrink-0"
          role="region"
          aria-label="Document page"
          onClick={(e) => {
            if (e.target === e.currentTarget) selectBlock(null);
          }}
        >
          {/* Visual Margins Guide (Word-like dashed guide) */}
          <div
            style={{
              position: 'absolute',
              top: `${metadata.margins.top}px`,
              bottom: `${metadata.margins.bottom}px`,
              left: `${metadata.margins.left}px`,
              right: `${metadata.margins.right}px`,
              pointerEvents: 'none',
            }}
            className="border border-dashed border-gray-300/50 z-0"
            aria-hidden="true"
          />

          {/* Absolute Header (Word-like) */}
          {headerBlock && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: `${metadata.margins.top}px`,
                backgroundColor: headerBlock.styles?.backgroundColor ?? 'transparent',
                borderBottom: headerBlock.styles?.borderColor 
                  ? `${headerBlock.styles.borderWidth ?? 1}px solid ${headerBlock.styles.borderColor}`
                  : undefined,
                pointerEvents: 'auto',
                zIndex: 10,
              }}
              className={`hover:border-indigo-400/60 transition-all cursor-pointer ${
                !headerBlock.styles?.borderColor ? 'border-b border-dashed border-indigo-200/40' : ''
              } ${
                selectedBlockId === headerBlock.id ? 'bg-indigo-50/5 border-indigo-500/80 ring-1 ring-indigo-500/30' : ''
              }`}
              onClick={(e) => {
                e.stopPropagation();
                selectBlock(headerBlock.id);
              }}
            >
              {/* Header height drag handle */}
              {selectedBlockId === headerBlock.id && (
                <div
                  onPointerDown={handleHeaderResizeStart}
                  className="absolute bottom-0 left-0 right-0 h-1.5 bg-indigo-500/30 hover:bg-indigo-500 cursor-ns-resize z-20 flex items-center justify-center transition-colors"
                  title="Drag to change header height (margin top)"
                  aria-label="Resize header height"
                >
                  <div className="w-10 h-1 bg-white/80 rounded-full" />
                </div>
              )}

              <span className="absolute top-1 left-2 text-[8px] font-bold text-indigo-400/60 uppercase tracking-wider select-none pointer-events-none">
                Header Area (Encabezado)
              </span>

              {headerBlock.blocks && headerBlock.blocks.map((child) => (
                <SortableBlock
                  key={child.id}
                  block={child}
                  isSelected={selectedBlockId === child.id}
                  onSelect={() => selectBlock(child.id)}
                  parentType="header"
                />
              ))}
            </div>
          )}

          {mainBlocks.length === 0 && !headerBlock && !footerBlock ? (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-auto z-10">
              <EmptyCanvas />
            </div>
          ) : (
            <div className="absolute inset-0 pointer-events-none z-10">
              {mainBlocks.map((block) => (
                <div key={block.id} className="pointer-events-auto">
                  <SortableBlock
                    block={block}
                    isSelected={selectedBlockId === block.id}
                    onSelect={() => selectBlock(block.id)}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Absolute Footer (Word-like) */}
          {footerBlock && (
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: `${metadata.margins.bottom}px`,
                backgroundColor: footerBlock.styles?.backgroundColor ?? 'transparent',
                borderTop: footerBlock.styles?.borderColor
                  ? `${footerBlock.styles.borderWidth ?? 1}px solid ${footerBlock.styles.borderColor}`
                  : undefined,
                pointerEvents: 'auto',
                zIndex: 10,
              }}
              className={`hover:border-purple-400/60 transition-all cursor-pointer ${
                !footerBlock.styles?.borderColor ? 'border-t border-dashed border-purple-200/40' : ''
              } ${
                selectedBlockId === footerBlock.id ? 'bg-purple-50/5 border-purple-500/80 ring-1 ring-purple-500/30' : ''
              }`}
              onClick={(e) => {
                e.stopPropagation();
                selectBlock(footerBlock.id);
              }}
            >
              {/* Footer height drag handle */}
              {selectedBlockId === footerBlock.id && (
                <div
                  onPointerDown={handleFooterResizeStart}
                  className="absolute top-0 left-0 right-0 h-1.5 bg-purple-500/30 hover:bg-purple-500 cursor-ns-resize z-20 flex items-center justify-center transition-colors"
                  title="Drag to change footer height (margin bottom)"
                  aria-label="Resize footer height"
                >
                  <div className="w-10 h-1 bg-white/80 rounded-full" />
                </div>
              )}

              <span className="absolute bottom-1 left-2 text-[8px] font-bold text-purple-400/60 uppercase tracking-wider select-none pointer-events-none">
                Footer Area (Pie de página)
              </span>

              {footerBlock.blocks && footerBlock.blocks.map((child) => (
                <SortableBlock
                  key={child.id}
                  block={child}
                  isSelected={selectedBlockId === child.id}
                  onSelect={() => selectBlock(child.id)}
                  parentType="footer"
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
