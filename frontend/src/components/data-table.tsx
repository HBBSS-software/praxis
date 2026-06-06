import { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  type PaginationState,
  useReactTable
} from '@tanstack/react-table';

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from '@/components/ui/pagination';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

type PaginationItemValue = number | 'ellipsis-left' | 'ellipsis-right';

interface DataTableProps<TData, TValue> {
  columns: Array<ColumnDef<TData, TValue>>;
  data: TData[];
  batchSize?: number;
  className?: string;
  pagination?: {
    pageSize?: number;
  };
  rowClassName?: (row: TData, index: number) => string | undefined;
}

function normalizePageSize(pageSize?: number) {
  if (typeof pageSize !== 'number' || !Number.isFinite(pageSize)) {
    return 50;
  }

  const normalizedPageSize = Math.floor(pageSize);

  return normalizedPageSize > 0 ? normalizedPageSize : 50;
}

function getPaginationItems(pageIndex: number, pageCount: number): PaginationItemValue[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const currentPage = pageIndex + 1;
  const pages = new Set([1, pageCount, currentPage - 1, currentPage, currentPage + 1]);

  if (currentPage <= 4) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
    pages.add(5);
  }

  if (currentPage >= pageCount - 3) {
    pages.add(pageCount - 4);
    pages.add(pageCount - 3);
    pages.add(pageCount - 2);
    pages.add(pageCount - 1);
  }

  const sortedPages = Array.from(pages)
    .filter((page) => page >= 1 && page <= pageCount)
    .sort((left, right) => left - right);
  const items: PaginationItemValue[] = [];

  for (const page of sortedPages) {
    const previousPage = items.at(-1);

    if (typeof previousPage === 'number') {
      const gap = page - previousPage;

      if (gap === 2) {
        items.push(previousPage + 1);
      } else if (gap > 2) {
        items.push(previousPage === 1 ? 'ellipsis-left' : 'ellipsis-right');
      }
    }

    items.push(page);
  }

  return items;
}

function DataTableInner<TData, TValue>({
  columns,
  data,
  batchSize = 50,
  className,
  pagination,
  rowClassName
}: DataTableProps<TData, TValue>) {
  const deferredData = useDeferredValue(data);
  const safeBatchSize = normalizePageSize(batchSize);
  const isPaginated = Boolean(pagination);
  const pageSize = normalizePageSize(pagination?.pageSize);
  const [visibleCount, setVisibleCount] = useState(safeBatchSize);
  const [paginationState, setPaginationState] = useState<PaginationState>({ pageIndex: 0, pageSize });
  const loadMoreRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    setVisibleCount(safeBatchSize);
  }, [safeBatchSize, deferredData.length]);

  useEffect(() => {
    setPaginationState({ pageIndex: 0, pageSize });
  }, [deferredData.length, pageSize]);

  const table = useReactTable({
    data: deferredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: isPaginated ? getPaginationRowModel() : undefined,
    onPaginationChange: isPaginated ? setPaginationState : undefined,
    state: isPaginated ? { pagination: paginationState } : undefined
  });

  const rows = table.getRowModel().rows;
  const visibleRows = useMemo(() => isPaginated ? rows : rows.slice(0, visibleCount), [isPaginated, rows, visibleCount]);
  const hasMore = !isPaginated && visibleRows.length < rows.length;
  const pageCount = isPaginated ? table.getPageCount() : 0;
  const currentPageIndex = paginationState.pageIndex;
  const paginationItems = useMemo(
    () => getPaginationItems(currentPageIndex, pageCount),
    [currentPageIndex, pageCount]
  );

  useEffect(() => {
    if (isPaginated || !hasMore || !loadMoreRef.current) {
      return undefined;
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisibleCount((current) => Math.min(current + safeBatchSize, rows.length));
      }
    }, {
      rootMargin: '240px 0px'
    });

    observer.observe(loadMoreRef.current);

    return () => observer.disconnect();
  }, [hasMore, isPaginated, rows.length, safeBatchSize]);

  return (
    <div className={cn('overflow-hidden rounded-3xl bg-card ring-1 ring-foreground/5 dark:ring-foreground/10', className)}>
      <div className="overflow-x-auto">
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
          {visibleRows.length === 0 ? (
            <TableRow>
              <TableCell className="h-24 text-center text-muted-foreground" colSpan={columns.length}>
                暂无数据
              </TableCell>
            </TableRow>
          ) : (
            visibleRows.map((row, index) => (
              <TableRow key={row.id} className={rowClassName?.(row.original, index)}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
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
      {isPaginated && pageCount > 1 ? (
        <div className="border-t px-2 py-3">
          <Pagination>
            <PaginationContent className="flex-wrap">
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  aria-disabled={!table.getCanPreviousPage()}
                  className={cn(!table.getCanPreviousPage() && 'pointer-events-none opacity-50')}
                  onClick={(event) => {
                    event.preventDefault();
                    table.previousPage();
                  }}
                />
              </PaginationItem>
              {paginationItems.map((item) => (
                <PaginationItem key={item}>
                  {typeof item === 'number' ? (
                    <PaginationLink
                      href="#"
                      aria-label={`第 ${item} 页`}
                      isActive={item - 1 === currentPageIndex}
                      onClick={(event) => {
                        event.preventDefault();
                        table.setPageIndex(item - 1);
                      }}
                    >
                      {item}
                    </PaginationLink>
                  ) : (
                    <PaginationEllipsis />
                  )}
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  aria-disabled={!table.getCanNextPage()}
                  className={cn(!table.getCanNextPage() && 'pointer-events-none opacity-50')}
                  onClick={(event) => {
                    event.preventDefault();
                    table.nextPage();
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      ) : null}
    </div>
  );
}

const DataTable = memo(DataTableInner) as typeof DataTableInner;

export { DataTable };
