'use client';

import { Plus } from 'lucide-react';
import { useDocumentStore } from '@/store/useDocumentStore';

export function EmptyCanvas() {
  const addBlock = useDocumentStore((s) => s.addBlock);

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div
        className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4 text-indigo-400"
      >
        <Plus size={28} />
      </div>
      <h2 className="text-base font-semibold text-gray-700 mb-1">
        Your document is empty
      </h2>
      <p className="text-sm text-gray-400 mb-6 max-w-xs">
        Add your first block from the panel on the left, or start with a heading.
      </p>
      <button
        onClick={() => {
          addBlock('heading');
          const announcer = document.getElementById('canvas-announcer');
          if (announcer !== null) {
            announcer.textContent = 'Added new heading block';
          }
        }}
        className="
          flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium
          rounded-lg hover:bg-indigo-700 active:scale-95
          transition-all duration-150
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2
        "
      >
        <Plus size={14} />
        Add Heading
      </button>
    </div>
  );
}
