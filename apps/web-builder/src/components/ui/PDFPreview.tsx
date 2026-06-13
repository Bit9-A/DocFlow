'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Download, Loader2, AlertCircle, Eye, FileWarning } from 'lucide-react';
import { useDocumentStore } from '@/store/useDocumentStore';
import { useUIStore } from '@/store/useUIStore';

export function PDFPreview() {
  const isPreviewOpen = useUIStore((s) => s.isPreviewOpen);
  const setPreviewOpen = useUIStore((s) => s.setPreviewOpen);
  const exportSchema = useDocumentStore((s) => s.exportSchema);
  const metadata = useDocumentStore((s) => s.metadata);

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const handleClose = useCallback(() => {
    setPreviewOpen(false);
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
    setError(null);
    setPageCount(null);
    setLoadFailed(false);
  }, [setPreviewOpen, pdfUrl]);

  // Generate PDF when modal opens
  useEffect(() => {
    if (!isPreviewOpen) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setPdfUrl(null);
    setLoadFailed(false);

    async function generate() {
      try {
        const schema = exportSchema();
        const response = await fetch('/api/render-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schema, data: {} }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => null);
          throw new Error(errData?.error ?? `Server error: ${response.status}`);
        }

        const blob = await response.blob();
        if (cancelled) return;

        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
        setPageCount(Number(response.headers.get('X-Page-Count') ?? '0'));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to render PDF');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    generate();
    return () => { cancelled = true; };
  }, [isPreviewOpen, exportSchema]);

  // Close on Escape
  useEffect(() => {
    if (!isPreviewOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPreviewOpen, handleClose]);

  if (!isPreviewOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col p-0 sm:p-2"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="PDF Preview"
    >
      <div className="bg-[#1a1a2e] sm:border border-white/10 sm:rounded-2xl w-full h-full flex flex-col shadow-2xl overflow-hidden">
        {/* --- Header --- */}
        <div className="px-3 sm:px-5 py-3 border-b border-white/10 flex items-center justify-between flex-shrink-0 gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-indigo-600/20 flex items-center justify-center flex-shrink-0">
              <Eye size={14} className="text-indigo-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-white truncate">
                PDF Preview
              </h2>
              <p className="text-[10px] text-white/40 truncate hidden sm:block">
                {metadata.title}{pageCount !== null ? ` — ${pageCount} page${pageCount !== 1 ? 's' : ''}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {pdfUrl && (
              <a
                href={pdfUrl}
                download={`${metadata.title.replace(/\s+/g, '-').toLowerCase()}.pdf`}
                className="
                  flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                  bg-indigo-600 hover:bg-indigo-500 active:scale-95
                  text-white text-xs font-semibold
                  transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
                "
                aria-label="Download PDF"
              >
                <Download size={13} />
                <span className="hidden sm:inline">Download</span>
              </a>
            )}
            <div className="w-px h-5 bg-white/10 hidden sm:block" />
            <button
              onClick={handleClose}
              className="p-1.5 rounded text-white/40 hover:text-white hover:bg-white/10 transition-all"
              aria-label="Close preview"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* --- Body --- */}
        <div className="flex-1 bg-[#0d0d1f] relative min-h-0 overflow-hidden">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-20">
              <Loader2 size={32} className="text-indigo-400 animate-spin" />
              <p className="text-xs text-white/50 font-medium">Rendering PDF...</p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-20 p-6">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertCircle size={24} className="text-red-400" />
              </div>
              <p className="text-sm text-red-400 font-semibold text-center">Render Error</p>
              <p className="text-xs text-white/50 text-center max-w-md">{error}</p>
            </div>
          )}

          {pdfUrl && !loading && (
            <div className="w-full h-full overflow-auto bg-white/5">
              <object
                data={pdfUrl}
                type="application/pdf"
                className="w-full h-full border-0"
                title="PDF Preview"
                aria-label="PDF document preview"
                onError={() => setLoadFailed(true)}
              >
                <div className="flex flex-col items-center justify-center h-full gap-4 p-6">
                  <FileWarning size={32} className="text-white/30" />
                  <p className="text-sm text-white/60 text-center">
                    PDF preview not available in your browser.
                  </p>
                  {pdfUrl && (
                    <a
                      href={pdfUrl}
                      download
                      className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all"
                    >
                      Download PDF to view
                    </a>
                  )}
                </div>
              </object>
            </div>
          )}

          {loadFailed && pdfUrl && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <FileWarning size={24} className="text-white/30" />
                <p className="text-xs text-white/50">PDF object failed to load</p>
              </div>
            </div>
          )}

          {!pdfUrl && !loading && !error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <FileWarning size={24} className="text-white/20" />
            </div>
          )}
        </div>

        {/* --- Footer --- */}
        <div className="px-4 sm:px-5 py-2.5 border-t border-white/10 bg-black/10 flex items-center justify-between flex-shrink-0">
          <span className="text-[10px] text-white/30">
            <code className="text-indigo-400/60 font-mono">pdfkit</code>
          </span>
          {pageCount !== null && (
            <span className="text-[10px] text-white/40 font-mono">
              {pageCount} page{pageCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
