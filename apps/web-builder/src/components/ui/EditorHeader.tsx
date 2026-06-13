'use client';

import {
  Download,
  FileText,
  Redo2,
  Undo2,
  ZapIcon,
  Upload,
  FileCode,
  Copy,
  Check,
  X,
  PanelRightOpen,
  Plus,
  Eye,
} from 'lucide-react';
import { useDocumentStore, useDocumentHistory } from '@/store/useDocumentStore';
import { useUIStore } from '@/store/useUIStore';
import { useCallback, useState, useEffect } from 'react';
import { safeValidateSchema } from '@docflow/core/validator';
import { exportToPdfKit } from '@/lib/code-exporter';

export function EditorHeader() {
  const title = useDocumentStore((s) => s.metadata.title);
  const updateMetadata = useDocumentStore((s) => s.updateMetadata);
  const exportSchema = useDocumentStore((s) => s.exportSchema);
  const importSchema = useDocumentStore((s) => s.importSchema);
  const breakpoint = useUIStore((s) => s.breakpoint);
  const toggleMobileToolbar = useUIStore((s) => s.toggleMobileToolbar);
  const toggleMobileInspector = useUIStore((s) => s.toggleMobileInspector);
  const isMobileToolbarOpen = useUIStore((s) => s.isMobileToolbarOpen);
  const isMobileInspectorOpen = useUIStore((s) => s.isMobileInspectorOpen);
  const closeAllMobile = useUIStore((s) => s.closeAllMobile);
  const setPreviewOpen = useUIStore((s) => s.setPreviewOpen);

  const [showCodeModal, setShowCodeModal] = useState(false);
  const [codeLang, setCodeLang] = useState<'typescript' | 'javascript'>('typescript');
  const [copied, setCopied] = useState(false);
  const [titleFocused, setTitleFocused] = useState(false);

  function handleCopyCode() {
    const code = exportToPdfKit(exportSchema(), codeLang);
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const result = safeValidateSchema(json);
        if (!result.success) {
          alert(`Invalid schema: ${result.error.errors.map((err) => err.message).join(', ')}`);
          return;
        }
        importSchema(result.data);
        const announcer = document.getElementById('canvas-announcer');
        if (announcer !== null) {
          announcer.textContent = 'Schema imported successfully';
        }
      } catch (err) {
        alert('Malformed JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  const handleUndo = useCallback(() => {
    useDocumentStore.temporal.getState().undo();
    const announcer = document.getElementById('canvas-announcer');
    if (announcer !== null) announcer.textContent = 'Undo action performed';
  }, []);

  const handleRedo = useCallback(() => {
    useDocumentStore.temporal.getState().redo();
    const announcer = document.getElementById('canvas-announcer');
    if (announcer !== null) announcer.textContent = 'Redo action performed';
  }, []);

  function handleExport() {
    const schema = exportSchema();
    const blob = new Blob([JSON.stringify(schema, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '-').toLowerCase()}.docflow.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const isMobile = breakpoint === 'mobile';
  const isTablet = breakpoint === 'tablet';
  const isDesktop = breakpoint === 'desktop';

  return (
    <header className="h-12 bg-[#0d0d1f] border-b border-white/10 flex items-center px-3 md:px-4 gap-2 md:gap-4 shrink-0 no-print">
      {/* Logo */}
      <div className="flex items-center gap-1.5 md:gap-2 mr-1 md:mr-2 flex-shrink-0">
        <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center">
          <ZapIcon size={12} className="text-white" />
        </div>
        <h1 className="text-sm font-bold text-white tracking-tight hidden sm:block">DocFlow</h1>
      </div>

      <div className="w-px h-5 bg-white/10 hidden sm:block" />

      {/* Document title */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <FileText size={13} className="text-white/30 flex-shrink-0 hidden sm:block" />
        <input
          type="text"
          value={title}
          onChange={(e) => updateMetadata({ title: e.target.value })}
          onFocus={() => setTitleFocused(true)}
          onBlur={() => setTitleFocused(false)}
          className={`
            bg-transparent text-sm text-white/80 font-medium
            border-b border-transparent hover:border-white/20
            outline-none transition-colors w-full max-w-[140px] sm:max-w-xs truncate
            ${titleFocused ? 'border-indigo-500' : ''}
          `}
          aria-label="Document title"
        />
      </div>

      {/* ================================================================ */}
      {/* MOBILE / TABLET: Panel toggle buttons */}
      {/* ================================================================ */}
      {!isDesktop && (
        <div className="flex items-center gap-1 mr-1">
          <button
            onClick={() => setPreviewOpen(true)}
            className="
              p-1.5 rounded text-white/40 hover:text-white hover:bg-white/10
              transition-all flex items-center justify-center
            "
            aria-label="Preview PDF"
          >
            <Eye size={16} />
          </button>
          <button
            onClick={toggleMobileToolbar}
            className={`
              p-1.5 rounded transition-all flex items-center justify-center
              ${isMobileToolbarOpen
                ? 'bg-indigo-600/30 text-indigo-400'
                : 'text-white/40 hover:text-white hover:bg-white/10'}
            `}
            aria-label={isMobileToolbarOpen ? 'Close blocks panel' : 'Open blocks panel'}
            aria-expanded={isMobileToolbarOpen}
          >
            <Plus size={16} />
          </button>
          <button
            onClick={toggleMobileInspector}
            className={`
              p-1.5 rounded transition-all flex items-center justify-center
              ${isMobileInspectorOpen
                ? 'bg-indigo-600/30 text-indigo-400'
                : 'text-white/40 hover:text-white hover:bg-white/10'}
            `}
            aria-label={isMobileInspectorOpen ? 'Close inspector panel' : 'Open inspector panel'}
            aria-expanded={isMobileInspectorOpen}
          >
            <PanelRightOpen size={16} />
          </button>
        </div>
      )}

      {/* Desktop undo/redo */}
      <div className="flex items-center gap-1 ml-auto">
        <button
          onClick={handleUndo}
          className="
            p-1.5 rounded text-white/40 hover:text-white hover:bg-white/10
            transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
          "
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
        >
          <Undo2 size={15} />
        </button>
        <button
          onClick={handleRedo}
          className="
            p-1.5 rounded text-white/40 hover:text-white hover:bg-white/10
            transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
          "
          title="Redo (Ctrl+Y)"
          aria-label="Redo"
        >
          <Redo2 size={15} />
        </button>

        <div className="w-px h-4 bg-white/10 mx-1" />

        {/* ================================================================ */}
        {/* DESKTOP: Full action bar */}
        {/* ================================================================ */}
        <div className="flex items-center gap-1">
          {/* Preview PDF */}
          <button
            onClick={() => setPreviewOpen(true)}
            className="
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg
              bg-indigo-600/80 hover:bg-indigo-500 active:scale-95
              text-white text-xs font-semibold
              transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
            "
            aria-label="Preview PDF"
          >
            <Eye size={13} />
            <span className="hidden sm:inline">Preview</span>
          </button>

          {/* Import JSON */}
          <label
            className="
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10
              bg-white/5 hover:bg-white/10 active:scale-95 cursor-pointer
              text-white text-xs font-semibold
              transition-all focus-within:ring-2 focus-within:ring-indigo-500
              header-actions-desktop
            "
            aria-label="Import JSON schema"
          >
            <Upload size={13} />
            <span className="hidden md:inline">Import JSON</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="sr-only"
            />
          </label>

          {/* Export Code */}
          <button
            onClick={() => setShowCodeModal(true)}
            className="
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10
              bg-white/5 hover:bg-white/10 active:scale-95
              text-white text-xs font-semibold
              transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
              header-actions-desktop
            "
            aria-label="Export PDFKit Code"
          >
            <FileCode size={13} />
            <span className="hidden md:inline">Export Code</span>
          </button>

          {/* Export JSON */}
          <button
            onClick={handleExport}
            className="
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg
              bg-indigo-600 hover:bg-indigo-500 active:scale-95
              text-white text-xs font-semibold
              transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
            "
            aria-label="Export JSON schema"
          >
            <Download size={13} />
            <span className="hidden md:inline">Export JSON</span>
          </button>

          {/* Mobile: compressed export button (icon only) */}
          <button
            onClick={handleExport}
            className="
              p-1.5 rounded text-white/40 hover:text-white hover:bg-white/10
              transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
              header-actions-mobile
            "
            aria-label="Export JSON"
          >
            <Download size={15} />
          </button>
        </div>
      </div>

      {/* Code Export Modal */}
      {showCodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4">
          <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col shadow-2xl max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-4 sm:px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="text-indigo-400" size={16} />
                <span className="text-sm font-semibold text-white">Export PDFKit Code</span>
              </div>
              <button
                onClick={() => setShowCodeModal(false)}
                className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close modal"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 flex-1 flex flex-col gap-4 overflow-y-auto">
              <p className="text-xs text-white/60">
                Run this code directly in your Node.js environment to generate the exact PDF document using the PDFKit compiler.
              </p>

              {/* Lang Tabs */}
              <div className="flex bg-white/5 p-1 rounded-lg self-start border border-white/5">
                <button
                  onClick={() => setCodeLang('typescript')}
                  className={`px-3 py-1 text-xs rounded-md transition-all ${
                    codeLang === 'typescript' ? 'bg-indigo-600 text-white font-semibold shadow' : 'text-white/60 hover:text-white'
                  }`}
                >
                  TypeScript
                </button>
                <button
                  onClick={() => setCodeLang('javascript')}
                  className={`px-3 py-1 text-xs rounded-md transition-all ${
                    codeLang === 'javascript' ? 'bg-indigo-600 text-white font-semibold shadow' : 'text-white/60 hover:text-white'
                  }`}
                >
                  JavaScript
                </button>
              </div>

              {/* Code text block */}
              <textarea
                readOnly
                value={exportToPdfKit(exportSchema(), codeLang)}
                className="w-full h-60 sm:h-80 bg-black/40 border border-white/5 rounded-lg p-3 text-[11px] font-mono text-indigo-200 outline-none resize-none"
              />
            </div>

            {/* Modal Footer */}
            <div className="px-4 sm:px-6 py-4 border-t border-white/10 bg-black/10 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowCodeModal(false)}
                className="px-4 py-2 rounded-lg text-white/70 hover:text-white hover:bg-white/5 text-xs font-semibold transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all active:scale-95"
              >
                {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                {copied ? 'Copied!' : 'Copy Code'}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
