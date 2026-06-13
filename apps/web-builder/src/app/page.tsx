import Link from 'next/link';
import { FileCode, Layout, FileText, Zap, ChevronRight, Github } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0d0d1f] text-white flex flex-col selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Header */}
      <header className="border-b border-white/5 bg-[#0d0d1f]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <Zap size={16} className="text-white fill-white/10 animate-pulse" />
            </div>
            <span className="text-base font-bold text-white tracking-tight">DocFlow</span>
          </div>

          <nav className="flex items-center gap-6">
            <Link
              href="/editor"
              className="
                flex items-center gap-1.5 px-4 py-2 rounded-lg
                bg-indigo-600 hover:bg-indigo-500 active:scale-95
                text-white text-xs font-semibold shadow-lg shadow-indigo-600/20
                transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500
              "
            >
              Launch Editor
              <ChevronRight size={13} />
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden py-24 md:py-32" aria-labelledby="hero-title">
          {/* Background glowing decorations */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-1/3 left-1/3 w-[300px] h-[300px] bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-6 animate-fade-in">
              Version 1.0.0 Now Available
            </span>

            <h1
              id="hero-title"
              className="text-4xl md:text-6xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-indigo-400 leading-tight mb-6"
            >
              The Block-Based <br />
              <span className="text-indigo-400">Document Engine</span>
            </h1>

            <p className="text-lg md:text-xl text-white/60 font-normal max-w-2xl mx-auto leading-relaxed mb-10">
              Design documents visually with a block editor and compile them programmatically using a clean, portable JSON AST. Pure types, secure template interpolation, and native PDFKit/HTML adaptors.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/editor"
                className="
                  w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl
                  bg-indigo-600 hover:bg-indigo-500 active:scale-98
                  text-white font-semibold text-sm shadow-xl shadow-indigo-600/30
                  transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500
                "
              >
                Start Designing Visuals
                <ChevronRight size={16} />
              </Link>
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="
                  w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl
                  bg-white/5 hover:bg-white/10 active:scale-98 border border-white/10
                  text-white/80 hover:text-white font-semibold text-sm
                  transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/20
                "
              >
                <Github size={16} />
                View Repository
              </a>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 border-t border-white/5 bg-white/[0.01]" aria-labelledby="features-title">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 id="features-title" className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-4">
                Engineered for Visual Speed & Developer Control
              </h2>
              <p className="text-white/50 text-sm max-w-lg mx-auto">
                No templating language constraints. No manual coordinate math. Just elegant abstractions.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-indigo-500/20 hover:bg-white/[0.04] transition-all duration-300 group">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 mb-5">
                  <Layout size={20} />
                </div>
                <h3 className="text-base font-semibold text-white mb-2">Block-Based Editor</h3>
                <p className="text-sm text-white/50 leading-relaxed">
                  Provide non-technical users a clean, responsive web designer. Drag and drop, select layouts, edit content seamlessly.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-indigo-500/20 hover:bg-white/[0.04] transition-all duration-300 group">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 mb-5">
                  <FileCode size={20} />
                </div>
                <h3 className="text-base font-semibold text-white mb-2">Clean JSON AST Schema</h3>
                <p className="text-sm text-white/50 leading-relaxed">
                  Say goodbye to proprietary design layouts. Your designs save as structural JSON schemas, fully validated using Zod at runtime.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-indigo-500/20 hover:bg-white/[0.04] transition-all duration-300 group">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 mb-5">
                  <FileText size={20} />
                </div>
                <h3 className="text-base font-semibold text-white mb-2">Dual Compilation Native Adaptors</h3>
                <p className="text-sm text-white/50 leading-relaxed">
                  Compile schemas programmatically into production-ready PDFs via PDFKit or fully customizable HTML streams.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 bg-[#0d0d1f]">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/40">
          <p>© {new Date().getFullYear()} DocFlow. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/editor" className="hover:text-indigo-400 transition-colors">Launch Designer</Link>
            <a href="https://github.com" className="hover:text-indigo-400 transition-colors">Documentation</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
