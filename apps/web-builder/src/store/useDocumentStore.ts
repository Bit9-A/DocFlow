import type { DocBlock, DocBlockType, DocFlowSchema } from "@docflow/core";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { temporal } from "zundo";
import { nanoid } from "nanoid";

// ============================================================
// Block defaults factory
// ============================================================

function createDefaultBlock(type: DocBlockType): DocBlock {
  const id = `blk_${nanoid(8)}`;
  const baseStyles = {};

  switch (type) {
    case "heading":
      return {
        id,
        type: "heading",
        level: 1,
        text: "New Heading",
        styles: { fontSize: 24, color: "#111827", marginBottom: 8 },
      };
    case "paragraph":
      return {
        id,
        type: "paragraph",
        text: "Start typing your paragraph here...",
        styles: {
          fontSize: 11,
          color: "#374151",
          marginBottom: 6,
          lineHeight: 1.6,
        },
      };
    case "table":
      return {
        id,
        type: "table",
        loopOver: "items",
        columns: [
          { header: "Column 1", width: "50%", value: "{{item.col1}}" },
          { header: "Column 2", width: "50%", value: "{{item.col2}}" },
        ],
        styles: {
          headerBg: "#F3F4F6",
          borderColor: "#E5E7EB",
          borderWidth: 1,
          cellPadding: 8,
          fontSize: 11,
        },
      };
    case "image":
      return {
        id,
        type: "image",
        src: "",
        alt: "Image description",
        styles: { width: "100%", marginBottom: 8 },
      };
    case "divider":
      return {
        id,
        type: "divider",
        styles: {
          color: "#E5E7EB",
          thickness: 1,
          marginTop: 8,
          marginBottom: 8,
        },
      };
    case "spacer":
      return { id, type: "spacer", height: 24, styles: baseStyles };
    case "columns":
      return {
        id,
        type: "columns",
        columns: [
          { width: "50%", blocks: [] },
          { width: "50%", blocks: [] },
        ],
        styles: baseStyles,
      };
    case "page-break":
      return { id, type: "page-break", styles: baseStyles };
    case "header":
      return { id, type: "header", blocks: [], styles: baseStyles };
    case "footer":
      return { id, type: "footer", blocks: [], styles: baseStyles };
    case "page-number":
      return {
        id,
        type: "page-number",
        format: "Página {{currentPage}} de {{totalPages}}",
        styles: { fontSize: 9, color: "#6B7280", textAlign: "right" },
      };
    case "signature":
      return {
        id,
        type: "signature",
        label: "Firma Autorizada",
        name: "John Doe",
        title: "Gerente General",
        styles: {
          lineWidth: 1,
          lineColor: "#9CA3AF",
          gap: 8,
          fontSize: 10,
          color: "#374151",
        },
      };
    case "container":
      return {
        id,
        type: "container",
        blocks: [],
        styles: {
          padding: 12,
          borderRadius: 6,
          backgroundColor: "#F9FAFB",
          borderColor: "#E5E7EB",
          borderWidth: 1,
        },
      };
    case "barcode":
      return {
        id,
        type: "barcode",
        format: "qr",
        value: "https://docflow.dev",
        styles: { width: 100, height: 100, color: "#000000" },
      };
    case "list":
      return {
        id,
        type: "list",
        ordered: false,
        items: [
          "Primer elemento de la lista",
          "Segundo elemento de la lista",
          "Tercer elemento de la lista",
        ],
        styles: {
          fontSize: 11,
          color: "#374151",
          bulletStyle: "dot",
          itemSpacing: 4,
          lineHeight: 1.3,
        },
      };
    case "chart":
      return {
        id,
        type: "chart",
        chartType: "bar",
        loopOver: "ventas",
        labelKey: "mes",
        valueKey: "monto",
        styles: {
          width: 350,
          height: 150,
          colors: ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"],
        },
      };
  }
}

interface ContainerInfo {
  type: "root" | "header" | "footer" | "columns" | "container";
  parentBlock?: DocBlock;
  colIdx?: number;
}

function findSelectedContainer(
  blocks: DocBlock[],
  selectedId: string | null,
  parent?: DocBlock,
  colIdx?: number,
): ContainerInfo | null {
  if (!selectedId) return null;

  for (const b of blocks) {
    if (b.id === selectedId) {
      if (parent) {
        if (parent.type === "header")
          return { type: "header", parentBlock: parent };
        if (parent.type === "footer")
          return { type: "footer", parentBlock: parent };
        if (parent.type === "columns")
          return { type: "columns", parentBlock: parent, colIdx };
      }
      // If the selected block itself is a container-type, treat it as the parent
      if (b.type === "header") return { type: "header", parentBlock: b };
      if (b.type === "footer") return { type: "footer", parentBlock: b };
      if (b.type === "container") return { type: "container", parentBlock: b };
      return { type: "root" };
    }

    if (b.type === "header" || b.type === "footer") {
      const res = findSelectedContainer(b.blocks, selectedId, b);
      if (res) return res;
    }

    // Recurse into container blocks
    if (b.type === "container") {
      const res = findSelectedContainer(b.blocks, selectedId, b);
      if (res) return res;
    }

    if (b.type === "columns") {
      for (let i = 0; i < b.columns.length; i++) {
        const res = findSelectedContainer(
          b.columns[i].blocks,
          selectedId,
          b,
          i,
        );
        if (res) return res;
      }
    }
  }

  return null;
}

function getSelectedBlockContainer(
  ast: DocBlock[],
  selectedId: string | null,
): ContainerInfo {
  const res = findSelectedContainer(ast, selectedId);
  return res ?? { type: "root" };
}

// ============================================================
// State & Actions
// ============================================================

export interface DocumentMetadata {
  title: string;
  pageSize: "LETTER" | "A4" | "LEGAL" | "A3";
  orientation: "portrait" | "landscape";
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
  addBlockToColumn: (
    columnsBlockId: string,
    colIdx: number,
    type: DocBlockType,
  ) => void;
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
  persist(
    temporal(
      (set, get) => ({
        ast: [],
        metadata: {
          title: "Untitled Document",
          pageSize: "LETTER",
          orientation: "portrait",
          margins: { top: 40, bottom: 40, left: 50, right: 50 },
          author: "",
          subject: "",
          keywords: [],
          customVariables: [],
          uploadedJson: "",
        },
        selectedBlockId: null,

        addBlockToColumn: (columnsBlockId, colIdx, type) => {
          const block = createDefaultBlock(type);
          const margins = get().metadata.margins;

          if (type === "image") {
            block.width = 150;
            block.height = 100;
          } else if (type === "divider") {
            block.width = 250;
          } else if (type === "spacer") {
            block.width = 100;
            block.height = 24;
          } else if (type === "chart") {
            block.width = 350;
            block.height = 150;
          } else if (type === "barcode") {
            block.width = 100;
            block.height = 100;
          } else if (type === "container") {
            block.width = 350;
            block.height = 150;
          } else if (type === "signature") {
            block.width = 150;
          } else if (type === "page-number") {
            block.width = 150;
          } else {
            block.width = 250;
          }

          block.x = margins.left;
          block.y = 10;
          block.page = 0;

          set((state) => {
            const updateColumnsAst = (blocks: DocBlock[]): DocBlock[] => {
              return blocks.map((b) => {
                if (b.id === columnsBlockId && b.type === "columns") {
                  const newCols = b.columns.map((col, idx) => {
                    if (idx === colIdx) {
                      return {
                        ...col,
                        blocks: [...col.blocks, block],
                      };
                    }
                    return col;
                  });
                  return { ...b, columns: newCols } as DocBlock;
                }
                if (b.type === "header" || b.type === "footer") {
                  return {
                    ...b,
                    blocks: updateColumnsAst(b.blocks),
                  } as DocBlock;
                }
                if (b.type === "container") {
                  return {
                    ...b,
                    blocks: updateColumnsAst(b.blocks),
                  } as DocBlock;
                }
                if (b.type === "columns") {
                  return {
                    ...b,
                    columns: b.columns.map((c) => ({
                      ...c,
                      blocks: updateColumnsAst(c.blocks),
                    })),
                  } as DocBlock;
                }
                return b;
              });
            };
            return {
              ast: updateColumnsAst(state.ast),
              selectedBlockId: block.id,
            };
          });
        },

        addBlock: (type, afterId) => {
          const block = createDefaultBlock(type);
          const margins = get().metadata.margins;

          if (type === "image") {
            block.width = 150;
            block.height = 100;
          } else if (type === "divider") {
            block.width = 250;
          } else if (type === "spacer") {
            block.width = 100;
            block.height = 24;
          } else if (type === "chart") {
            block.width = 350;
            block.height = 150;
          } else if (type === "barcode") {
            block.width = 100;
            block.height = 100;
          } else if (type === "container") {
            block.width = 350;
            block.height = 150;
          } else if (type === "signature") {
            block.width = 150;
          } else if (type === "page-number") {
            block.width = 150;
          } else {
            block.width = 250;
          }

          const selectedId = get().selectedBlockId;
          const container = getSelectedBlockContainer(get().ast, selectedId);

          if (type !== "header" && type !== "footer") {
            if (container.type === "header" && container.parentBlock) {
              block.x = margins.left;
              block.y =
                10 + ((container.parentBlock as any).blocks?.length ?? 0) * 20;
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

            if (container.type === "footer" && container.parentBlock) {
              block.x = margins.left;
              block.y =
                10 + ((container.parentBlock as any).blocks?.length ?? 0) * 20;
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

            if (container.type === "container" && container.parentBlock) {
              block.x = margins.left;
              block.y =
                10 + ((container.parentBlock as any).blocks?.length ?? 0) * 20;
              set((state) => {
                const updateContainerAst = (blocks: DocBlock[]): DocBlock[] => {
                  return blocks.map((b) => {
                    if (
                      b.id === container.parentBlock!.id &&
                      b.type === "container"
                    ) {
                      return {
                        ...b,
                        blocks: [...((b as any).blocks ?? []), block],
                      } as DocBlock;
                    }
                    if (b.type === "header" || b.type === "footer") {
                      return {
                        ...b,
                        blocks: updateContainerAst(b.blocks),
                      } as DocBlock;
                    }
                    if (b.type === "container") {
                      return {
                        ...b,
                        blocks: updateContainerAst(b.blocks),
                      } as DocBlock;
                    }
                    if (b.type === "columns") {
                      return {
                        ...b,
                        columns: b.columns.map((c) => ({
                          ...c,
                          blocks: updateContainerAst(c.blocks),
                        })),
                      } as DocBlock;
                    }
                    return b;
                  });
                };
                return {
                  ast: updateContainerAst(state.ast),
                  selectedBlockId: block.id,
                };
              });
              return;
            }

            if (
              container.type === "columns" &&
              container.parentBlock &&
              container.colIdx !== undefined
            ) {
              set((state) => {
                const updateColumnsAst = (blocks: DocBlock[]): DocBlock[] => {
                  return blocks.map((b) => {
                    if (
                      b.id === container.parentBlock!.id &&
                      b.type === "columns"
                    ) {
                      const newCols = b.columns.map((col, idx) => {
                        if (idx === container.colIdx) {
                          return {
                            ...col,
                            blocks: [...col.blocks, block],
                          };
                        }
                        return col;
                      });
                      return { ...b, columns: newCols } as DocBlock;
                    }
                    if (b.type === "header" || b.type === "footer") {
                      return {
                        ...b,
                        blocks: updateColumnsAst(b.blocks),
                      } as DocBlock;
                    }
                    if (b.type === "container") {
                      return {
                        ...b,
                        blocks: updateColumnsAst(b.blocks),
                      } as DocBlock;
                    }
                    if (b.type === "columns") {
                      return {
                        ...b,
                        columns: b.columns.map((c) => ({
                          ...c,
                          blocks: updateColumnsAst(c.blocks),
                        })),
                      } as DocBlock;
                    }
                    return b;
                  });
                };
                return {
                  ast: updateColumnsAst(state.ast),
                  selectedBlockId: block.id,
                };
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
              if (b.type === "header" || b.type === "footer") {
                return {
                  ...b,
                  blocks: updateNested(b.blocks),
                } as DocBlock;
              }
              if (b.type === "container") {
                return {
                  ...b,
                  blocks: updateNested(b.blocks),
                } as DocBlock;
              }
              if (b.type === "columns") {
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
                if (b.type === "header" || b.type === "footer") {
                  return {
                    ...b,
                    blocks: removeNested(b.blocks),
                  } as DocBlock;
                }
                if (b.type === "container") {
                  return {
                    ...b,
                    blocks: removeNested(b.blocks),
                  } as DocBlock;
                }
                if (b.type === "columns") {
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
          const duplicateInList = (
            blocks: DocBlock[],
            isTopLevel?: boolean,
          ): { list: DocBlock[]; newId: string | null } => {
            const idx = blocks.findIndex((b) => b.id === id);
            if (idx !== -1) {
              const original = blocks[idx]!;
              const dup: DocBlock = {
                ...original,
                id: `blk_${nanoid(8)}`,
                x: original.x !== undefined ? original.x + 20 : undefined,
                y: original.y !== undefined ? original.y + 20 : undefined,
              };
              const result = [...blocks];
              result.splice(idx + 1, 0, dup);
              return { list: result, newId: dup.id };
            }

            let nestedNewId: string | null = null;
            const result = blocks.map((b) => {
              if (nestedNewId) return b;
              if (b.type === "header" || b.type === "footer") {
                const nested = duplicateInList(b.blocks);
                if (nested.newId) {
                  nestedNewId = nested.newId;
                  return { ...b, blocks: nested.list } as DocBlock;
                }
              }
              if (b.type === "container") {
                const nested = duplicateInList(b.blocks);
                if (nested.newId) {
                  nestedNewId = nested.newId;
                  return { ...b, blocks: nested.list } as DocBlock;
                }
              }
              if (b.type === "columns") {
                const cols = b.columns.map((col) => {
                  if (nestedNewId) return col;
                  const nested = duplicateInList(col.blocks);
                  if (nested.newId) {
                    nestedNewId = nested.newId;
                    return { ...col, blocks: nested.list };
                  }
                  return col;
                });
                if (nestedNewId) {
                  return { ...b, columns: cols } as DocBlock;
                }
              }
              return b;
            });

            return { list: result, newId: nestedNewId };
          };

          set((state) => {
            const { list, newId } = duplicateInList(state.ast, true);
            if (!newId) return state;
            return { ast: list, selectedBlockId: newId };
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
            if (block.type === "header" || block.type === "footer") {
              return block;
            }
            const updatedBlock = { ...block, page: currentPageIdx };
            if (block.type === "page-break") {
              currentPageIdx++;
            }
            return updatedBlock;
          });

          return {
            $schema: "https://docflow.dev/schemas/v1.json",
            version: "1.0.0",
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
              author: schema.metadata.author ?? "",
              subject: schema.metadata.subject ?? "",
              keywords: schema.metadata.keywords ?? [],
              customVariables: schema.metadata.customVariables ?? [],
              uploadedJson: schema.metadata.uploadedJson ?? "",
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
    {
      name: "docflow-document-store",
      partialize: (state) => ({
        ast: state.ast,
        metadata: state.metadata,
      }),
    },
  ),
);

// Expose undo/redo from the temporal store
export const useDocumentHistory = () => useDocumentStore.temporal.getState();
