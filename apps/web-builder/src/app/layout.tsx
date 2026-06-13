import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'DocFlow — Visual Document Designer',
  description:
    'Design PDF and HTML documents visually using a block-based editor. Export as a portable JSON schema for programmatic rendering.',
  keywords: ['document builder', 'PDF generator', 'template designer', 'docflow'],
  openGraph: {
    title: 'DocFlow — Visual Document Designer',
    description: 'Design documents visually, compile to PDF or HTML.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased font-sans bg-[#0d0d1f] text-white overflow-hidden">
        {children}
      </body>
    </html>
  );
}
