import type { DocBlock, DocBlockType, DocFlowSchema } from '@docflow/core';
import { create } from 'zustand';
import { temporal } from 'zundo';
import { nanoid } from 'nanoid';

// ============================================================
// Block defaults factory
// ============================================================

function createDefaultBlock(type: DocBlockType): DocBlock {
  const id = `blk_${nanoid(8)}`;
  const baseStyles = {};

  switch (type) {
    case 'heading':
      return {
        id,
        type: 'heading',
        level: 1,
        text: 'New Heading',
        styles: { fontSize: 24, color: '#111827', marginBottom: 8 },
      };
    case 'paragraph':
      return {
        id,
        type: 'paragraph',
        text: 'Start typing your paragraph here...',
        styles: { fontSize: 11, color: '#374151', marginBottom: 6, lineHeight: 1.6 },
      };
    case 'table':
      return {
        id,
        type: 'table',
        loopOver: 'items',
        columns: [
          { header: 'Column 1', width: '50%', value: '{{item.col1}}' },
          { header: 'Column 2', width: '50%', value: '{{item.col2}}' },
        ],
        styles: {
          headerBg: '#F3F4F6',
          borderColor: '#E5E7EB',
          borderWidth: 1,
          cellPadding: 8,
          fontSize: 11,
        },
      };
    case 'image':
      return {
        id,
        type: 'image',
        src: '',
        alt: 'Image description',
        styles: { width: '100%', marginBottom: 8 },
      };
    case 'divider':
      return {
        id,
        type: 'divider',
        styles: { color: '#E5E7EB', thickness: 1, marginTop: 8, marginBottom: 8 },
      };
    case 'spacer':
      return { id, type: 'spacer', height: 24, styles: baseStyles };
    case 'columns':
      return {
        id,
        type: 'columns',
        columns: [
          { width: '50%', blocks: [] },
          { width: '50%', blocks: [] },
        ],
        styles: baseStyles,
      };
    case 'page-break':
      return { id, type: 'page-break', styles: baseStyles };
    case 'header':
      return { id, type: 'header', blocks: [], styles: baseStyles };
    case 'footer':
      return { id, type: 'footer', blocks: [], styles: baseStyles };
  }
}

function getSelectedBlockContainer(
  ast: DocBlock[],
  selectedId: string | null,
): { type: 'root' | 'header' | 'footer'; parentBlock?: DocBlock } {
  if (!selectedId) return { type: 'root' };

  const headerBlock = ast.find((b) => b.type === 'header');
  const footerBlock = ast.find((b) => b.type === 'footer');

  if (headerBlock) {
    if (headerBlock.id === selectedId) {
      return { type: 'header', parentBlock: headerBlock };
    }
    const isInsideHeader = (blocks: DocBlock[]): boolean => {
      for (const b of blocks) {
        if (b.id === selectedId) return true;
        if (b.type === 'columns') {
          for (const col of b.columns) {
            if (isInsideHeader(col.blocks)) return true;
          }
        }
      }
      return false;
    };
    if (isInsideHeader(headerBlock.blocks)) {
      return { type: 'header', parentBlock: headerBlock };
    }
  }

  if (footerBlock) {
    if (footerBlock.id === selectedId) {
      return { type: 'footer', parentBlock: footerBlock };
    }
    const isInsideFooter = (blocks: DocBlock[]): boolean => {
      for (const b of blocks) {
        if (b.id === selectedId) return true;
        if (b.type === 'columns') {
          for (const col of b.columns) {
            if (isInsideFooter(col.blocks)) return true;
          }
        }
      }
      return false;
    };
    if (isInsideFooter(footerBlock.blocks)) {
      return { type: 'footer', parentBlock: footerBlock };
    }
  }

  return { type: 'root' };
}

// ============================================================
// State & Actions
// ============================================================

export interface DocumentMetadata {
  title: string;
  pageSize: 'LETTER' | 'A4' | 'LEGAL' | 'A3';
  orientation: 'portrait' | 'landscape';
  margins: { top: number; bottom: number; left: number; right: number };
  author?: string;
  subject?: string;
  keywords?: string[];
  customVariables?: Array<{ key: string; value: string }>;
  uploadedJson?: string;
}

interface DocumentState {
  ast: DocBlock[];
  metadata: DocumentMetadata;
  selectedBlockId: string | null;

  // Block mutations
  addBlock: (type: DocBlockType, afterId?: string) => void;
  updateBlock: (id: string, changes: Partial<DocBlock>) => void;
  removeBlock: (id: string) => void;
  moveBlock: (fromIndex: number, toIndex: number) => void;
  duplicateBlock: (id: string) => void;

  // Selection
  selectBlock: (id: string | null) => void;

  // Metadata
  updateMetadata: (changes: Partial<DocumentMetadata>) => void;

  // Import / Export
  exportSchema: () => DocFlowSchema;
  importSchema: (schema: DocFlowSchema) => void;
}

export const useDocumentStore = create<DocumentState>()(
  temporal(
    (set, get) => ({
      ast: [],
      metadata: {
        title: 'Untitled Document',
        pageSize: 'LETTER',
        orientation: 'portrait',
        margins: { top: 40, bottom: 40, left: 50, right: 50 },
        author: '',
        subject: '',
        keywords: [],
        customVariables: [],
        uploadedJson: '',
      },
      selectedBlockId: null,

      addBlock: (type, afterId) => {
        const block = createDefaultBlock(type);
        const margins = get().metadata.margins;

        if (type === 'image') {
          block.width = 150;
          block.height = 100;
        } else if (type === 'divider') {
          block.width = 250;
        } else if (type === 'spacer') {
          block.width = 100;
          block.height = 24;
        } else {
          block.width = 250;
        }

        const selectedId = get().selectedBlockId;
        const container = getSelectedBlockContainer(get().ast, selectedId);

        if (type !== 'header' && type !== 'footer') {
          if (container.type === 'header' && container.parentBlock) {
            block.x = margins.left;
            block.y = 10 + ((container.parentBlock as any).blocks?.length ?? 0) * 20;
            set((state) => {
              const ast = state.ast.map((b) => {
                if (b.id === container.parentBlock!.id) {
                  return {
                    ...b,
                    blocks: [...((b as any).blocks ?? []), block],
                  } as DocBlock;
                }
                return b;
              });
              return { ast, selectedBlockId: block.id };
            });
            return;
          }

          if (container.type === 'footer' && container.parentBlock) {
            block.x = margins.left;
            block.y = 10 + ((container.parentBlock as any).blocks?.length ?? 0) * 20;
            set((state) => {
              const ast = state.ast.map((b) => {
                if (b.id === container.parentBlock!.id) {
                  return {
                    ...b,
                    blocks: [...((b as any).blocks ?? []), block],
                  } as DocBlock;
                }
                return b;
              });
              return { ast, selectedBlockId: block.id };
            });
            return;
          }
        }

        // Initialize absolute coordinates and default sizes for root level
        block.x = margins.left;
        block.y = margins.top + get().ast.length * 35;
        block.page = 0;

        set((state) => {
          const ast = [...state.ast];
          if (afterId) {
            const idx = ast.findIndex((b) => b.id === afterId);
            if (idx !== -1) {
              ast.splice(idx + 1, 0, block);
              return { ast, selectedBlockId: block.id };
            }
          }
          // If no afterId or not found, just append
          return { ast: [...state.ast, block], selectedBlockId: block.id };
        });
      },

      updateBlock: (id, changes) => {
        const updateNested = (blocks: DocBlock[]): DocBlock[] => {
          return blocks.map((b) => {
            if (b.id === id) {
              return { ...b, ...changes } as DocBlock;
            }
            if (b.type === 'header' || b.type === 'footer') {
              return {
                ...b,
                blocks: updateNested(b.blocks),
              } as DocBlock;
            }
            if (b.type === 'columns') {
              return {
                ...b,
                columns: b.columns.map((col) => ({
                  ...col,
                  blocks: updateNested(col.blocks),
                })),
              } as DocBlock;
            }
            return b;
          });
        };

        set((state) => ({
          ast: updateNested(state.ast),
        }));
      },

      removeBlock: (id) => {
        const removeNested = (blocks: DocBlock[]): DocBlock[] => {
          return blocks
            .filter((b) => b.id !== id)
            .map((b) => {
              if (b.type === 'header' || b.type === 'footer') {
                return {
                  ...b,
                  blocks: removeNested(b.blocks),
                } as DocBlock;
              }
              if (b.type === 'columns') {
                return {
                  ...b,
                  columns: b.columns.map((col) => ({
                    ...col,
                    blocks: removeNested(col.blocks),
                  })),
                } as DocBlock;
              }
              return b;
            });
        };

        set((state) => ({
          ast: removeNested(state.ast),
          selectedBlockId:
            state.selectedBlockId === id ? null : state.selectedBlockId,
        }));
      },

      moveBlock: (fromIndex, toIndex) => {
        set((state) => {
          const ast = [...state.ast];
          const [moved] = ast.splice(fromIndex, 1);
          if (moved !== undefined) {
            ast.splice(toIndex, 0, moved);
          }
          return { ast };
        });
      },

      duplicateBlock: (id) => {
        set((state) => {
          const idx = state.ast.findIndex((b) => b.id === id);
          if (idx === -1) return state;
          const original = state.ast[idx];
          if (original === undefined) return state;
          const duplicate: DocBlock = {
            ...original,
            id: `blk_${nanoid(8)}`,
            x: original.x !== undefined ? original.x + 20 : undefined,
            y: original.y !== undefined ? original.y + 20 : undefined,
          };
          const ast = [...state.ast];
          ast.splice(idx + 1, 0, duplicate);
          return { ast, selectedBlockId: duplicate.id };
        });
      },

      selectBlock: (id) => set({ selectedBlockId: id }),

      updateMetadata: (changes) => {
        set((state) => ({
          metadata: { ...state.metadata, ...changes },
        }));
      },

      exportSchema: (): DocFlowSchema => {
        const { ast, metadata } = get();
        let currentPageIdx = 0;
        const resolvedAst = ast.map((block) => {
          if (block.type === 'header' || block.type === 'footer') {
            return block;
          }
          const updatedBlock = { ...block, page: currentPageIdx };
          if (block.type === 'page-break') {
            currentPageIdx++;
          }
          return updatedBlock;
        });

        return {
          $schema: 'https://docflow.dev/schemas/v1.json',
          version: '1.0.0',
          metadata: {
            ...metadata,
            createdAt: new Date().toISOString(),
          },
          ast: resolvedAst,
        };
      },

      importSchema: (schema) => {
        set({
          ast: schema.ast,
          metadata: {
            title: schema.metadata.title,
            pageSize: schema.metadata.pageSize,
            orientation: schema.metadata.orientation,
            margins: schema.metadata.margins,
            author: schema.metadata.author ?? '',
            subject: schema.metadata.subject ?? '',
            keywords: schema.metadata.keywords ?? [],
            customVariables: schema.metadata.customVariables ?? [],
            uploadedJson: schema.metadata.uploadedJson ?? '',
          },
          selectedBlockId: null,
        });
      },
    }),
    {
      // zundo config: only track ast and metadata changes, not selection
      partialize: (state) => ({
        ast: state.ast,
        metadata: state.metadata,
      }),
      limit: 50, // max 50 undo steps
    },
  ),
);

// Expose undo/redo from the temporal store
export const useDocumentHistory = () => useDocumentStore.temporal.getState();
