'use client';

import { useDocumentStore } from '@/store/useDocumentStore';
import { useUIStore } from '@/store/useUIStore';
import { SortableBlock } from './SortableBlock';
import { EmptyCanvas } from './EmptyCanvas';
import { PAGE_SIZES } from '@docflow/core/constants';
import type { DocBlock, DocBlockType } from '@docflow/core';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';

// ============================================================
// Virtual page helpers
// Split the flat block list into pages by page-break boundaries.
// ============================================================

function getVirtualPages(blocks: DocBlock[]): DocBlock[][] {
  const pages: DocBlock[][] = [];
  let current: DocBlock[] = [];

  for (const block of blocks) {
    if (block.type === 'page-break') {
      pages.push(current);
      current = [];
    } else {
      current.push(block);
    }
  }
  // Always push the last page (even if empty)
  pages.push(current);

  return pages;
}

export function Canvas() {
  const ast = useDocumentStore((s) => s.ast);
  const metadata = useDocumentStore((s) => s.metadata);
  const selectedBlockId = useDocumentStore((s) => s.selectedBlockId);
  const selectBlock = useDocumentStore((s) => s.selectBlock);
  const updateMetadata = useDocumentStore((s) => s.updateMetadata);
  const addBlock = useDocumentStore((s) => s.addBlock);

  const currentPageView = useUIStore((s) => s.currentPageView);
  const setCurrentPageView = useUIStore((s) => s.setCurrentPageView);
  const setPageInsertAfterId = useUIStore((s) => s.setPageInsertAfterId);

  const containerRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLElement>(null);
  const [paperScale, setPaperScale] = useState(1);
  const [isDragOver, setIsDragOver] = useState(false);

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

  const wrapperStyle: React.CSSProperties = paperScale < 1
    ? { height: `${paperHeight * paperScale + 48}px` }
    : {};

  const headerBlock = ast.find((b) => b.type === 'header');
  const footerBlock = ast.find((b) => b.type === 'footer');
  const mainBlocks = useMemo(
    () => ast.filter((b) => b.type !== 'header' && b.type !== 'footer'),
    [ast],
  );

  // ── Virtual pages ──────────────────────────────────────
  const virtualPages = useMemo(() => getVirtualPages(mainBlocks), [mainBlocks]);
  const totalPages = virtualPages.length;
  const safePageIdx = Math.min(currentPageView, totalPages - 1);
  const currentPageBlocks = virtualPages[safePageIdx] ?? [];

  // ── Page actions ───────────────────────────────────────
  const handleAddPage = useCallback(() => {
    // Append a page-break at the very end of the AST,
    // then navigate to the new empty page.
    addBlock('page-break');
    setCurrentPageView(totalPages);
  }, [addBlock, setCurrentPageView, totalPages]);

  const handleRemovePage = useCallback(() => {
    if (totalPages <= 1) return;
    // Remove all blocks on current page + the preceding page-break
    const state = useDocumentStore.getState();
    const currentAst = state.ast;
    const allBlocks = currentAst.filter((b) => b.type !== 'header' && b.type !== 'footer');
    const pageBreaks: number[] = [];
    allBlocks.forEach((b, i) => {
      if (b.type === 'page-break') pageBreaks.push(i);
    });

    // Build list of block IDs to remove (current page blocks + boundary page-break)
    const startIdx = safePageIdx === 0 ? 0 : (pageBreaks[safePageIdx - 1] ?? -1) + 1;
    const endIdx = safePageIdx < pageBreaks.length ? pageBreaks[safePageIdx] : allBlocks.length;

    const idsToRemove = new Set<string>();
    for (let i = startIdx; i < endIdx; i++) {
      idsToRemove.add(allBlocks[i]!.id);
    }
    // Also remove the trailing page-break if it's not the last block
    if (safePageIdx < pageBreaks.length && endIdx < allBlocks.length) {
      idsToRemove.add(allBlocks[endIdx]!.id);
    }

    // Remove blocks from ast
    const newAst = currentAst.filter((b) => !idsToRemove.has(b.id));
    useDocumentStore.setState({ ast: newAst });

    // Navigate to previous page (or stay at 0)
    setCurrentPageView(Math.max(0, safePageIdx - 1));
  }, [totalPages, safePageIdx, setCurrentPageView]);

  // Reset page view if it exceeds total (e.g. after page deletion from undo)
  useEffect(() => {
    if (safePageIdx !== currentPageView) {
      setCurrentPageView(safePageIdx);
    }
  }, [safePageIdx, currentPageView, setCurrentPageView]);

  // Find the correct insertion point for new blocks:
  // - If current page has blocks → insert after the last block on this page
  // - If current page is empty but NOT page 0 → insert AFTER the preceding page-break
  // - Otherwise → append to end (page 0 with no blocks)
  const insertAfterId = useMemo<string | undefined>(() => {
    if (currentPageBlocks.length > 0) {
      return currentPageBlocks[currentPageBlocks.length - 1]!.id;
    }
    // Empty page: insert after the page-break that starts this page
    if (safePageIdx > 0) {
      // The (safePageIdx-1)th page-break in mainBlocks is the boundary
      let breakCount = 0;
      for (const b of mainBlocks) {
        if (b.type === 'page-break') {
          if (breakCount === safePageIdx - 1) return b.id;
          breakCount++;
        }
      }
    }
    return undefined;
  }, [currentPageBlocks, safePageIdx, mainBlocks]);

  // Sync the insert context so BlockToolbar (outside Canvas) inserts on current page
  useEffect(() => {
    setPageInsertAfterId(insertAfterId ?? null);
  }, [insertAfterId, setPageInsertAfterId]);

  // ── Drag-from-toolbar handlers ────────────────────────
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (e.dataTransfer.types.includes('application/docflow-block-type')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    },
    [],
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/docflow-block-type')) {
      e.preventDefault();
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const blockType = e.dataTransfer.getData('application/docflow-block-type') as DocBlockType;
      if (!blockType) return;

      const paperEl = paperRef.current;
      if (!paperEl) {
        addBlock(blockType, insertAfterId);
        return;
      }

      const paperRect = paperEl.getBoundingClientRect();
      const scale = paperScale;

      const relX = (e.clientX - paperRect.left) / scale;
      const relY = (e.clientY - paperRect.top) / scale;

      const x = Math.max(metadata.margins.left, Math.min(relX, paperWidth - metadata.margins.right - 100));
      const y = Math.max(metadata.margins.top, Math.min(relY, paperHeight - metadata.margins.bottom - 50));

      addBlock(blockType, insertAfterId);
      const newBlockId = useDocumentStore.getState().selectedBlockId;
      if (newBlockId !== null) {
        useDocumentStore.getState().updateBlock(newBlockId, { x, y });
      }

      const announcer = document.getElementById('canvas-announcer');
      if (announcer !== null) {
        announcer.textContent = `Placed new ${blockType} block at position ${Math.round(x)}, ${Math.round(y)}`;
      }
    },
    [paperScale, paperWidth, paperHeight, metadata.margins, addBlock, insertAfterId],
  );

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
      className="flex-1 bg-[#0f0f23] docflow-canvas flex flex-col overflow-hidden"
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

      {/* ── Page Navigation Bar ─────────────────────────────── */}
      <div className="flex items-center justify-center gap-1.5 px-3 py-2 border-b border-white/10 bg-[#151530] shrink-0">
        <div className="flex items-center gap-1">
          {virtualPages.map((_page, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentPageView(idx)}
              className={`
                px-3 py-1 text-xs font-semibold rounded-lg transition-all
                ${idx === safePageIdx
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-white/50 hover:text-white hover:bg-white/10'
                }
              `}
              aria-label={`Go to page ${idx + 1}`}
              aria-current={idx === safePageIdx ? 'page' : undefined}
            >
              {idx + 1}
            </button>
          ))}
        </div>

        <span className="text-[10px] text-white/30 mx-1">|</span>

        <button
          onClick={handleAddPage}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600/70 hover:bg-indigo-500 text-white text-xs font-semibold transition-all active:scale-95"
          aria-label="Add new page"
        >
          + Add Page
        </button>

        {totalPages > 1 && (
          <button
            onClick={handleRemovePage}
            className="px-2 py-1 rounded-lg text-white/40 hover:text-red-400 hover:bg-white/5 text-xs transition-all"
            aria-label="Remove current page"
            title="Remove this page and its content"
          >
            ✕
          </button>
        )}

        {totalPages > 0 && (
          <span className="text-[10px] text-white/30 ml-1">
            Page {safePageIdx + 1} of {totalPages}
          </span>
        )}
      </div>

      <div className="flex justify-center py-8 md:py-12 px-2 md:px-6 flex-1 overflow-auto" style={wrapperStyle}>
        {/* The paper — also drop target */}
        <section
          ref={paperRef}
          style={pageStyle}
          className={`
            bg-white shadow-2xl shadow-black/40 relative select-none overflow-hidden flex-shrink-0
            transition-shadow duration-200
            ${isDragOver ? 'shadow-indigo-500/30 ring-2 ring-indigo-400/50' : ''}
          `}
          role="region"
          aria-label="Document page"
          onClick={(e) => {
            if (e.target === e.currentTarget) selectBlock(null);
          }}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Visual Margins Guide */}
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

          {/* Drop zone overlay indicator */}
          {isDragOver && (
            <div
              className="absolute inset-0 z-[150] pointer-events-none bg-indigo-500/5"
              aria-hidden="true"
            >
              <div className="absolute inset-0 border-2 border-dashed border-indigo-400/30 m-4 rounded-lg flex items-center justify-center">
                <span className="text-xs font-semibold text-indigo-400/60 bg-white px-3 py-1 rounded-full shadow-sm">
                  Drop block here
                </span>
              </div>
            </div>
          )}

          {/* Absolute Header (Word-like) — appears on every page */}
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

          {/* Current page blocks */}
          {mainBlocks.length === 0 && !headerBlock && !footerBlock ? (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-auto z-10">
              <EmptyCanvas />
            </div>
          ) : currentPageBlocks.length === 0 && safePageIdx > 0 ? (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-auto z-10">
              <div className="text-center text-gray-400">
                <p className="text-sm text-gray-500 font-medium">Empty page</p>
                <p className="text-[11px] text-gray-400 mt-1">Add blocks using the toolbar</p>
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 pointer-events-none z-10">
              {currentPageBlocks.map((block) => (
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
