import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable
} from '@tanstack/react-table';

import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface DataTableProps<TData, TValue> {
  columns: Array<ColumnDef<TData, TValue>>;
  data: TData[];
  batchSize?: number;
  className?: string;
  rowClassName?: (row: TData, index: number) => string | undefined;
}

function DataTable<TData, TValue>({
  columns,
  data,
  batchSize = 50,
  className,
  rowClassName
}: DataTableProps<TData, TValue>) {
  const deferredData = useDeferredValue(data);
  const [visibleCount, setVisibleCount] = useState(batchSize);
  const loadMoreRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    setVisibleCount(batchSize);
  }, [batchSize, deferredData.length]);

  const table = useReactTable({
    data: deferredData,
    columns,
    getCoreRowModel: getCoreRowModel()
  });

  const rows = table.getRowModel().rows;
  const visibleRows = useMemo(() => rows.slice(0, visibleCount), [rows, visibleCount]);
  const hasMore = visibleRows.length < rows.length;

  useEffect(() => {
    if (!hasMore || !loadMoreRef.current) {
      return undefined;
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisibleCount((current) => Math.min(current + batchSize, rows.length));
      }
    }, {
      rootMargin: '240px 0px'
    });

    observer.observe(loadMoreRef.current);

    return () => observer.disconnect();
  }, [batchSize, hasMore, rows.length]);

  return (
    <div className={cn('overflow-hidden rounded-xl border border-border', className)}>
      <Table>
        <TableHeader className="bg-muted/50">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {visibleRows.map((row, index) => (
            <TableRow key={row.id} className={rowClassName?.(row.original, index)}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
          {hasMore ? (
            <TableRow ref={loadMoreRef}>
              <TableCell className="py-4 text-center text-muted-foreground" colSpan={columns.length}>
                <span className="inline-flex items-center gap-2">
                  <Spinner />
                  正在加载更多...
                </span>
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}

export { DataTable };
