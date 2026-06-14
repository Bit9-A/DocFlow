'use client';

import React, { useState, useEffect } from 'react';
import type { DocBlock, TextStyles, TableColumn } from '@docflow/core';
import {
  Settings2,
  Copy,
  Check,
  Plus,
  Trash2,
  Columns,
  Table,
  Heading,
  Type,
  Image as ImageIcon,
  FileText,
  Layout,
  X,
} from 'lucide-react';
import { useDocumentStore } from '@/store/useDocumentStore';
import { Database, FileUp, Globe } from 'lucide-react';
import { AutocompleteInput, AutocompleteTextarea, flattenJsonKeys } from '../ui/Autocomplete';
import { useUIStore } from '@/store/useUIStore';

// ============================================================
// Main Inspector component
// ============================================================

export function StyleInspector() {
  const selectedBlockId = useDocumentStore((s) => s.selectedBlockId);
  const ast = useDocumentStore((s) => s.ast);
  const updateBlock = useDocumentStore((s) => s.updateBlock);
  const removeBlock = useDocumentStore((s) => s.removeBlock);
  const addBlock = useDocumentStore((s) => s.addBlock);
  const selectBlock = useDocumentStore((s) => s.selectBlock);
  const metadata = useDocumentStore((s) => s.metadata);
  const updateMetadata = useDocumentStore((s) => s.updateMetadata);

  const breakpoint = useUIStore((s) => s.breakpoint);
  const isMobile = breakpoint === 'mobile';
  const isTablet = breakpoint === 'tablet';

  const [activeSettingsTab, setActiveSettingsTab] = useState<'page' | 'project' | 'variables'>('page');

  const findNestedBlock = (blocks: DocBlock[], id: string): DocBlock | null => {
    for (const b of blocks) {
      if (b.id === id) return b;
      if (b.type === 'header' || b.type === 'footer') {
        const found = findNestedBlock(b.blocks, id);
        if (found) return found;
      }
      if (b.type === 'columns') {
        for (const col of b.columns) {
          const found = findNestedBlock(col.blocks, id);
          if (found) return found;
        }
      }
    }
    return null;
  };

  const block = selectedBlockId !== null
    ? findNestedBlock(ast, selectedBlockId)
    : null;

  if (block === null) {
    return (
      <aside
        className="w-full lg:w-64 bg-[#111122] lg:border-l border-white/10 flex flex-col h-full"
        aria-label="Style inspector — page settings"
      >
        <SidebarTabs
          activeTab={activeSettingsTab}
          setActiveTab={setActiveSettingsTab}
        />
        <div className="flex-1 overflow-y-auto">
          {activeSettingsTab === 'page' ? (
            <PageSettingsPanel
              metadata={metadata}
              updateMetadata={updateMetadata}
              ast={ast}
              addBlock={addBlock}
              removeBlock={removeBlock}
              selectBlock={selectBlock}
              isMobile={isMobile}
              isTablet={isTablet}
            />
          ) : activeSettingsTab === 'project' ? (
            <ProjectSettingsPanel
              metadata={metadata}
              updateMetadata={updateMetadata}
              isMobile={isMobile}
            />
          ) : (
            <VariablesSettingsPanel
              metadata={metadata}
              updateMetadata={updateMetadata}
              isMobile={isMobile}
            />
          )}
        </div>
      </aside>
    );
  }

  function updateStyles(styles: Partial<TextStyles>) {
    if (selectedBlockId === null) return;
    updateBlock(selectedBlockId, { styles: { ...block!.styles, ...styles } } as Partial<DocBlock>);
  }

  return (
    <aside
      className="w-full lg:w-64 bg-[#111122] lg:border-l border-white/10 flex flex-col h-full"
      aria-label="Style inspector"
    >
      <InspectorHeader label={`${block.type} properties`} />

      <div className={`flex-1 overflow-y-auto ${isMobile ? 'p-2 space-y-4' : 'p-3 space-y-5'}`}>
        {/* Block metadata */}
        <div>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            {block.type}
          </span>
          <p className="text-[9px] text-white/30 mt-1 font-mono">ID: {block.id}</p>
        </div>

        {/* Layout & Position */}
        {block.type !== 'header' && block.type !== 'footer' && (
          <InspectorSection label="Layout & Position">
            <div className="grid grid-cols-2 gap-2">
              <NumberInput
                label="Position X (pt)"
                value={block.x ?? 0}
                min={0}
                max={1500}
                isMobile={isMobile}
                onChange={(v) => updateBlock(block.id, { x: v } as Partial<DocBlock>)}
              />
              <NumberInput
                label="Position Y (pt)"
                value={block.y ?? 0}
                min={0}
                max={2500}
                isMobile={isMobile}
                onChange={(v) => updateBlock(block.id, { y: v } as Partial<DocBlock>)}
              />
              <NumberInput
                label="Width (pt)"
                value={block.width ?? 0}
                min={0}
                max={1500}
                isMobile={isMobile}
                onChange={(v) => updateBlock(block.id, { width: v } as Partial<DocBlock>)}
              />
              <NumberInput
                label="Height (pt)"
                value={block.height ?? 0}
                min={0}
                max={1500}
                isMobile={isMobile}
                onChange={(v) => updateBlock(block.id, { height: v } as Partial<DocBlock>)}
              />
              <div className="col-span-2 pt-2 border-t border-white/5">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-white/70">
                  <input
                    type="checkbox"
                    checked={block.ignoreMargins ?? false}
                    onChange={(e) =>
                      updateBlock(block.id, { ignoreMargins: e.target.checked } as Partial<DocBlock>)
                    }
                    className="rounded border-white/10 bg-white/5 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                  <span>Ignorar márgenes (Límite de página)</span>
                </label>
              </div>
            </div>
          </InspectorSection>
        )}

        {/* Block specific panels */}
        {block.type === 'heading' && (
          <InspectorSection label="Heading Level">
            <div className="flex gap-1">
              {([1, 2, 3, 4, 5, 6] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => updateBlock(block.id, { level } as Partial<DocBlock>)}
                  className={`
                    w-7 h-7 text-xs rounded font-semibold transition-all
                    ${block.level === level
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                      : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'}
                  `}
                  aria-label={`Heading level ${level}`}
                  aria-pressed={block.level === level}
                >
                  H{level}
                </button>
              ))}
            </div>
          </InspectorSection>
        )}

        {(block.type === 'heading' || block.type === 'paragraph') && (
          <InspectorSection label="Content Text">
            <AutocompleteTextarea
              value={block.text ?? ''}
              onValueChange={(v) => updateBlock(block.id, { text: v } as Partial<DocBlock>)}
              className={`w-full bg-[#0d0d1e] text-white/70 rounded border border-white/10 focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[80px] ${isMobile ? 'text-sm px-3 py-2.5' : 'text-xs px-2 py-1.5'}`}
              placeholder="Text template (e.g. {{0.promedio}})..."
              aria-label="Block text content template"
            />
          </InspectorSection>
        )}

        {/* Typography */}
        {'styles' in block && ('fontSize' in (block.styles as object) || block.type === 'heading' || block.type === 'paragraph') ? (
          <>
            <InspectorSection label="Typography">
              <div className="space-y-3">
                <NumberInput
                  label="Font size (pt)"
                  value={(block.styles as TextStyles).fontSize ?? 11}
                  min={6}
                  max={144}
                  isMobile={isMobile}
                  onChange={(v) => updateStyles({ fontSize: v })}
                />
                <NumberInput
                  label="Line height"
                  value={(block.styles as TextStyles).lineHeight ?? 1.5}
                  min={0.5}
                  max={4}
                  step={0.1}
                  isMobile={isMobile}
                  onChange={(v) => updateStyles({ lineHeight: v })}
                />
              </div>
            </InspectorSection>

            <InspectorSection label="Text Align">
              <div className="flex gap-1">
                {(['left', 'center', 'right', 'justify'] as const).map((align) => (
                  <button
                    key={align}
                    onClick={() => updateStyles({ textAlign: align })}
                    className={`
                      flex-1 py-1 text-[10px] rounded capitalize transition-all
                      ${(block.styles as TextStyles).textAlign === align
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                        : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'}
                    `}
                    aria-label={`Align ${align}`}
                    aria-pressed={(block.styles as TextStyles).textAlign === align}
                  >
                    {align[0]?.toUpperCase()}
                  </button>
                ))}
              </div>
            </InspectorSection>

            <InspectorSection label="Color">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={(block.styles as TextStyles).color ?? '#111827'}
                  onChange={(e) => updateStyles({ color: e.target.value })}
                  className={`rounded cursor-pointer border-0 bg-transparent flex-shrink-0 ${isMobile ? 'w-10 h-10' : 'w-8 h-8'}`}
                  aria-label="Text color"
                />
                <input
                  type="text"
                  value={(block.styles as TextStyles).color ?? '#111827'}
                  onChange={(e) => updateStyles({ color: e.target.value })}
                  className={`flex-1 bg-white/5 text-white/70 rounded border border-white/10 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-center ${isMobile ? 'text-sm px-3 py-2.5' : 'text-xs px-2 py-1.5'}`}
                  aria-label="Text color hex value"
                />
              </div>
              {(() => {
                const hexColor = (block.styles as TextStyles).color ?? '#111827';
                const ratio = getContrastRatio(hexColor);
                const isHeading = block.type === 'heading';
                const passAA = isHeading ? ratio >= 3 : ratio >= 4.5;
                const passAAA = isHeading ? ratio >= 4.5 : ratio >= 7;

                let contrastStatus = 'Fail';
                let statusColorClass = 'text-red-400 bg-red-500/10 border-red-500/20';
                if (passAAA) {
                  contrastStatus = 'AAA Pass';
                  statusColorClass = 'text-green-400 bg-green-500/10 border-green-500/20';
                } else if (passAA) {
                  contrastStatus = 'AA Pass';
                  statusColorClass = 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20';
                }

                return (
                  <div className="flex items-center justify-between mt-2 px-1 text-[9px]">
                    <span className="text-white/40">Contrast (on white):</span>
                    <span className={`px-1.5 py-0.5 rounded border font-medium ${statusColorClass}`}>
                      {ratio.toFixed(1)}:1 — {contrastStatus}
                    </span>
                  </div>
                );
              })()}
            </InspectorSection>
          </>
        ) : null}

        {/* Dynamic Context Panels */}
        {block.type === 'table' && (
          <TablePropertiesPanel block={block} updateBlock={updateBlock} isMobile={isMobile} />
        )}

        {block.type === 'columns' && (
          <ColumnsPropertiesPanel block={block} updateBlock={updateBlock} isMobile={isMobile} />
        )}

        {(block.type === 'header' || block.type === 'footer') && (
          <HeaderFooterPropertiesPanel block={block} updateBlock={updateBlock} isMobile={isMobile} />
        )}

        {block.type === 'page-number' && (
          <PageNumberPropertiesPanel block={block} updateBlock={updateBlock} isMobile={isMobile} />
        )}

        {block.type === 'signature' && (
          <SignaturePropertiesPanel block={block} updateBlock={updateBlock} isMobile={isMobile} />
        )}

        {block.type === 'container' && (
          <ContainerPropertiesPanel block={block} updateBlock={updateBlock} isMobile={isMobile} />
        )}

        {block.type === 'barcode' && (
          <BarcodePropertiesPanel block={block} updateBlock={updateBlock} isMobile={isMobile} />
        )}

        {block.type === 'list' && (
          <ListPropertiesPanel block={block} updateBlock={updateBlock} isMobile={isMobile} />
        )}

        {block.type === 'chart' && (
          <ChartPropertiesPanel block={block} updateBlock={updateBlock} isMobile={isMobile} />
        )}

        {/* Spacing */}
        <InspectorSection label="Spacing">
          <NumberInput
            label="Margin top"
            value={block.styles.marginTop ?? 0}
            min={0}
            max={200}
            isMobile={isMobile}
            onChange={(v) => updateStyles({ marginTop: v })}
          />
          <NumberInput
            label="Margin bottom"
            value={block.styles.marginBottom ?? 0}
            min={0}
            max={200}
            isMobile={isMobile}
            onChange={(v) => updateStyles({ marginBottom: v })}
          />
        </InspectorSection>

        {/* Spacer height */}
        {block.type === 'spacer' && (
          <InspectorSection label="Spacer Height">
            <NumberInput
              label="Height (pt)"
              value={block.height}
              min={1}
              max={500}
              isMobile={isMobile}
              onChange={(v) => updateBlock(block.id, { height: v } as Partial<DocBlock>)}
            />
          </InspectorSection>
        )}

        {/* Image src */}
        {block.type === 'image' && (
          <InspectorSection label="Image Source">
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-white/40 block mb-1">URL</label>
                  <input
                    type="text"
                    value={block.src}
                    onChange={(e) =>
                      updateBlock(block.id, { src: e.target.value } as Partial<DocBlock>)
                    }
                    placeholder="https://..."
                    className={`w-full bg-white/5 text-white/70 rounded border border-white/10 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono ${isMobile ? 'text-sm px-3 py-2.5' : 'text-xs px-2 py-1.5'}`}
                    aria-label="Image source URL"
                  />
              </div>
              <div>
                <label className="text-[10px] text-white/40 block mb-1">Alt text</label>
                  <input
                    type="text"
                    value={block.alt}
                    onChange={(e) =>
                      updateBlock(block.id, { alt: e.target.value } as Partial<DocBlock>)
                    }
                    placeholder="Describe the image..."
                    className={`w-full bg-white/5 text-white/70 rounded border border-white/10 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${isMobile ? 'text-sm px-3 py-2.5' : 'text-xs px-2 py-1.5'}`}
                    aria-label="Image alt text"
                  />
              </div>
            </div>
          </InspectorSection>
        )}
      </div>
    </aside>
  );
}

// ============================================================
// PageSettingsPanel (Empty Selection Panel)
// ============================================================

interface PageSettingsPanelProps {
  metadata: any;
  updateMetadata: (changes: any) => void;
  ast: DocBlock[];
  addBlock: (type: any) => void;
  removeBlock: (id: string) => void;
  selectBlock: (id: string | null) => void;
  isMobile: boolean;
  isTablet: boolean;
}

function PageSettingsPanel({
  metadata,
  updateMetadata,
  ast,
  addBlock,
  removeBlock,
  selectBlock,
  isMobile,
  isTablet,
}: PageSettingsPanelProps) {
  const headerBlock = ast.find((b) => b.type === 'header');
  const footerBlock = ast.find((b) => b.type === 'footer');

  return (
    <div className={`${isMobile ? 'p-2 space-y-4' : 'p-3 space-y-6'}`}>
      {/* Title */}
      <InspectorSection label="Document Title">
        <input
          type="text"
          value={metadata.title}
          onChange={(e) => updateMetadata({ title: e.target.value })}
          className={`w-full bg-white/5 text-white/70 rounded border border-white/10 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold ${isMobile ? 'text-sm px-3 py-2.5' : 'text-xs px-2 py-1.5'}`}
          aria-label="Document title"
        />
      </InspectorSection>

      {/* Page Size & Orientation */}
      <InspectorSection label="Page Layout">
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-white/40 block mb-1">Size</label>
            <select
              value={metadata.pageSize}
              onChange={(e) => updateMetadata({ pageSize: e.target.value })}
              className={`w-full bg-[#1e1e38] text-white/70 rounded border border-white/10 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer ${isMobile ? 'text-sm px-3 py-2.5' : 'text-xs px-2 py-1.5'}`}
              aria-label="Page size"
            >
              <option value="LETTER">LETTER (Carta)</option>
              <option value="A4">A4 (Estándar)</option>
              <option value="LEGAL">LEGAL (Oficio)</option>
              <option value="A3">A3 (Póster/Plano)</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-white/40 block mb-1">Orientation</label>
            <select
              value={metadata.orientation}
              onChange={(e) => updateMetadata({ orientation: e.target.value })}
              className={`w-full bg-[#1e1e38] text-white/70 rounded border border-white/10 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer ${isMobile ? 'text-sm px-3 py-2.5' : 'text-xs px-2 py-1.5'}`}
              aria-label="Orientation"
            >
              <option value="portrait">Portrait (Vertical)</option>
              <option value="landscape">Landscape (Horizontal)</option>
            </select>
          </div>
        </div>
      </InspectorSection>

      {/* Margins */}
      <InspectorSection label="Page Margins (pt)">
        <div className={`grid ${isMobile ? 'grid-cols-2' : 'grid-cols-2'} gap-2`}>
          <NumberInput
            label="Top"
            value={metadata.margins.top}
            min={0}
            max={200}
            isMobile={isMobile}
            onChange={(v) =>
              updateMetadata({ margins: { ...metadata.margins, top: v } })
            }
          />
          <NumberInput
            label="Bottom"
            value={metadata.margins.bottom}
            min={0}
            max={200}
            isMobile={isMobile}
            onChange={(v) =>
              updateMetadata({ margins: { ...metadata.margins, bottom: v } })
            }
          />
          <NumberInput
            label="Left"
            value={metadata.margins.left}
            min={0}
            max={200}
            isMobile={isMobile}
            onChange={(v) =>
              updateMetadata({ margins: { ...metadata.margins, left: v } })
            }
          />
          <NumberInput
            label="Right"
            value={metadata.margins.right}
            min={0}
            max={200}
            isMobile={isMobile}
            onChange={(v) =>
              updateMetadata({ margins: { ...metadata.margins, right: v } })
            }
          />
        </div>
      </InspectorSection>

      {/* Global repeating headers/footers */}
      <InspectorSection label="Headers & Footers">
        <div className="space-y-3">
          {/* Header */}
          <div className="p-2.5 rounded bg-white/5 border border-white/5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white/60">Header Block</span>
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                  headerBlock ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                }`}
              >
                {headerBlock ? 'Active' : 'Missing'}
              </span>
            </div>
            {headerBlock ? (
              <div className="flex gap-2.5 mt-1">
                <button
                  onClick={() => selectBlock(headerBlock.id)}
                  className="flex-1 py-1 px-2 text-[10px] bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600/50 rounded transition-all font-semibold"
                >
                  Edit Header
                </button>
                <button
                  onClick={() => removeBlock(headerBlock.id)}
                  className="p-1 bg-red-600/20 text-red-400 hover:bg-red-600/40 rounded transition-all"
                  aria-label="Remove header"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => addBlock('header')}
                className="w-full py-1.5 mt-1 text-[10px] bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded transition-all font-semibold flex items-center justify-center gap-1"
              >
                <Plus size={12} /> Create Header
              </button>
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 rounded bg-white/5 border border-white/5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white/60">Footer Block</span>
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                  footerBlock ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                }`}
              >
                {footerBlock ? 'Active' : 'Missing'}
              </span>
            </div>
            {footerBlock ? (
              <div className="flex gap-2.5 mt-1">
                <button
                  onClick={() => selectBlock(footerBlock.id)}
                  className="flex-1 py-1 px-2 text-[10px] bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600/50 rounded transition-all font-semibold"
                >
                  Edit Footer
                </button>
                <button
                  onClick={() => removeBlock(footerBlock.id)}
                  className="p-1 bg-red-600/20 text-red-400 hover:bg-red-600/40 rounded transition-all"
                  aria-label="Remove footer"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => addBlock('footer')}
                className="w-full py-1.5 mt-1 text-[10px] bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded transition-all font-semibold flex items-center justify-center gap-1"
              >
                <Plus size={12} /> Create Footer
              </button>
            )}
          </div>
        </div>
      </InspectorSection>

      {/* System Variables List */}
      <SystemVariablesSection />
    </div>
  );
}

// ============================================================
// Table properties panel
// ============================================================

interface TablePropertiesPanelProps {
  block: Extract<DocBlock, { type: 'table' }>;
  updateBlock: (id: string, changes: Partial<DocBlock>) => void;
  isMobile: boolean;
}

function TablePropertiesPanel({ block, updateBlock, isMobile }: TablePropertiesPanelProps) {
  const [newColHeader, setNewColHeader] = useState('');
  const [newColValue, setNewColValue] = useState('');
  const metadata = useDocumentStore((s) => s.metadata);

  function updateTableStyles(styles: Partial<typeof block.styles>) {
    updateBlock(block.id, { styles: { ...block.styles, ...styles } });
  }

  function handleAutoGenerate() {
    if (!metadata.uploadedJson) return;
    try {
      const parsed = JSON.parse(metadata.uploadedJson);
      let items: any = null;
      if (Array.isArray(parsed)) {
        items = parsed;
      } else if (typeof parsed === 'object' && parsed !== null) {
        const resolvePath = (path: string, obj: any): any => {
          if (!path) return obj;
          const segments = path.trim().split('.');
          let curr = obj;
          for (const s of segments) {
            if (curr && typeof curr === 'object' && s in curr) {
              curr = curr[s];
            } else {
              return null;
            }
          }
          return curr;
        };
        items = resolvePath(block.loopOver, parsed);
      }

      if (Array.isArray(items) && items.length > 0) {
        const firstEl = items[0];
        if (firstEl && typeof firstEl === 'object') {
          const keys = Object.keys(firstEl);
          if (keys.length > 0) {
            const widthPct = Math.floor(100 / keys.length);
            const columns = keys.map((key) => ({
              header: key.charAt(0).toUpperCase() + key.slice(1),
              value: `{{item.${key}}}`,
              width: `${widthPct}%`,
              align: 'left' as const,
            }));
            updateBlock(block.id, { columns });
          }
        }
      }
    } catch (e) {
      console.error('Failed to auto-generate columns:', e);
    }
  }

  function handleAddColumn() {
    if (!newColHeader || !newColValue) return;
    const newCol: TableColumn = {
      header: newColHeader,
      value: newColValue,
      width: '20%',
      align: 'left',
    };
    updateBlock(block.id, { columns: [...block.columns, newCol] });
    setNewColHeader('');
    setNewColValue('');
  }

  function handleRemoveColumn(idx: number) {
    const columns = block.columns.filter((_, i) => i !== idx);
    updateBlock(block.id, { columns });
  }

  function handleColChange(idx: number, changes: Partial<TableColumn>) {
    const columns = block.columns.map((col, i) =>
      i === idx ? { ...col, ...changes } : col,
    );
    updateBlock(block.id, { columns });
  }

  return (
    <>
      <InspectorSection label="Table Data Binding">
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-white/40 block mb-1">Loop Array (API Path)</label>
            <AutocompleteInput
              type="text"
              value={block.loopOver}
              onValueChange={(val) => updateBlock(block.id, { loopOver: val })}
              className={`w-full bg-white/5 text-white/70 rounded border border-white/10 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono ${isMobile ? 'text-sm px-3 py-2.5' : 'text-xs px-2 py-1.5'}`}
              placeholder="factura.items"
              aria-label="Table loop array path"
            />
          </div>
          <div>
            <NumberInput
              label="Row Limit (0 = unlimited)"
              value={block.limit ?? 0}
              min={0}
              max={1000}
              isMobile={isMobile}
              onChange={(v) => updateBlock(block.id, { limit: v === 0 ? undefined : v })}
            />
          </div>
          {metadata.uploadedJson && (
            <div>
              <button
                type="button"
                onClick={handleAutoGenerate}
                className="w-full py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 rounded text-[10px] font-semibold transition-all mt-1"
              >
                Auto-generate Columns from Data
              </button>
            </div>
          )}
        </div>
      </InspectorSection>

      <InspectorSection label="Table Styles">
        <div className="space-y-3">
          <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2'} gap-2`}>
            <NumberInput
              label="Font Size (pt)"
              value={block.styles.fontSize ?? 10}
              min={6}
              max={30}
              isMobile={isMobile}
              onChange={(v) => updateTableStyles({ fontSize: v })}
            />
            <NumberInput
              label="Cell Padding"
              value={block.styles.cellPadding ?? 6}
              min={0}
              max={30}
              isMobile={isMobile}
              onChange={(v) => updateTableStyles({ cellPadding: v })}
            />
          </div>

          <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2'} gap-2`}>
            <NumberInput
              label="Border (pt)"
              value={block.styles.borderWidth ?? 0.5}
              min={0}
              max={10}
              step={0.5}
              isMobile={isMobile}
              onChange={(v) => updateTableStyles({ borderWidth: v })}
            />
            <div className="flex flex-col justify-end">
              <label className="text-[10px] text-white/40 block mb-1">Border Color</label>
              <input
                type="color"
                value={block.styles.borderColor ?? '#E5E7EB'}
                onChange={(e) => updateTableStyles({ borderColor: e.target.value })}
                className="w-full h-8 rounded cursor-pointer border-0 bg-transparent"
                aria-label="Border color"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-white/40 block mb-1">Header Bg</label>
              <input
                type="color"
                value={block.styles.headerBg ?? '#F9FAFB'}
                onChange={(e) => updateTableStyles({ headerBg: e.target.value })}
                className="w-full h-8 rounded cursor-pointer border-0 bg-transparent"
                aria-label="Header background color"
              />
            </div>
            <div>
              <label className="text-[10px] text-white/40 block mb-1">Header Text</label>
              <input
                type="color"
                value={block.styles.headerColor ?? '#111827'}
                onChange={(e) => updateTableStyles({ headerColor: e.target.value })}
                className="w-full h-8 rounded cursor-pointer border-0 bg-transparent"
                aria-label="Header text color"
              />
            </div>
          </div>

          {/* Striped Row toggle */}
          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-white/70">
              <input
                type="checkbox"
                checked={block.styles.stripedRows ?? false}
                onChange={(e) => updateTableStyles({ stripedRows: e.target.checked })}
                className="rounded border-white/10 bg-white/5 text-indigo-600 focus:ring-0"
              />
              <span>Zebra Striping</span>
            </label>
            {block.styles.stripedRows && (
              <div className="mt-2 pl-6 flex items-center gap-2">
                <span className="text-[10px] text-white/40">Color:</span>
                <input
                  type="color"
                  value={block.styles.stripedColor ?? '#F3F4F6'}
                  onChange={(e) => updateTableStyles({ stripedColor: e.target.value })}
                  className="w-8 h-6 rounded cursor-pointer border-0 bg-transparent"
                  aria-label="Zebra striping color"
                />
              </div>
            )}
          </div>
        </div>
      </InspectorSection>

      <InspectorSection label="Table Columns">
        <div className="space-y-4">
          {block.columns.map((col, idx) => (
            <div key={idx} className="p-2 bg-white/5 rounded border border-white/5 relative group">
              <button
                onClick={() => handleRemoveColumn(idx)}
                className="absolute right-1 top-1 text-white/30 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                aria-label="Delete column"
              >
                <Trash2 size={12} />
              </button>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="text-[9px] text-white/40 block">Header</label>
                    <input
                      type="text"
                      value={col.header}
                      onChange={(e) => handleColChange(idx, { header: e.target.value })}
                      className="w-full bg-white/5 text-white/70 text-[10px] px-1 py-0.5 rounded border border-white/10 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-white/40 block">Width %</label>
                    <input
                      type="text"
                      value={col.width}
                      onChange={(e) => handleColChange(idx, { width: e.target.value })}
                      className="w-full bg-white/5 text-white/70 text-[10px] px-1 py-0.5 rounded border border-white/10 focus:outline-none font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[9px] text-white/40 block">Value Template</label>
                  <AutocompleteInput
                    type="text"
                    value={col.value}
                    onValueChange={(val) => handleColChange(idx, { value: val })}
                    className="w-full bg-white/5 text-white/70 text-[10px] px-1 py-0.5 rounded border border-white/10 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-white/40 block">Align</label>
                  <select
                    value={col.align ?? 'left'}
                    onChange={(e) => handleColChange(idx, { align: e.target.value as any })}
                    className="w-full bg-[#1e1e38] text-white/70 text-[10px] px-1 py-0.5 rounded border border-white/10 focus:outline-none cursor-pointer"
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </div>
              </div>
            </div>
          ))}

          {/* Add column form */}
          <div className="p-2 bg-indigo-500/5 border border-indigo-500/10 rounded space-y-2">
            <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Add Column</h4>
            <div className="grid grid-cols-2 gap-1.5">
              <input
                type="text"
                placeholder="Header (e.g. Price)"
                value={newColHeader}
                onChange={(e) => setNewColHeader(e.target.value)}
                className="w-full bg-white/5 text-white/70 text-[10px] px-1.5 py-1 rounded border border-white/10 focus:outline-none"
              />
              <AutocompleteInput
                type="text"
                placeholder="Value (e.g. {{item.price}})"
                value={newColValue}
                onValueChange={(val) => setNewColValue(val)}
                className="w-full bg-white/5 text-white/70 text-[10px] px-1.5 py-1 rounded border border-white/10 focus:outline-none font-mono"
              />
            </div>
            <button
              onClick={handleAddColumn}
              className="w-full py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] font-semibold transition-all flex items-center justify-center gap-1"
            >
              <Plus size={12} /> Add Column
            </button>
          </div>
        </div>
      </InspectorSection>
    </>
  );
}

// ============================================================
// Columns properties panel
// ============================================================

interface ColumnsPropertiesPanelProps {
  block: Extract<DocBlock, { type: 'columns' }>;
  updateBlock: (id: string, changes: Partial<DocBlock>) => void;
  isMobile: boolean;
}

function ColumnsPropertiesPanel({ block, updateBlock, isMobile }: ColumnsPropertiesPanelProps) {
  function handleWidthChange(idx: number, widthStr: string) {
    const updatedCols = block.columns.map((col, i) =>
      i === idx ? { ...col, width: widthStr } : col,
    );
    updateBlock(block.id, { columns: updatedCols });
  }

  function handleGapChange(gapVal: number) {
    updateBlock(block.id, { styles: { ...block.styles, gap: gapVal } as any });
  }

  return (
    <>
      <InspectorSection label="Column Gaps">
        <NumberInput
          label="Column Spacing (pt)"
          value={(block.styles as any).gap ?? 10}
          min={0}
          max={100}
          isMobile={isMobile}
          onChange={handleGapChange}
        />
      </InspectorSection>

      <InspectorSection label="Column Widths">
        <div className="space-y-3">
          {block.columns.map((col, idx) => (
            <div key={idx} className="flex items-center justify-between gap-3 bg-white/5 p-2 rounded">
              <span className="text-[10px] font-semibold text-white/40">Col {idx + 1}</span>
              <input
                type="text"
                value={col.width}
                onChange={(e) => handleWidthChange(idx, e.target.value)}
                className="w-20 bg-white/5 text-white/70 text-xs px-2 py-1 rounded border border-white/10 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-center"
                aria-label={`Column ${idx + 1} percentage width`}
              />
            </div>
          ))}
        </div>
      </InspectorSection>
    </>
  );
}

// ============================================================
// Header & Footer properties panel
// ============================================================

interface HeaderFooterPropertiesPanelProps {
  block: Extract<DocBlock, { type: 'header' | 'footer' }>;
  updateBlock: (id: string, changes: Partial<DocBlock>) => void;
  isMobile: boolean;
}

function HeaderFooterPropertiesPanel({ block, updateBlock, isMobile }: HeaderFooterPropertiesPanelProps) {
  const metadata = useDocumentStore((s) => s.metadata);
  const [newSubText, setNewSubText] = useState('');
  const [newSubAlign, setNewSubAlign] = useState<'left' | 'center' | 'right'>('center');

  function handleAddTextSubBlock() {
    const newChild: DocBlock = {
      id: `sub_${Date.now()}`,
      type: 'paragraph',
      text: newSubText || 'Header text item',
      x: metadata.margins.left,
      y: 10,
      width: 180,
      height: 15,
      styles: {
        fontSize: 9,
        color: '#6B7280',
        textAlign: newSubAlign,
      },
    };
    updateBlock(block.id, { blocks: [...block.blocks, newChild] });
    setNewSubText('');
  }

  function handleAddImageSubBlock() {
    const newChild: DocBlock = {
      id: `sub_${Date.now()}`,
      type: 'image',
      src: '',
      alt: 'Logo',
      x: metadata.margins.left,
      y: 5,
      width: 60,
      height: 30,
      styles: {
        width: '100%',
      },
    };
    updateBlock(block.id, { blocks: [...block.blocks, newChild] });
  }

  function handleRemoveSubBlock(idx: number) {
    const updated = block.blocks.filter((_, i) => i !== idx);
    updateBlock(block.id, { blocks: updated });
  }

  function handleSubBlockChange(idx: number, text: string) {
    const updated = block.blocks.map((child, i) =>
      i === idx ? { ...child, text } as DocBlock : child,
    );
    updateBlock(block.id, { blocks: updated });
  }

  const updateStyles = (changes: Partial<typeof block.styles>) => {
    updateBlock(block.id, { styles: { ...block.styles, ...changes } } as Partial<DocBlock>);
  };

  return (
    <>
      <InspectorSection label="Container Styling">
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-white/40 block mb-1">Background Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={block.styles?.backgroundColor ?? '#ffffff'}
                onChange={(e) => updateStyles({ backgroundColor: e.target.value })}
                className={`rounded cursor-pointer border-0 bg-transparent flex-shrink-0 ${isMobile ? 'w-10 h-10' : 'w-8 h-8'}`}
                aria-label="Background color picker"
              />
              <input
                type="text"
                value={block.styles?.backgroundColor ?? ''}
                onChange={(e) => updateStyles({ backgroundColor: e.target.value })}
                placeholder="#FFFFFF or transparent"
                className={`flex-1 bg-white/5 text-white/70 rounded border border-white/10 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-center ${isMobile ? 'text-sm px-3 py-2.5' : 'text-xs px-2 py-1.5'}`}
                aria-label="Background color hex value"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-white/40 block mb-1">Text Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={block.styles?.color ?? '#111827'}
                onChange={(e) => updateStyles({ color: e.target.value })}
                className={`rounded cursor-pointer border-0 bg-transparent flex-shrink-0 ${isMobile ? 'w-10 h-10' : 'w-8 h-8'}`}
                aria-label="Text color picker"
              />
              <input
                type="text"
                value={block.styles?.color ?? ''}
                onChange={(e) => updateStyles({ color: e.target.value })}
                placeholder="#111827"
                className={`flex-1 bg-white/5 text-white/70 rounded border border-white/10 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-center ${isMobile ? 'text-sm px-3 py-2.5' : 'text-xs px-2 py-1.5'}`}
                aria-label="Text color hex value"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-white/40 block mb-1">Border Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={block.styles?.borderColor ?? '#e5e7eb'}
                onChange={(e) => updateStyles({ borderColor: e.target.value })}
                className={`rounded cursor-pointer border-0 bg-transparent flex-shrink-0 ${isMobile ? 'w-10 h-10' : 'w-8 h-8'}`}
                aria-label="Border color picker"
              />
              <input
                type="text"
                value={block.styles?.borderColor ?? ''}
                onChange={(e) => updateStyles({ borderColor: e.target.value })}
                placeholder="#E5E7EB"
                className={`flex-1 bg-white/5 text-white/70 rounded border border-white/10 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-center ${isMobile ? 'text-sm px-3 py-2.5' : 'text-xs px-2 py-1.5'}`}
                aria-label="Border color hex value"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-white/40 block mb-1">Border Width (px)</label>
            <input
              type="range"
              min={0}
              max={10}
              value={block.styles?.borderWidth ?? 0}
              onChange={(e) => updateStyles({ borderWidth: parseInt(e.target.value) })}
              className="w-full accent-indigo-500 cursor-pointer"
              aria-label="Border width slider"
            />
            <div className="text-[10px] text-white/40 text-right mt-1">
              {block.styles?.borderWidth ?? 0} px
            </div>
          </div>
        </div>
      </InspectorSection>

      <InspectorSection label="Block Content Layout">
        <div className="space-y-4">
          {block.blocks.map((sub, idx) => (
            <div key={idx} className="p-2.5 bg-white/5 border border-white/5 rounded relative group">
              <button
                onClick={() => handleRemoveSubBlock(idx)}
                className="absolute right-1 top-1 text-white/30 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                aria-label="Remove block item"
              >
                <Trash2 size={12} />
              </button>
              <div className="space-y-2">
                <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest block">Sub-Block {idx + 1} ({sub.type})</span>
                {sub.type === 'image' ? (
                  <div className="text-[10px] text-indigo-400 font-mono truncate">
                    Image block. Click in canvas to edit URL / drag.
                  </div>
                ) : (
                  <AutocompleteTextarea
                    value={(sub as any).text ?? ''}
                    onValueChange={(val) => handleSubBlockChange(idx, val)}
                    className={`w-full bg-[#0d0d1e] text-white/70 rounded border border-white/10 focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[50px] ${isMobile ? 'text-sm px-3 py-2.5' : 'text-xs px-2 py-1.5'}`}
                    placeholder="Text template..."
                  />
                )}
              </div>
            </div>
          ))}

          {/* Add block item form */}
          <div className="p-2.5 bg-indigo-500/5 border border-indigo-500/10 rounded space-y-2.5">
            <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Add Sub-Block Content</h4>
            <div className="space-y-2">
              <AutocompleteInput
                type="text"
                placeholder="Text (e.g. Page {{currentPage}} of {{totalPages}})"
                value={newSubText}
                onValueChange={(val) => setNewSubText(val)}
                className={`w-full bg-white/5 text-white/70 rounded border border-white/10 focus:outline-none ${isMobile ? 'text-sm px-3 py-2.5' : 'text-xs px-2 py-1.5'}`}
              />
              <div className="flex gap-2">
                <select
                  value={newSubAlign}
                  onChange={(e) => setNewSubAlign(e.target.value as any)}
                  className="flex-1 bg-[#1e1e38] text-white/70 text-[10px] px-1.5 py-1 rounded border border-white/10 focus:outline-none cursor-pointer"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
                <button
                  onClick={handleAddTextSubBlock}
                  className="py-1 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] font-semibold transition-all flex items-center justify-center gap-1"
                >
                  <Plus size={12} /> Add Text
                </button>
              </div>
            </div>

            <div className="border-t border-white/5 pt-2">
              <button
                onClick={handleAddImageSubBlock}
                className="w-full py-1.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded text-[10px] font-semibold transition-all flex items-center justify-center gap-1"
              >
                <ImageIcon size={12} /> Add Image Block
              </button>
            </div>
          </div>
        </div>
      </InspectorSection>
      <SystemVariablesSection />
    </>
  );
}

// ============================================================
// Layout helper components
// ============================================================

function InspectorHeader({ label }: { label: string }) {
  const selectedBlockId = useDocumentStore((s) => s.selectedBlockId);
  const selectBlock = useDocumentStore((s) => s.selectBlock);

  return (
    <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-2 overflow-hidden">
        <Settings2 size={15} className="text-indigo-400 flex-shrink-0" />
        <span className="text-xs font-semibold text-white/60 uppercase tracking-wider truncate">
          {label}
        </span>
      </div>
      {selectedBlockId !== null && (
        <button
          onClick={() => selectBlock(null)}
          className="text-white/40 hover:text-white hover:bg-white/10 p-1 rounded transition-all flex items-center justify-center flex-shrink-0"
          aria-label="Back to page settings"
          title="Back to page settings"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

function InspectorSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-2">
        {label}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

interface NumberInputProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  isMobile?: boolean;
  onChange: (value: number) => void;
}

function NumberInput({ label, value, min, max, step = 1, isMobile, onChange }: NumberInputProps) {
  return (
    <div>
      <label className={`${isMobile ? 'text-[11px]' : 'text-[10px]'} text-white/40 block mb-1`}>{label}</label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`
          w-full bg-white/5 text-white/70 rounded
          border border-white/10 focus:outline-none focus:ring-1 focus:ring-indigo-500
          [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
          ${isMobile ? 'text-sm px-3 py-2.5' : 'text-xs px-2 py-1.5'}
        `}
        aria-label={label}
      />
    </div>
  );
}

// ============================================================
// Dynamic variables section
// ============================================================

function SystemVariablesSection() {
  const metadata = useDocumentStore((s) => s.metadata);
  let jsonKeys: string[] = [];
  if (metadata.uploadedJson) {
    try {
      jsonKeys = flattenJsonKeys(JSON.parse(metadata.uploadedJson));
    } catch (e) {}
  }
  return (
    <InspectorSection label="Dynamic Placeholders">
      <VariablesExplorerList
        customVariables={metadata.customVariables ?? []}
        jsonKeys={jsonKeys}
      />
    </InspectorSection>
  );
}

function SidebarTabs({
  activeTab,
  setActiveTab,
}: {
  activeTab: 'page' | 'project' | 'variables';
  setActiveTab: (tab: 'page' | 'project' | 'variables') => void;
}) {
  return (
    <div className="flex border-b border-white/10 bg-[#0d0d1e] flex-shrink-0">
      <button
        onClick={() => setActiveTab('page')}
        className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all
          ${activeTab === 'page'
            ? 'text-indigo-400 border-b-2 border-indigo-500 bg-white/[0.02]'
            : 'text-white/40 hover:text-white/70'}`}
      >
        <Layout size={13} />
        Page
      </button>
      <button
        onClick={() => setActiveTab('project')}
        className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all
          ${activeTab === 'project'
            ? 'text-indigo-400 border-b-2 border-indigo-500 bg-white/[0.02]'
            : 'text-white/40 hover:text-white/70'}`}
      >
        <FileText size={13} />
        Project
      </button>
      <button
        onClick={() => setActiveTab('variables')}
        className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all
          ${activeTab === 'variables'
            ? 'text-indigo-400 border-b-2 border-indigo-500 bg-white/[0.02]'
            : 'text-white/40 hover:text-white/70'}`}
      >
        <Database size={13} />
        Variables
      </button>
    </div>
  );
}

// ============================================================
// WCAG Contrast ratio calculator
// ============================================================

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleanHex = hex.trim().replace(/^#/, '');
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0]! + cleanHex[0], 16);
    const g = parseInt(cleanHex[1]! + cleanHex[1], 16);
    const b = parseInt(cleanHex[2]! + cleanHex[2], 16);
    return isNaN(r) || isNaN(g) || isNaN(b) ? null : { r, g, b };
  }
  if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return isNaN(r) || isNaN(g) || isNaN(b) ? null : { r, g, b };
  }
  return null;
}

function getRelativeLuminance(color: { r: number; g: number; b: number }): number {
  const rsRGB = color.r / 255;
  const gsRGB = color.g / 255;
  const bsRGB = color.b / 255;

  const r = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
  const g = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
  const b = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function getContrastRatio(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 21; // black contrast ratio on white background
  const L = getRelativeLuminance(rgb);
  // relative luminance of white background is 1.0
  return 1.05 / (L + 0.05);
}

// ============================================================
// Project Settings & Tabs panels
// ============================================================



function ProjectSettingsPanel({
  metadata,
  updateMetadata,
  isMobile,
}: {
  metadata: any;
  updateMetadata: (changes: any) => void;
  isMobile: boolean;
}) {
  const [keywordInput, setKeywordInput] = useState('');

  function handleAddKeyword(e: React.FormEvent) {
    e.preventDefault();
    if (!keywordInput.trim()) return;
    const currentKeywords = metadata.keywords ?? [];
    if (!currentKeywords.includes(keywordInput.trim())) {
      updateMetadata({ keywords: [...currentKeywords, keywordInput.trim()] });
    }
    setKeywordInput('');
  }

  function handleRemoveKeyword(kw: string) {
    const currentKeywords = metadata.keywords ?? [];
    updateMetadata({ keywords: currentKeywords.filter((k: string) => k !== kw) });
  }

  return (
    <div className={`${isMobile ? 'p-2 space-y-4' : 'p-3 space-y-6'}`}>
      {/* Title */}
      <InspectorSection label="Project Title">
        <input
          type="text"
          value={metadata.title ?? ''}
          onChange={(e) => updateMetadata({ title: e.target.value })}
          className={`w-full bg-white/5 text-white/70 rounded border border-white/10 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold ${isMobile ? 'text-sm px-3 py-2.5' : 'text-xs px-2 py-1.5'}`}
          aria-label="Project Title"
        />
      </InspectorSection>

      {/* Author */}
      <InspectorSection label="Document Author">
        <input
          type="text"
          value={metadata.author ?? ''}
          onChange={(e) => updateMetadata({ author: e.target.value })}
          className={`w-full bg-white/5 text-white/70 rounded border border-white/10 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${isMobile ? 'text-sm px-3 py-2.5' : 'text-xs px-2 py-1.5'}`}
          placeholder="e.g. John Doe"
          aria-label="Document Author"
        />
      </InspectorSection>

      {/* Subject */}
      <InspectorSection label="Document Subject">
        <textarea
          value={metadata.subject ?? ''}
          onChange={(e) => updateMetadata({ subject: e.target.value })}
          className={`w-full bg-white/5 text-white/70 rounded border border-white/10 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${isMobile ? 'text-sm px-3 py-2.5' : 'text-xs px-2 py-1.5'} min-h-[60px]`}
          placeholder="Brief summary..."
          aria-label="Document Subject"
        />
      </InspectorSection>

      {/* Keywords */}
      <InspectorSection label="Keywords">
        <form onSubmit={handleAddKeyword} className="space-y-2">
          <div className="flex gap-1">
            <input
              type="text"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              className={`flex-1 bg-white/5 text-white/70 rounded border border-white/10 focus:outline-none ${isMobile ? 'text-sm px-3 py-2.5' : 'text-xs px-2 py-1.5'}`}
              placeholder="Add tag..."
            />
            <button
              type="submit"
              className="py-1 px-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold"
            >
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {(metadata.keywords ?? []).map((kw: string) => (
              <span
                key={kw}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-white/5 text-white/70 border border-white/10 hover:border-red-500 hover:text-red-400 cursor-pointer transition-all"
                onClick={() => handleRemoveKeyword(kw)}
              >
                {kw} &times;
              </span>
            ))}
          </div>
        </form>
      </InspectorSection>
    </div>
  );
}

// ============================================================
// Variables Manager Panel (Custom & JSON)
// ============================================================

function VariablesSettingsPanel({
  metadata,
  updateMetadata,
  isMobile,
}: {
  metadata: any;
  updateMetadata: (changes: any) => void;
  isMobile: boolean;
}) {
  const [customKey, setCustomKey] = useState('');
  const [customValue, setCustomValue] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [jsonText, setJsonText] = useState(metadata.uploadedJson ?? '');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    setJsonText(metadata.uploadedJson ?? '');
  }, [metadata.uploadedJson]);

  function handleAddCustomVar() {
    if (!customKey.trim() || !customValue.trim()) return;
    const currentVars = metadata.customVariables ?? [];
    const key = customKey.trim().replace(/\s+/g, '_');
    if (!currentVars.some((v: any) => v.key === key)) {
      updateMetadata({
        customVariables: [...currentVars, { key, value: customValue.trim() }],
      });
    }
    setCustomKey('');
    setCustomValue('');
  }

  function handleRemoveCustomVar(key: string) {
    const currentVars = metadata.customVariables ?? [];
    updateMetadata({
      customVariables: currentVars.filter((v: any) => v.key !== key),
    });
  }

  function handleJsonChange(text: string) {
    setJsonText(text);
    if (!text.trim()) {
      updateMetadata({ uploadedJson: '' });
      setJsonError(null);
      return;
    }
    try {
      JSON.parse(text);
      updateMetadata({ uploadedJson: text });
      setJsonError(null);
    } catch (e: any) {
      setJsonError(e.message);
    }
  }

  async function handleFetchApi() {
    if (!apiUrl.trim()) return;
    setIsFetching(true);
    setJsonError(null);
    try {
      const res = await fetch(apiUrl.trim());
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      const stringified = JSON.stringify(data, null, 2);
      setJsonText(stringified);
      updateMetadata({ uploadedJson: stringified });
    } catch (e: any) {
      setJsonError(`Fetch failed: ${e.message}`);
    } finally {
      setIsFetching(false);
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      handleJsonChange(text);
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  let jsonKeys: string[] = [];
  if (metadata.uploadedJson) {
    try {
      jsonKeys = flattenJsonKeys(JSON.parse(metadata.uploadedJson));
    } catch (e) {}
  }

  return (
    <div className={`${isMobile ? 'p-2 space-y-4' : 'p-3 space-y-6'}`}>
      <InspectorSection label="Custom Variables">
        <div className="space-y-3">
          <div className="flex gap-1">
            <input
              type="text"
              placeholder="Key"
              value={customKey}
              onChange={(e) => setCustomKey(e.target.value)}
              className={`flex-1 bg-white/5 text-white/70 rounded border border-white/10 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${isMobile ? 'text-sm px-3 py-2.5' : 'text-xs px-2 py-1.5'}`}
            />
            <input
              type="text"
              placeholder="Value"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              className={`flex-1 bg-white/5 text-white/70 rounded border border-white/10 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${isMobile ? 'text-sm px-3 py-2.5' : 'text-xs px-2 py-1.5'}`}
            />
            <button
              onClick={handleAddCustomVar}
              className={`py-1 px-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-semibold ${isMobile ? 'px-3 py-2.5 text-sm' : 'text-xs'}`}
            >
              <Plus size={isMobile ? 18 : 14} />
            </button>
          </div>
          <div className="space-y-1 max-h-36 overflow-y-auto scrollbar-thin">
            {(metadata.customVariables ?? []).map((v: any) => (
              <div key={v.key} className="flex items-center justify-between bg-white/5 p-1.5 rounded text-xs">
                <div className="truncate mr-2">
                  <span className="font-mono text-indigo-400 font-bold">{`{{${v.key}}}`}</span>
                  <span className="text-white/40 ml-1.5 truncate">({v.value})</span>
                </div>
                <button
                  onClick={() => handleRemoveCustomVar(v.key)}
                  className="text-white/30 hover:text-red-400 p-0.5 rounded transition-all"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </InspectorSection>

      <InspectorSection label="JSON Payload">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/40">Upload JSON File</span>
            <label className="flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-white/70 text-[10px] font-semibold cursor-pointer">
              <FileUp size={11} /> Choose file
              <input type="file" accept=".json" onChange={handleFileUpload} className="sr-only" />
            </label>
          </div>

          <div>
            <label className="text-[10px] text-white/40 block mb-1">Load from API URL</label>
            <div className="flex gap-1">
              <input
                type="text"
                placeholder="https://api.example.com/data"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                className="flex-1 bg-white/5 text-white/70 text-[10px] px-2 py-1.5 rounded border border-white/10 focus:outline-none"
              />
              <button
                onClick={handleFetchApi}
                disabled={isFetching}
                className="py-1 px-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] font-semibold transition-all disabled:opacity-50 flex items-center gap-1"
              >
                <Globe size={11} /> {isFetching ? '...' : 'Fetch'}
              </button>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-white/40 block mb-1">Paste Raw JSON</label>
            <textarea
              value={jsonText}
              onChange={(e) => handleJsonChange(e.target.value)}
              className={`w-full bg-[#0d0d1e] text-white/70 rounded border border-white/10 focus:outline-none min-h-[100px] font-mono ${isMobile ? 'text-sm px-3 py-2.5' : 'text-xs px-2 py-1.5'}`}
              placeholder='{ "key": "value" }'
            />
            {jsonError && (
              <span className="text-[9px] text-red-400 block mt-0.5 leading-tight">{jsonError}</span>
            )}
          </div>
        </div>
      </InspectorSection>

      <InspectorSection label="Available Fields Explorer">
        <VariablesExplorerList customVariables={metadata.customVariables ?? []} jsonKeys={jsonKeys} />
      </InspectorSection>
    </div>
  );
}

function VariablesExplorerList({
  customVariables,
  jsonKeys,
}: {
  customVariables: Array<{ key: string; value: string }>;
  jsonKeys: string[];
}) {
  const [copiedValue, setCopiedValue] = useState<string | null>(null);

  const systemVars = [
    { label: 'Current Page', val: '{{currentPage}}' },
    { label: 'Total Pages', val: '{{totalPages}}' },
    { label: 'Current Date', val: '{{currentDate}}' },
  ];

  const customList = customVariables.map((v) => ({
    label: `Custom (${v.value})`,
    val: `{{${v.key}}}`,
  }));

  const jsonList = jsonKeys.map((k) => ({
    label: `JSON Key`,
    val: `{{${k}}}`,
  }));

  const allList = [...systemVars, ...customList, ...jsonList];

  // Exclude some common system internal keys or format duplicates
  const uniqueList = allList.filter((item, index, self) =>
    index === self.findIndex((t) => t.val === item.val)
  );

  function handleCopy(val: string) {
    navigator.clipboard.writeText(val);
    setCopiedValue(val);
    setTimeout(() => setCopiedValue(null), 1500);
  }

  if (uniqueList.length === 0) {
    return (
      <div className="text-[11px] text-white/30 italic text-center py-4 bg-white/[0.02] border border-dashed border-white/5 rounded">
        No active variables. Upload JSON or add custom variables above.
      </div>
    );
  }

  return (
    <div className="space-y-1 max-h-60 overflow-y-auto scrollbar-thin pr-1">
      {uniqueList.map((v, idx) => (
        <div
          key={idx}
          onClick={() => handleCopy(v.val)}
          className="group flex items-center justify-between p-1.5 rounded bg-white/5 hover:bg-white/10 cursor-pointer border border-white/5 transition-all"
          role="button"
          tabIndex={0}
          aria-label={`Copy placeholder ${v.val}`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleCopy(v.val);
          }}
        >
          <div className="flex flex-col min-w-0 mr-2">
            <span className="text-[8px] text-white/40 font-semibold truncate">{v.label}</span>
            <span className="text-[10px] text-indigo-400 font-mono font-bold mt-0.5 truncate">{v.val}</span>
          </div>
          <div className="text-white/30 hover:text-white transition-all flex items-center justify-center p-1 bg-white/5 rounded flex-shrink-0">
            {copiedValue === v.val ? (
              <Check size={10} className="text-green-400" />
            ) : (
              <Copy size={10} className="group-hover:scale-105 transition-transform" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function PageNumberPropertiesPanel({ block, updateBlock, isMobile }: { block: any; updateBlock: any; isMobile: boolean }) {
  return (
    <InspectorSection label="Page Number Format">
      <div>
        <label className="text-[10px] text-white/40 block mb-1">Format Template</label>
        <AutocompleteInput
          type="text"
          value={block.format}
          onValueChange={(val) => updateBlock(block.id, { format: val })}
          className={`w-full bg-white/5 text-white/70 rounded border border-white/10 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono ${isMobile ? 'text-sm px-3 py-2.5' : 'text-xs px-2 py-1.5'}`}
          placeholder="Página {{currentPage}} de {{totalPages}}"
        />
        <p className="text-[9px] text-white/30 mt-1">Variables: `{"{{currentPage}}"}`, `{"{{totalPages}}"}`</p>
      </div>
    </InspectorSection>
  );
}

function SignaturePropertiesPanel({ block, updateBlock, isMobile }: { block: any; updateBlock: any; isMobile: boolean }) {
  const updateStyles = (changes: any) => {
    updateBlock(block.id, { styles: { ...block.styles, ...changes } });
  };
  return (
    <>
      <InspectorSection label="Signature Info">
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-white/40 block mb-1">Label</label>
            <input
              type="text"
              value={block.label}
              onChange={(e) => updateBlock(block.id, { label: e.target.value })}
              className={`w-full bg-white/5 text-white/70 rounded border border-white/10 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${isMobile ? 'text-sm px-3 py-2.5' : 'text-xs px-2 py-1.5'}`}
            />
          </div>
          <div>
            <label className="text-[10px] text-white/40 block mb-1">Name</label>
            <input
              type="text"
              value={block.name ?? ''}
              onChange={(e) => updateBlock(block.id, { name: e.target.value })}
              className={`w-full bg-white/5 text-white/70 rounded border border-white/10 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${isMobile ? 'text-sm px-3 py-2.5' : 'text-xs px-2 py-1.5'}`}
            />
          </div>
          <div>
            <label className="text-[10px] text-white/40 block mb-1">Title / Role</label>
            <input
              type="text"
              value={block.title ?? ''}
              onChange={(e) => updateBlock(block.id, { title: e.target.value })}
              className={`w-full bg-white/5 text-white/70 rounded border border-white/10 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${isMobile ? 'text-sm px-3 py-2.5' : 'text-xs px-2 py-1.5'}`}
            />
          </div>
        </div>
      </InspectorSection>
      <InspectorSection label="Signature Line Style">
        <div className="space-y-3">
          <NumberInput
            label="Line Width (pt)"
            value={block.styles.lineWidth ?? 1}
            min={0.5}
            max={10}
            step={0.5}
            isMobile={isMobile}
            onChange={(v) => updateStyles({ lineWidth: v })}
          />
          <NumberInput
            label="Line Gap (pt)"
            value={block.styles.gap ?? 8}
            min={2}
            max={50}
            isMobile={isMobile}
            onChange={(v) => updateStyles({ gap: v })}
          />
          <div>
            <label className="text-[10px] text-white/40 block mb-1">Line Color</label>
            <input
              type="color"
              value={block.styles.lineColor ?? '#9CA3AF'}
              onChange={(e) => updateStyles({ lineColor: e.target.value })}
              className="w-full h-8 rounded cursor-pointer border-0 bg-transparent"
            />
          </div>
        </div>
      </InspectorSection>
    </>
  );
}

function ContainerPropertiesPanel({ block, updateBlock, isMobile }: { block: any; updateBlock: any; isMobile: boolean }) {
  const updateStyles = (changes: any) => {
    updateBlock(block.id, { styles: { ...block.styles, ...changes } });
  };
  return (
    <InspectorSection label="Card Wrapper Style">
      <div className="space-y-3">
        <NumberInput
          label="Inner Padding (px)"
          value={block.styles.padding ?? 8}
          min={0}
          max={100}
          isMobile={isMobile}
          onChange={(v) => updateStyles({ padding: v })}
        />
        <NumberInput
          label="Corner Radius (px)"
          value={block.styles.borderRadius ?? 4}
          min={0}
          max={100}
          isMobile={isMobile}
          onChange={(v) => updateStyles({ borderRadius: v })}
        />
        <div>
          <label className="text-[10px] text-white/40 block mb-1">Background Color</label>
          <input
            type="color"
            value={block.styles.backgroundColor ?? '#F9FAFB'}
            onChange={(e) => updateStyles({ backgroundColor: e.target.value })}
            className="w-full h-8 rounded cursor-pointer border-0 bg-transparent"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <NumberInput
            label="Border (pt)"
            value={block.styles.borderWidth ?? 1}
            min={0}
            max={10}
            isMobile={isMobile}
            onChange={(v) => updateStyles({ borderWidth: v })}
          />
          <div>
            <label className="text-[10px] text-white/40 block mb-1">Border Color</label>
            <input
              type="color"
              value={block.styles.borderColor ?? '#E5E7EB'}
              onChange={(e) => updateStyles({ borderColor: e.target.value })}
              className="w-full h-8 rounded cursor-pointer border-0 bg-transparent"
            />
          </div>
        </div>
      </div>
    </InspectorSection>
  );
}

function BarcodePropertiesPanel({ block, updateBlock, isMobile }: { block: any; updateBlock: any; isMobile: boolean }) {
  const updateStyles = (changes: any) => {
    updateBlock(block.id, { styles: { ...block.styles, ...changes } });
  };
  return (
    <InspectorSection label="Barcode / QR Settings">
      <div className="space-y-3">
        <div>
          <label className="text-[10px] text-white/40 block mb-1">Format</label>
          <select
            value={block.format}
            onChange={(e) => updateBlock(block.id, { format: e.target.value as any })}
            className={`w-full bg-[#1e1e38] text-white/70 rounded border border-white/10 focus:outline-none cursor-pointer ${isMobile ? 'text-sm px-3 py-2.5' : 'text-xs px-2 py-1.5'}`}
          >
            <option value="qr">QR Code (2D)</option>
            <option value="code128">Code 128 (1D)</option>
            <option value="ean13">EAN-13 (1D)</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-white/40 block mb-1">Data / Value Template</label>
          <AutocompleteInput
            type="text"
            value={block.value}
            onValueChange={(val) => updateBlock(block.id, { value: val })}
            className={`w-full bg-white/5 text-white/70 rounded border border-white/10 focus:outline-none font-mono ${isMobile ? 'text-sm px-3 py-2.5' : 'text-xs px-2 py-1.5'}`}
            placeholder="https://..."
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <NumberInput
            label="Width (px)"
            value={block.styles.width ?? 80}
            min={20}
            max={1000}
            isMobile={isMobile}
            onChange={(v) => updateStyles({ width: v })}
          />
          <NumberInput
            label="Height (px)"
            value={block.styles.height ?? 80}
            min={20}
            max={1000}
            isMobile={isMobile}
            onChange={(v) => updateStyles({ height: v })}
          />
        </div>
        <div>
          <label className="text-[10px] text-white/40 block mb-1">Color</label>
          <input
            type="color"
            value={block.styles.color ?? '#000000'}
            onChange={(e) => updateStyles({ color: e.target.value })}
            className="w-full h-8 rounded cursor-pointer border-0 bg-transparent"
          />
        </div>
      </div>
    </InspectorSection>
  );
}

function ListPropertiesPanel({ block, updateBlock, isMobile }: { block: any; updateBlock: any; isMobile: boolean }) {
  const [newItemText, setNewItemText] = useState('');
  const updateStyles = (changes: any) => {
    updateBlock(block.id, { styles: { ...block.styles, ...changes } });
  };

  function handleAddItem() {
    if (!newItemText.trim()) return;
    updateBlock(block.id, { items: [...block.items, newItemText.trim()] });
    setNewItemText('');
  }

  function handleRemoveItem(idx: number) {
    updateBlock(block.id, { items: block.items.filter((_: any, i: any) => i !== idx) });
  }

  function handleItemChange(idx: number, val: string) {
    updateBlock(block.id, { items: block.items.map((item: any, i: any) => (i === idx ? val : item)) });
  }

  return (
    <>
      <InspectorSection label="List Settings">
        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-white/70">
            <input
              type="checkbox"
              checked={block.ordered}
              onChange={(e) => updateBlock(block.id, { ordered: e.target.checked })}
              className="rounded border-white/10 bg-white/5 text-indigo-600 focus:ring-0"
            />
            <span>Ordered / Numbered List</span>
          </label>
          {!block.ordered && (
            <div>
              <label className="text-[10px] text-white/40 block mb-1">Bullet Style</label>
              <select
                value={block.styles.bulletStyle ?? 'dot'}
                onChange={(e) => updateStyles({ bulletStyle: e.target.value })}
                className={`w-full bg-[#1e1e38] text-white/70 rounded border border-white/10 focus:outline-none cursor-pointer ${isMobile ? 'text-sm px-3 py-2.5' : 'text-xs px-2 py-1.5'}`}
              >
                <option value="dot">Dot (•)</option>
                <option value="dash">Dash (-)</option>
                <option value="checkmark">Checkmark (✓)</option>
              </select>
            </div>
          )}
          <NumberInput
            label="Item Spacing (px)"
            value={block.styles.itemSpacing ?? 4}
            min={0}
            max={40}
            isMobile={isMobile}
            onChange={(v) => updateStyles({ itemSpacing: v })}
          />
        </div>
      </InspectorSection>
      <InspectorSection label="List Items">
        <div className="space-y-2">
          {block.items.map((item: string, idx: number) => (
            <div key={idx} className="flex items-center gap-1.5 bg-white/5 p-1 rounded relative group">
              <AutocompleteInput
                type="text"
                value={item}
                onValueChange={(val) => handleItemChange(idx, val)}
                className="flex-1 bg-transparent text-white/70 text-xs px-1 focus:outline-none focus:bg-white/10 rounded"
              />
              <button
                onClick={() => handleRemoveItem(idx)}
                className="text-white/30 hover:text-red-400 p-0.5"
                aria-label="Remove item"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          <div className="flex gap-1.5 pt-1">
            <AutocompleteInput
              type="text"
              placeholder="Add list item..."
              value={newItemText}
              onValueChange={(val) => setNewItemText(val)}
              className={`flex-1 bg-white/5 text-white/70 rounded border border-white/10 focus:outline-none text-xs px-2 py-1`}
            />
            <button
              onClick={handleAddItem}
              className="p-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs"
              aria-label="Add item"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      </InspectorSection>
    </>
  );
}

function ChartPropertiesPanel({ block, updateBlock, isMobile }: { block: any; updateBlock: any; isMobile: boolean }) {
  const updateStyles = (changes: any) => {
    updateBlock(block.id, { styles: { ...block.styles, ...changes } });
  };
  return (
    <InspectorSection label="Chart Properties">
      <div className="space-y-3">
        <div>
          <label className="text-[10px] text-white/40 block mb-1">Chart Type</label>
          <select
            value={block.chartType}
            onChange={(e) => updateBlock(block.id, { chartType: e.target.value as any })}
            className={`w-full bg-[#1e1e38] text-white/70 rounded border border-white/10 focus:outline-none cursor-pointer ${isMobile ? 'text-sm px-3 py-2.5' : 'text-xs px-2 py-1.5'}`}
          >
            <option value="bar">Bar Chart</option>
            <option value="line">Line Chart</option>
            <option value="pie">Pie Chart</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-white/40 block mb-1">Loop Array Data Source</label>
          <AutocompleteInput
            type="text"
            value={block.loopOver}
            onValueChange={(val) => updateBlock(block.id, { loopOver: val })}
            className={`w-full bg-white/5 text-white/70 rounded border border-white/10 focus:outline-none font-mono ${isMobile ? 'text-sm px-3 py-2.5' : 'text-xs px-2 py-1.5'}`}
            placeholder="ventas"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-white/40 block mb-1">Label Key</label>
            <input
              type="text"
              value={block.labelKey}
              onChange={(e) => updateBlock(block.id, { labelKey: e.target.value })}
              className={`w-full bg-white/5 text-white/70 rounded border border-white/10 focus:outline-none font-mono ${isMobile ? 'text-sm px-3 py-2.5' : 'text-xs px-2 py-1.5'}`}
              placeholder="mes"
            />
          </div>
          <div>
            <label className="text-[10px] text-white/40 block mb-1">Value Key</label>
            <input
              type="text"
              value={block.valueKey}
              onChange={(e) => updateBlock(block.id, { valueKey: e.target.value })}
              className={`w-full bg-white/5 text-white/70 rounded border border-white/10 focus:outline-none font-mono ${isMobile ? 'text-sm px-3 py-2.5' : 'text-xs px-2 py-1.5'}`}
              placeholder="monto"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <NumberInput
            label="Width (px)"
            value={block.styles.width ?? 350}
            min={100}
            max={800}
            isMobile={isMobile}
            onChange={(v) => updateStyles({ width: v })}
          />
          <NumberInput
            label="Height (px)"
            value={block.styles.height ?? 150}
            min={50}
            max={600}
            isMobile={isMobile}
            onChange={(v) => updateStyles({ height: v })}
          />
        </div>
      </div>
    </InspectorSection>
  );
}

