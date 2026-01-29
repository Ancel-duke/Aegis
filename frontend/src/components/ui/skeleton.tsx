import { cn } from '@/lib/utils';
import { Card, CardContent } from './card';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

function Skeleton({
  className,
  ...props
}: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      aria-busy="true"
      aria-label="Loading"
      {...props}
    />
  );
}

function SkeletonCard({ className }: { className?: string }) {
  return (
    <Card className={className} aria-busy="true" aria-label="Loading card">
      <CardContent className="p-6">
        <Skeleton className="h-4 w-24 mb-2" />
        <Skeleton className="h-8 w-16 mb-2" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  );
}

function SkeletonChart({ height = 250 }: { height?: number }) {
  return (
    <div className="w-full" style={{ height }} aria-busy="true" aria-label="Loading chart">
      <Skeleton className="h-full w-full" />
    </div>
  );
}

export { Skeleton, SkeletonCard, SkeletonChart };
