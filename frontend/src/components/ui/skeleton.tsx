import { cn } from '@/lib/utils';
import { Card, CardContent } from './card';

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  );
}

function SkeletonCard() {
  return (
    <Card>
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
    <div className="w-full" style={{ height }}>
      <Skeleton className="h-full w-full" />
    </div>
  );
}

export { Skeleton, SkeletonCard, SkeletonChart };
