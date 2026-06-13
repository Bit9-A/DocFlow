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
} from 'lucide-react';
import { useDocumentStore } from '@/store/useDocumentStore';

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
];

interface BlockToolbarProps {
  afterBlockId?: string;
  onClose?: () => void;
}

export function BlockToolbar({ afterBlockId, onClose }: BlockToolbarProps) {
  const addBlock = useDocumentStore((s) => s.addBlock);

  function handleAdd(type: DocBlockType) {
    addBlock(type, afterBlockId);
    const announcer = document.getElementById('canvas-announcer');
    if (announcer !== null) {
      announcer.textContent = `Added new ${type} block`;
    }
    onClose?.();
  }

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
                className="
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left
                  text-white/70 hover:text-white hover:bg-white/10
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
                  transition-all duration-150 group
                "
                title={opt.description}
              >
                <span className="text-indigo-400 group-hover:text-indigo-300 transition-colors flex-shrink-0">
                  {opt.icon}
                </span>
                <span className="text-sm font-medium">{opt.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Keyboard hint */}
      <div className="px-4 py-2 border-t border-white/5 hidden lg:block">
        <p className="text-[9px] text-white/20 text-center">
          Press <kbd className="px-1 py-0.5 rounded bg-white/5 text-white/30 font-mono">⌘Z</kbd> to undo
        </p>
      </div>
    </aside>
  );
}
