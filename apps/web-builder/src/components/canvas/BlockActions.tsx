'use client';

import type { DocBlockType, DocBlock } from '@docflow/core';
import { Copy, Trash2, Lock, Unlock } from 'lucide-react';
import { useDocumentStore } from '@/store/useDocumentStore';

interface BlockActionsProps {
  blockId: string;
  blockType: DocBlockType;
  isLocked?: boolean;
}

export function BlockActions({ blockId, blockType: _blockType, isLocked = false }: BlockActionsProps) {
  const removeBlock = useDocumentStore((s) => s.removeBlock);
  const duplicateBlock = useDocumentStore((s) => s.duplicateBlock);
  const updateBlock = useDocumentStore((s) => s.updateBlock);

  function handleToggleLock(e: React.MouseEvent) {
    e.stopPropagation();
    const nextLocked = !isLocked;
    updateBlock(blockId, { isLocked: nextLocked } as Partial<DocBlock>);
    const announcer = document.getElementById('canvas-announcer');
    if (announcer !== null) {
      announcer.textContent = nextLocked ? 'Block locked' : 'Block unlocked';
    }
  }

  function handleRemove(e: React.MouseEvent) {
    e.stopPropagation();
    if (isLocked) return;
    const announcer = document.getElementById('canvas-announcer');
    if (announcer !== null) announcer.textContent = 'Block removed';
    removeBlock(blockId);
  }

  function handleDuplicate(e: React.MouseEvent) {
    e.stopPropagation();
    if (isLocked) return;
    const announcer = document.getElementById('canvas-announcer');
    if (announcer !== null) announcer.textContent = 'Block duplicated';
    duplicateBlock(blockId);
  }

  return (
    <div
      className="
        absolute -top-8 right-0 z-20
        flex items-center gap-1 bg-[#1a1a2e] border border-white/10
        rounded-lg px-1.5 py-1 shadow-lg
      "
      role="toolbar"
      aria-label="Block actions"
    >
      <button
        onClick={handleToggleLock}
        className={`
          p-1 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
          ${isLocked ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10' : 'text-white/50 hover:text-white hover:bg-white/10'}
        `}
        title={isLocked ? "Unlock block" : "Lock block"}
        aria-label={isLocked ? "Unlock block" : "Lock block"}
      >
        {isLocked ? <Lock size={13} /> : <Unlock size={13} />}
      </button>

      <div className="w-px h-3 bg-white/20" />

      <button
        onClick={handleDuplicate}
        disabled={isLocked}
        className="
          p-1 rounded text-white/50 hover:text-white hover:bg-white/10
          disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-white/50
          transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
        "
        title={isLocked ? "Locked" : "Duplicate block"}
        aria-label="Duplicate block"
      >
        <Copy size={13} />
      </button>

      <div className="w-px h-3 bg-white/20" />

      <button
        onClick={handleRemove}
        disabled={isLocked}
        className="
          p-1 rounded text-white/50 hover:text-red-400 hover:bg-red-500/10
          disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-white/50
          transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500
        "
        title={isLocked ? "Locked" : "Delete block"}
        aria-label="Delete block"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}
