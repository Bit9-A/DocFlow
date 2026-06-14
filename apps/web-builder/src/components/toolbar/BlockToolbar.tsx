'use client';

import type { DocBlock, DocBlockType } from '@docflow/core';
import {
  FileText,
  Heading1,
  Image,
  LayoutGrid,
  Minus,
  Rows3,
  Scissors,
  Space,
  Type,
  Hash,
  FileSignature,
  Box,
  QrCode,
  List,
  BarChart,
} from 'lucide-react';
import { useDocumentStore } from '@/store/useDocumentStore';
import { useUIStore } from '@/store/useUIStore';
import { useCallback } from 'react';

interface BlockOption {
  type: DocBlockType;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const BLOCK_OPTIONS: BlockOption[] = [
  {
    type: 'heading',
    label: 'Heading',
    icon: <Heading1 size={18} />,
    description: 'Title or section header',
  },
  {
    type: 'paragraph',
    label: 'Paragraph',
    icon: <Type size={18} />,
    description: 'Body text with formatting',
  },
  {
    type: 'table',
    label: 'Table',
    icon: <Rows3 size={18} />,
    description: 'Dynamic data table with loop',
  },
  {
    type: 'image',
    label: 'Image',
    icon: <Image size={18} />,
    description: 'Photo, logo, or signature',
  },
  {
    type: 'columns',
    label: 'Columns',
    icon: <LayoutGrid size={18} />,
    description: 'Side-by-side layout',
  },
  {
    type: 'divider',
    label: 'Divider',
    icon: <Minus size={18} />,
    description: 'Horizontal separator line',
  },
  {
    type: 'spacer',
    label: 'Spacer',
    icon: <Space size={18} />,
    description: 'Vertical whitespace',
  },
  {
    type: 'page-break',
    label: 'Page Break',
    icon: <Scissors size={18} />,
    description: 'Force a new PDF page',
  },
  {
    type: 'page-number',
    label: 'Page Number',
    icon: <Hash size={18} />,
    description: 'Dynamic page counter',
  },
  {
    type: 'signature',
    label: 'Signature',
    icon: <FileSignature size={18} />,
    description: 'Interactive signature line',
  },
  {
    type: 'container',
    label: 'Container',
    icon: <Box size={18} />,
    description: 'Card layout container',
  },
  {
    type: 'barcode',
    label: 'Barcode / QR',
    icon: <QrCode size={18} />,
    description: 'Vector QR or Code128',
  },
  {
    type: 'list',
    label: 'List',
    icon: <List size={18} />,
    description: 'Ordered or bullet lists',
  },
  {
    type: 'chart',
    label: 'Chart',
    icon: <BarChart size={18} />,
    description: 'Bar, line, or pie charts',
  },
];

interface BlockToolbarProps {
  afterBlockId?: string;
  onClose?: () => void;
}

export function BlockToolbar({ afterBlockId, onClose }: BlockToolbarProps) {
  const addBlock = useDocumentStore((s) => s.addBlock);
  const pageInsertAfterId = useUIStore((s) => s.pageInsertAfterId);

  function handleAdd(type: DocBlockType) {
    // Use the explicit afterBlockId (if given), fall back to current page context
    const resolvedAfterId = afterBlockId ?? pageInsertAfterId ?? undefined;
    addBlock(type, resolvedAfterId);
    const announcer = document.getElementById('canvas-announcer');
    if (announcer !== null) {
      announcer.textContent = `Added new ${type} block`;
    }
    onClose?.();
  }

  const handleDragStart = useCallback(
    (e: React.DragEvent, type: DocBlockType) => {
      e.dataTransfer.setData('application/docflow-block-type', type);
      e.dataTransfer.effectAllowed = 'copy';

      // Custom drag image: a small chip showing the block type
      const ghost = document.createElement('div');
      ghost.textContent = type;
      ghost.style.cssText =
        'position:fixed;top:-1000px;background:#6366f1;color:white;padding:6px 14px;border-radius:8px;font:12px/1 sans-serif;font-weight:600;pointer-events:none;';
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 40, 16);
      setTimeout(() => document.body.removeChild(ghost), 0);
    },
    [],
  );

  return (
    <aside
      className="w-full lg:w-64 bg-[#1a1a2e] lg:border-r border-white/10 flex flex-col h-full overflow-hidden"
      aria-label="Block types panel"
    >
      {/* Desktop header */}
      <div className="px-4 py-3 border-b border-white/10 hidden lg:flex items-center gap-2">
        <FileText size={16} className="text-indigo-400" />
        <span className="text-xs font-semibold text-white/60 uppercase tracking-widest">
          Blocks
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto p-2 lg:p-2" role="navigation" aria-label="Block type list">
        <ul role="list" className="space-y-0.5">
          {BLOCK_OPTIONS.map((opt) => (
            <li key={opt.type}>
              <button
                onClick={() => handleAdd(opt.type)}
                onDragStart={(e) => handleDragStart(e, opt.type)}
                draggable
                className="
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left
                  text-white/70 hover:text-white hover:bg-white/10
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
                  transition-all duration-150 group
                  active:cursor-grabbing
                  [&:active]:scale-[0.97]
                "
                title={`${opt.description} — drag to canvas or click to add`}
              >
                <span className="text-indigo-400 group-hover:text-indigo-300 transition-colors flex-shrink-0 drag-handle">
                  {opt.icon}
                </span>
                <span className="text-sm font-medium flex-1">{opt.label}</span>
                <span className="text-[8px] text-white/20 group-hover:text-white/40 transition-colors hidden lg:inline">
                  drag
                </span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Drag hint */}
      <div className="px-4 py-2 border-t border-white/5 hidden lg:block">
        <p className="text-[9px] text-white/20 text-center flex items-center justify-center gap-1">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <circle cx="3" cy="3" r="1.2" fill="currentColor"/>
            <circle cx="7" cy="3" r="1.2" fill="currentColor"/>
            <circle cx="3" cy="7" r="1.2" fill="currentColor"/>
            <circle cx="7" cy="7" r="1.2" fill="currentColor"/>
          </svg>
          Drag blocks onto the canvas or click to add
        </p>
      </div>
    </aside>
  );
}
