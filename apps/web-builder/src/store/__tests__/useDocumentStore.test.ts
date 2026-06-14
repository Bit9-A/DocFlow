import { describe, it, expect, beforeEach } from 'vitest';
import { useDocumentStore } from '../useDocumentStore.js';

describe('useDocumentStore - exportSchema page assignment', () => {
  beforeEach(() => {
    // Reset store state before each test
    useDocumentStore.setState({
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
    });
  });

  it('assigns correct sequential page indices to blocks based on page-breaks', () => {
    const store = useDocumentStore.getState();

    // 1. Add heading (should be page 0)
    store.addBlock('heading');
    const headingId = useDocumentStore.getState().selectedBlockId!;

    // 2. Add page-break (should be page 0, then increment)
    store.addBlock('page-break');
    const pageBreakId = useDocumentStore.getState().selectedBlockId!;

    // 3. Add paragraph (should be page 1)
    store.addBlock('paragraph');
    const paragraphId = useDocumentStore.getState().selectedBlockId!;

    // Export the schema
    const schema = useDocumentStore.getState().exportSchema();

    // Find the exported blocks
    const heading = schema.ast.find((b) => b.id === headingId);
    const pageBreak = schema.ast.find((b) => b.id === pageBreakId);
    const paragraph = schema.ast.find((b) => b.id === paragraphId);

    expect(heading).toBeDefined();
    expect(heading!.page).toBe(0);

    expect(pageBreak).toBeDefined();
    expect(pageBreak!.page).toBe(0);

    expect(paragraph).toBeDefined();
    expect(paragraph!.page).toBe(1);
  });
});
