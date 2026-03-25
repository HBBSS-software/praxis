import { LoaderCircle } from 'lucide-react';

import { cn } from '@/lib/utils';

function Spinner({ className, ...props }: React.ComponentProps<typeof LoaderCircle>) {
  return <LoaderCircle className={cn('size-4 animate-spin text-muted-foreground', className)} {...props} />;
}

export { Spinner };
