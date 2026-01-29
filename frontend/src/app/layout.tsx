import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { Toaster } from '@/components/ui/toaster';
import { AppErrorBoundary } from './error-boundary';
import { SkipLink } from '@/components/accessibility/skip-link';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Aegis - Self-Healing Platform',
  description: 'AI-powered self-healing and observability platform for Kubernetes',
  keywords: ['kubernetes', 'observability', 'ai', 'self-healing', 'monitoring'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <AppErrorBoundary>
          <SkipLink />
          <Providers>
            {children}
            <Toaster />
          </Providers>
        </AppErrorBoundary>
      </body>
    </html>
  );
}
