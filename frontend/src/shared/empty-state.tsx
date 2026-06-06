import type { ReactNode } from 'react';

import { Card, CardContent } from '@/components/ui/card';

export function EmptyState({
  title,
  description,
  action
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Card variant="dashed">
      <CardContent className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <div className="size-6 rounded-full border-2 border-current opacity-70" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold">{title}</h3>
          {description ? <p className="max-w-lg text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </CardContent>
    </Card>
  );
}
