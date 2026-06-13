import { CheckCircle2, Circle } from 'lucide-react';

import { getPasswordRequirementStates } from '@/lib/api';
import { cn } from '@/lib/utils';

export function PasswordRequirements({
  password,
  isProduction
}: {
  password: string;
  isProduction: boolean;
}) {
  if (!isProduction) {
    return null;
  }

  return (
    <div className="grid gap-1.5 rounded-md border bg-muted/30 p-3 text-sm" aria-label="密码要求">
      {getPasswordRequirementStates(password).map((item) => {
        const Icon = item.met ? CheckCircle2 : Circle;

        return (
          <div
            key={item.id}
            className={cn(
              'flex items-center gap-2',
              item.met ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span>{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}
