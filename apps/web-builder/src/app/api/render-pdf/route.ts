import { NextRequest, NextResponse } from 'next/server';
import { PdfKitAdapter } from '@docflow/core';
import type { DocFlowSchema } from '@docflow/core';

/**
 * POST /api/render-pdf
 *
 * Accepts a DocFlow JSON schema + data payload, renders the PDF
 * server-side via pdfkit, and returns the raw PDF buffer.
 *
 * Body: { schema: DocFlowSchema, data?: Record<string, unknown> }
 * Response: application/pdf (binary)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { schema, data } = body as {
      schema: DocFlowSchema;
      data?: Record<string, unknown>;
    };

    if (!schema || !schema.metadata || !schema.ast) {
      return NextResponse.json(
        { error: 'Invalid schema: missing metadata or ast' },
        { status: 400 },
      );
    }

    const adapter = new PdfKitAdapter();
    const result = await adapter.render(schema, data ?? {});

    // Return the PDF buffer with proper headers
    const pdfBuffer = new Uint8Array(result.output);
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${schema.metadata.title ?? 'document'}.pdf"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Page-Count': String(result.metadata.pageCount),
        'X-Render-Time': `${result.metadata.renderTimeMs}ms`,
      },
    });
  } catch (error) {
    console.error('PDF render error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `PDF rendering failed: ${message}` },
      { status: 500 },
    );
  }
}

/**
 * GET /api/render-pdf
 * Returns a simple info message (useful for health checks).
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'DocFlow PDF Renderer API. Send POST with { schema, data }.',
  });
}
