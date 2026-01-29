'use client';

import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" role="alert">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-red-500" aria-hidden="true" />
            <CardTitle>Something went wrong</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            An unexpected error occurred. Please try refreshing the page or contact support if the problem persists.
          </p>
          
          {process.env.NODE_ENV === 'development' && error && (
            <details className="mt-4">
              <summary className="text-sm font-medium cursor-pointer mb-2">
                Error Details (Development Only)
              </summary>
              <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-40" aria-live="polite">
                {error.toString()}
                {error.stack}
              </pre>
            </details>
          )}

          <div className="flex gap-2 pt-4">
            <Button
              onClick={resetErrorBoundary}
              variant="default"
              className="flex-1"
              aria-label="Try again"
            >
              <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
              Try Again
            </Button>
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              className="flex-1"
              aria-label="Reload page"
            >
              Reload Page
            </Button>
            <Link href="/dashboard">
              <Button
                variant="ghost"
                aria-label="Go to dashboard"
              >
                <Home className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function AppErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error, errorInfo) => {
        console.error('Error caught by boundary:', error, errorInfo);
        // You can log to error reporting service here
      }}
      onReset={() => {
        // Reset any state or navigation if needed
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
}
