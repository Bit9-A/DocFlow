'use client';

import { useEffect, useCallback } from 'react';
import { Canvas } from '@/components/canvas/Canvas';
import { BlockToolbar } from '@/components/toolbar/BlockToolbar';
import { StyleInspector } from '@/components/sidebar/StyleInspector';
import { EditorHeader } from '@/components/ui/EditorHeader';
import { PDFPreview } from '@/components/ui/PDFPreview';
import { useDocumentStore } from '@/store/useDocumentStore';
import { useUIStore } from '@/store/useUIStore';
import { PanelRightOpen, PanelRightClose, Plus, X } from 'lucide-react';

export default function EditorPage() {
  const breakpoint = useUIStore((s) => s.breakpoint);
  const setBreakpoint = useUIStore((s) => s.setBreakpoint);
  const isMobileToolbarOpen = useUIStore((s) => s.isMobileToolbarOpen);
  const isMobileInspectorOpen = useUIStore((s) => s.isMobileInspectorOpen);
  const toggleMobileToolbar = useUIStore((s) => s.toggleMobileToolbar);
  const toggleMobileInspector = useUIStore((s) => s.toggleMobileInspector);
  const closeAllMobile = useUIStore((s) => s.closeAllMobile);

  // Responsive breakpoint detection
  useEffect(() => {
    function handleResize() {
      const w = window.innerWidth;
      if (w >= 1024) setBreakpoint('desktop');
      else if (w >= 640) setBreakpoint('tablet');
      else setBreakpoint('mobile');
    }

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setBreakpoint]);

  // Close mobile drawers on Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        closeAllMobile();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeAllMobile]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isMobileToolbarOpen || isMobileInspectorOpen) {
      document.body.classList.add('drawer-open');
    } else {
      document.body.classList.remove('drawer-open');
    }
    return () => document.body.classList.remove('drawer-open');
  }, [isMobileToolbarOpen, isMobileInspectorOpen]);

  // Global keyboard shortcuts
  const handleUndo = useCallback(() => {
    useDocumentStore.temporal.getState().undo();
  }, []);
  const handleRedo = useCallback(() => {
    useDocumentStore.temporal.getState().redo();
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === 'y' || (e.key === 'z' && e.shiftKey))
      ) {
        e.preventDefault();
        handleRedo();
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const target = e.target as HTMLElement;
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable
        ) {
          return;
        }

        const selectedId = useDocumentStore.getState().selectedBlockId;
        if (selectedId) {
          const ast = useDocumentStore.getState().ast;
          const findBlock = (blocks: any[], id: string): any => {
            for (const b of blocks) {
              if (b.id === id) return b;
              if (b.blocks) {
                const found = findBlock(b.blocks, id);
                if (found) return found;
              }
              if (b.columns) {
                for (const col of b.columns) {
                  const found = findBlock(col.blocks, id);
                  if (found) return found;
                }
              }
            }
            return null;
          };
          const selectedBlock = findBlock(ast, selectedId);
          if (selectedBlock && !selectedBlock.isLocked) {
            e.preventDefault();
            useDocumentStore.getState().removeBlock(selectedId);
            const announcer = document.getElementById('canvas-announcer');
            if (announcer !== null) {
              announcer.textContent = 'Deleted selected block';
            }
          }
        }
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo]);

  const isDesktop = breakpoint === 'desktop';
  const isTablet = breakpoint === 'tablet';

  return (
    <div className="flex flex-col h-screen bg-[#0d0d1f] overflow-hidden">
      <EditorHeader />

      <div className="flex flex-1 overflow-hidden relative">
        {/* ================================================================ */}
        {/* DESKTOP: Left toolbar (always visible) */}
        {/* ================================================================ */}
        {isDesktop && (
          <BlockToolbar />
        )}

        {/* ================================================================ */}
        {/* TABLET / MOBILE: Drawer overlays + FAB for toolbar */}
        {/* ================================================================ */}
        {!isDesktop && (
          <>
            {/* Backdrop */}
            <div
              className={`drawer-backdrop ${isMobileToolbarOpen || isMobileInspectorOpen ? 'open' : ''}`}
              onClick={closeAllMobile}
              aria-hidden="true"
            />

            {/* Toolbar drawer (left) */}
            <div
              className={`mobile-drawer left ${isMobileToolbarOpen ? '' : 'closed'}`}
              role="dialog"
              aria-modal="true"
              aria-label="Block types panel"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <span className="text-xs font-semibold text-white/60 uppercase tracking-widest">
                  Blocks
                </span>
                <button
                  onClick={closeAllMobile}
                  className="p-1 rounded text-white/40 hover:text-white hover:bg-white/10 transition-all"
                  aria-label="Close block toolbar"
                >
                  <X size={16} />
                </button>
              </div>
              <BlockToolbar onClose={closeAllMobile} />
            </div>

            {/* Inspector drawer (right) */}
            <div
              className={`mobile-drawer right ${isMobileInspectorOpen ? '' : 'closed'}`}
              role="dialog"
              aria-modal="true"
              aria-label="Style inspector panel"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#111122]">
                <span className="text-xs font-semibold text-white/60 uppercase tracking-widest">
                  Properties
                </span>
                <button
                  onClick={closeAllMobile}
                  className="p-1 rounded text-white/40 hover:text-white hover:bg-white/10 transition-all"
                  aria-label="Close inspector"
                >
                  <X size={16} />
                </button>
              </div>
              <StyleInspector />
            </div>

            {/* Tablet: floating action buttons */}
            {isTablet && (
              <>
                <button
                  onClick={toggleMobileToolbar}
                  className="fab-toolbar"
                  aria-label={isMobileToolbarOpen ? 'Close block toolbar' : 'Open block toolbar'}
                  style={{ right: isMobileInspectorOpen ? 'calc(280px + 32px)' : '24px', bottom: '24px' }}
                >
                  {isMobileToolbarOpen ? <X size={24} /> : <Plus size={24} />}
                </button>
                <button
                  onClick={toggleMobileInspector}
                  className="fab-toolbar"
                  aria-label={isMobileInspectorOpen ? 'Close inspector' : 'Open inspector'}
                  style={{ right: '24px', bottom: '92px' }}
                >
                  {isMobileInspectorOpen ? <PanelRightClose size={22} /> : <PanelRightOpen size={22} />}
                </button>
              </>
            )}
          </>
        )}

        {/* ================================================================ */}
        {/* CANVAS - Always fills remaining space */}
        {/* ================================================================ */}
        <Canvas />

        {/* ================================================================ */}
        {/* DESKTOP: Right inspector (always visible) */}
        {/* ================================================================ */}
        {isDesktop && (
          <StyleInspector />
        )}
      </div>

      {/* PDF Preview Modal */}
      <PDFPreview />
    </div>
  );
}
