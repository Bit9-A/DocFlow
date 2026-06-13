'use client';

import type { DocBlock } from '@docflow/core';
import { GripVertical, Lock } from 'lucide-react';
import { BlockRenderer } from './BlockRenderer';
import { BlockActions } from './BlockActions';
import { useDocumentStore } from '@/store/useDocumentStore';
import { PAGE_SIZES } from '@docflow/core/constants';
import { useRef } from 'react';

const clamp = (val: number, min: number, max: number) =>
  Math.min(Math.max(val, min), Math.max(min, max));

interface DraggableBlockProps {
  block: DocBlock;
  isSelected: boolean;
  onSelect: () => void;
  parentType?: 'header' | 'footer';
}

export function SortableBlock({ block, isSelected, onSelect, parentType }: DraggableBlockProps) {
  const updateBlock = useDocumentStore((s) => s.updateBlock);
  const metadata = useDocumentStore((s) => s.metadata);
  const blockRef = useRef<HTMLDivElement>(null);

  // Calculate paper sizes (same logic as Canvas.tsx)
  const sizeTuple = PAGE_SIZES[metadata.pageSize] || PAGE_SIZES.LETTER;
  const width = sizeTuple[0];
  const height = sizeTuple[1];
  const paperWidth = metadata.orientation === 'landscape' ? height : width;
  const paperHeight = metadata.orientation === 'landscape' ? width : height;

  const margins = metadata.margins;

  // Header/Footer boundaries logic
  const isHeaderOrFooter = block.type === 'header' || block.type === 'footer';
  const isHeaderSub = parentType === 'header';
  const isFooterSub = parentType === 'footer';

  const ignoreMargins = block.ignoreMargins ?? false;

  const minX = ignoreMargins ? 0 : margins.left;
  const maxX = paperWidth - (ignoreMargins ? 0 : margins.right) - (block.width ?? 100);

  const minY = isHeaderSub || isFooterSub ? 0 : (ignoreMargins ? 0 : margins.top);
  const maxY = isHeaderSub
    ? margins.top - (block.height ?? 15)
    : isFooterSub
      ? margins.bottom - (block.height ?? 15)
      : paperHeight - (ignoreMargins ? 0 : margins.bottom) - (block.height ?? 30);

  // Position and Size Styles
  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${block.x ?? minX}px`,
    top: `${block.y ?? minY}px`,
    width: block.width !== undefined ? `${block.width}px` : undefined,
    height: block.height !== undefined ? `${block.height}px` : undefined,
  };

  const handleDragStart = (e: React.PointerEvent) => {
    e.stopPropagation();
    onSelect();
    if (block.isLocked) return;
    
    // Announce start drag
    const announcer = document.getElementById('canvas-announcer');
    if (announcer !== null) {
      announcer.textContent = `Picked up ${block.type} block`;
    }

    const startX = e.clientX;
    const startY = e.clientY;
    const startBlockX = block.x ?? minX;
    const startBlockY = block.y ?? minY;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      
      const newX = clamp(startBlockX + dx, minX, maxX);
      const newY = clamp(startBlockY + dy, minY, maxY);

      updateBlock(block.id, { x: newX, y: newY });
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      
      // Announce drop location
      const announcer = document.getElementById('canvas-announcer');
      if (announcer !== null) {
        announcer.textContent = `Dropped ${block.type} block at coordinates ${Math.round(block.x ?? minX)}, ${Math.round(block.y ?? minY)}`;
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handleResizeStart = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (block.isLocked) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = block.width ?? 150;
    const startHeight = block.height ?? 100;

    const currentBlockX = block.x ?? minX;
    const currentBlockY = block.y ?? minY;

    const maxWidth = paperWidth - (isHeaderOrFooter ? 0 : (ignoreMargins ? 0 : margins.right)) - currentBlockX;
    const maxHeight = paperHeight - (isHeaderOrFooter ? 0 : (ignoreMargins ? 0 : margins.bottom)) - currentBlockY;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      const newWidth = clamp(startWidth + dx, 30, maxWidth);
      const newHeight = clamp(startHeight + dy, 20, maxHeight);

      updateBlock(block.id, { width: newWidth, height: newHeight });
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  // Keyboard coordinate navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      return;
    }

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect();
    }

    if (isSelected && !block.isLocked) {
      const step = e.shiftKey ? 20 : 5;
      let dx = 0;
      let dy = 0;
      
      if (e.key === 'ArrowLeft') {
        dx = -step;
      } else if (e.key === 'ArrowRight') {
        dx = step;
      } else if (e.key === 'ArrowUp') {
        dy = -step;
      } else if (e.key === 'ArrowDown') {
        dy = step;
      }

      if (dx !== 0 || dy !== 0) {
        e.preventDefault();
        const currentX = block.x ?? minX;
        const currentY = block.y ?? minY;
        const newX = clamp(currentX + dx, minX, maxX);
        const newY = clamp(currentY + dy, minY, maxY);
        updateBlock(block.id, { x: newX, y: newY });
        
        // Announce new coordinates
        const announcer = document.getElementById('canvas-announcer');
        if (announcer !== null) {
          announcer.textContent = `Moved block to position ${Math.round(newX)}, ${Math.round(newY)}`;
        }
      }
    }
  };

  return (
    <div
      ref={blockRef}
      style={style}
      role="listitem"
      tabIndex={0}
      aria-label={`${block.type} block${isSelected ? ', selected' : ''}`}
      aria-selected={isSelected}
      className={`
        absolute group outline-none
        ${isSelected ? 'ring-2 ring-indigo-500 ring-offset-2' : 'hover:ring-1 hover:ring-indigo-300/40 hover:ring-offset-1 focus-visible:ring-1 focus-visible:ring-indigo-400 focus-visible:ring-offset-1'}
        rounded transition-all duration-75
      `}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onKeyDown={handleKeyDown}
    >
      {/* Drag handle or Lock indicator */}
      {block.isLocked ? (
        <div
          className="
            absolute -left-6 top-1/2 -translate-y-1/2 z-10
            p-1 text-red-500/80 bg-red-500/5 rounded border border-red-500/10
          "
          title="Block is locked"
          aria-label="Block is locked"
        >
          <Lock size={12} />
        </div>
      ) : (
        <button
          onPointerDown={handleDragStart}
          className="
            absolute -left-7 top-1/2 -translate-y-1/2 z-10
            opacity-0 group-hover:opacity-100
            p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100
            cursor-grab active:cursor-grabbing
            transition-opacity duration-150
            focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
          "
          aria-label={`Drag to position ${block.type} block`}
          tabIndex={0}
        >
          <GripVertical size={14} />
        </button>
      )}

      {/* Block content */}
      <div className="w-full h-full overflow-hidden">
        <BlockRenderer block={block} isSelected={isSelected} />
      </div>

      {/* Resize Handle — visible on bottom-right corner when selected and not locked */}
      {isSelected && !block.isLocked && (
        <div
          onPointerDown={handleResizeStart}
          className="
            absolute bottom-0 right-0 w-3.5 h-3.5 cursor-se-resize
            bg-indigo-600 border border-white hover:bg-indigo-500
            rounded-tl shadow z-20 transition-all
          "
          title="Drag to resize block"
          aria-label="Resize block"
        />
      )}

      {/* Action buttons — visible on select */}
      {isSelected && (
        <BlockActions blockId={block.id} blockType={block.type} isLocked={block.isLocked} />
      )}
    </div>
  );
}
