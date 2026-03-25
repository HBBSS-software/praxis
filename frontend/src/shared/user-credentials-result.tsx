import { Download } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import type { ColumnDef } from '@tanstack/react-table';

import { DataTable } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import type { CreatedUser } from '@/lib/types';

function UserCredentialsResult({
  users,
  filename,
  autoDownload = false,
  summary
}: {
  users: CreatedUser[];
  filename: string;
  autoDownload?: boolean;
  summary: string;
}) {
  const downloadRef = useRef<HTMLAnchorElement | null>(null);
  const csvData = useMemo(() => `name,uid,role,password\n${users.map((user) => `${user.name},${user.uid},${user.role},${user.password}`).join('\n')}`, [users]);
  const downloadUrl = useMemo(() => URL.createObjectURL(new Blob([csvData], { type: 'text/csv' })), [csvData]);

  useEffect(() => () => URL.revokeObjectURL(downloadUrl), [downloadUrl]);

  useEffect(() => {
    if (autoDownload && users.length > 0) {
      downloadRef.current?.click();
    }
  }, [autoDownload, downloadUrl, users.length]);

  const columns = useMemo<Array<ColumnDef<CreatedUser>>>(() => [
    { accessorKey: 'name', header: '姓名' },
    { accessorKey: 'uid', header: 'UID' },
    { accessorKey: 'role', header: '角色' },
    {
      accessorKey: 'password',
      header: '密码',
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.password}</span>
    }
  ], []);

  return (
    <div className="space-y-4 rounded-xl bg-muted/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{summary}</p>
        <Button variant="secondary" asChild>
          <a ref={downloadRef} href={downloadUrl} download={filename}>
            <Download className="size-4" />
            下载 CSV
          </a>
        </Button>
      </div>
      <DataTable batchSize={20} columns={columns} data={users} />
    </div>
  );
}

export { UserCredentialsResult };
