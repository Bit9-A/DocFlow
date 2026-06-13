import { create } from 'zustand';

export type Breakpoint = 'desktop' | 'tablet' | 'mobile';

interface UIState {
  // Panel visibility (desktop)
  isToolbarOpen: boolean;
  isInspectorOpen: boolean;

  // Mobile/tablet drawer state
  isMobileToolbarOpen: boolean;
  isMobileInspectorOpen: boolean;

  // Active editor tool
  activeTool: 'select' | 'pan';

  // Preview modal
  isPreviewOpen: boolean;
  previewTab: 'pdf' | 'html';

  // Export modal
  isExportOpen: boolean;

  // Responsive breakpoint
  breakpoint: Breakpoint;

  // Actions
  setToolbarOpen: (open: boolean) => void;
  setInspectorOpen: (open: boolean) => void;
  setMobileToolbarOpen: (open: boolean) => void;
  setMobileInspectorOpen: (open: boolean) => void;
  toggleMobileToolbar: () => void;
  toggleMobileInspector: () => void;
  setActiveTool: (tool: UIState['activeTool']) => void;
  setPreviewOpen: (open: boolean, tab?: UIState['previewTab']) => void;
  setExportOpen: (open: boolean) => void;
  setBreakpoint: (bp: Breakpoint) => void;

  // Page navigation
  currentPageView: number;
  setCurrentPageView: (page: number) => void;
  pageInsertAfterId: string | null;
  setPageInsertAfterId: (id: string | null) => void;

  // Close all mobile panels
  closeAllMobile: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  isToolbarOpen: true,
  isInspectorOpen: true,
  isMobileToolbarOpen: false,
  isMobileInspectorOpen: false,
  activeTool: 'select',
  isPreviewOpen: false,
  previewTab: 'html',
  isExportOpen: false,
  breakpoint: 'desktop',

  setToolbarOpen: (open) => set({ isToolbarOpen: open }),
  setInspectorOpen: (open) => set({ isInspectorOpen: open }),
  setMobileToolbarOpen: (open) => set({ isMobileToolbarOpen: open }),
  setMobileInspectorOpen: (open) => set({ isMobileInspectorOpen: open }),

  toggleMobileToolbar: () =>
    set((state) => ({
      isMobileToolbarOpen: !state.isMobileToolbarOpen,
      isMobileInspectorOpen: false, // close the other
    })),

  toggleMobileInspector: () =>
    set((state) => ({
      isMobileInspectorOpen: !state.isMobileInspectorOpen,
      isMobileToolbarOpen: false, // close the other
    })),

  setActiveTool: (tool) => set({ activeTool: tool }),
  setPreviewOpen: (open, tab) =>
    set({ isPreviewOpen: open, ...(tab !== undefined && { previewTab: tab }) }),
  setExportOpen: (open) => set({ isExportOpen: open }),
  setBreakpoint: (bp) => set({ breakpoint: bp }),

  currentPageView: 0,
  setCurrentPageView: (page) => set({ currentPageView: page }),
  pageInsertAfterId: null,
  setPageInsertAfterId: (id) => set({ pageInsertAfterId: id }),

  closeAllMobile: () =>
    set({ isMobileToolbarOpen: false, isMobileInspectorOpen: false }),
}));
