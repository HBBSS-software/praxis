import { CalendarIcon, XIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export function DatePickerField({
  value,
  onChange,
  placeholder = '选择日期',
  className
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const selectedDate = value ? new Date(`${value}T00:00:00`) : undefined;

  return (
    <div className={cn('relative w-full', className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-start gap-2 pr-16 text-left font-normal">
            <span className={value ? 'text-foreground' : 'text-muted-foreground'}>
              {value || placeholder}
            </span>
            <CalendarIcon className="ml-auto size-4 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => {
              onChange(date ? date.toLocaleDateString('sv-SE') : '');
            }}
          />
        </PopoverContent>
      </Popover>
      {value ? (
        <Button
          size="icon-sm"
          type="button"
          variant="ghost"
          className="absolute right-8 top-1/2 z-10 -translate-y-1/2"
          onClick={() => onChange('')}
        >
          <XIcon className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}
