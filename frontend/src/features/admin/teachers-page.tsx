import { ArrowDown, ArrowUp, ChevronDown, FileUp, Pencil, Plus, Trash2, UserPlus, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';

import { ConfirmActionDialog } from '@/components/confirm-action-dialog';
import { DataTable } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
  useComboboxAnchor
} from '@/components/ui/combobox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSession } from '@/lib/auth';
import { ApiResponseError, createApiClient, importUserCsv, unwrapResponse } from '@/lib/api';
import { toastError, toastSuccess } from '@/lib/feedback';
import { formatDateTime, formatDuration } from '@/lib/format';
import { useShiftMultiSelect } from '@/lib/shift-selection';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import type { ClassAssignments, ClassSummary, CreatedUser, CreatedUserPayload, CreatedUsersPayload, CsvImportEntry, CsvImportPreview, StudentSummary, StudentWithClassSummary, TeacherStatistics, UserRole, UserSummary } from '@/lib/types';
import { EmptyState } from '@/shared/empty-state';
import { UserCredentialsResult } from '@/shared/user-credentials-result';
import { AdminPageFrame, Field, SortButton, type CredentialsResult } from './shared';

export function AdminTeachersPage() {
  return <UserListPage role="teacher" title="教师列表" description="管理员可以维护教师信息，并清理无效账号。" />;
}

function UserListPage({
  role,
  title,
  description
}: {
  role: 'student' | 'teacher';
  title: string;
  description: string;
}) {
  const { token, signOut } = useSession();
  const { captureShiftKey, resetSelectionAnchor, updateSelection } = useShiftMultiSelect();
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [sortBy, setSortBy] = useState<'uid-asc' | 'uid-desc' | 'name-asc' | 'name-desc'>('uid-asc');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [editing, setEditing] = useState<UserSummary | null>(null);
  const [form, setForm] = useState({ name: '', password: '' });
  const [batchResetOpen, setBatchResetOpen] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetResult, setResetResult] = useState<CredentialsResult | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserSummary | null>(null);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function loadUsers() {
    if (!token) return;

    try {
      const data = await unwrapResponse<{ users: UserSummary[] }>(createApiClient(token).admin.users.get({ query: { role } }));
      setUsers(data.users);
      setSelectedIds([]);
      resetSelectionAnchor();
    } catch (error) {
      if (error instanceof ApiResponseError && error.status === 401) {
        signOut();
        return;
      }

      toastError(error, '加载账号列表失败。');
    }
  }

  useEffect(() => {
    void loadUsers();
  }, [role, token]);

  const sortedUsers = useMemo(() => {
    return [...users].sort((left, right) => {
      if (sortBy === 'uid-desc') return right.uid.localeCompare(left.uid);
      if (sortBy === 'name-asc') return left.name.localeCompare(right.name);
      if (sortBy === 'name-desc') return right.name.localeCompare(left.name);
      return left.uid.localeCompare(right.uid);
    });
  }, [sortBy, users]);

  const userIds = useMemo(() => sortedUsers.map((user) => user.id), [sortedUsers]);
  const selectedUserIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allSelected = sortedUsers.length > 0 && selectedIds.length === sortedUsers.length;

  const columns = useMemo<Array<ColumnDef<UserSummary>>>(() => [
    {
      id: 'select',
      header: () => (
        <Checkbox
          checked={allSelected}
          onCheckedChange={(checked) => setSelectedIds(checked ? userIds : [])}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={selectedUserIdSet.has(row.original.id)}
          onClick={captureShiftKey}
          onCheckedChange={(checked) =>
            setSelectedIds((current) =>
              updateSelection(userIds, current, row.original.id, checked === true)
            )
          }
        />
      )
    },
    {
      accessorKey: 'uid',
      header: () => (
        <SortButton
          active={sortBy === 'uid-asc' || sortBy === 'uid-desc'}
          descending={sortBy === 'uid-desc'}
          label="UID"
          onClick={() => setSortBy((current) => current === 'uid-asc' ? 'uid-desc' : 'uid-asc')}
        />
      )
    },
    {
      accessorKey: 'name',
      header: () => (
        <SortButton
          active={sortBy === 'name-asc' || sortBy === 'name-desc'}
          descending={sortBy === 'name-desc'}
          label="姓名"
          onClick={() => setSortBy((current) => current === 'name-asc' ? 'name-desc' : 'name-asc')}
        />
      ),
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>
    },
    {
      accessorKey: 'created_at',
      header: '创建时间',
      cell: ({ row }) => <span className="text-muted-foreground">{formatDateTime(row.original.created_at)}</span>
    },
    {
      id: 'actions',
      header: '操作',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditing(row.original);
              setForm({ name: row.original.name, password: '' });
            }}
          >
            编辑
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setDeleteTarget(row.original)}>
            删除
          </Button>
        </div>
      )
    }
  ], [allSelected, captureShiftKey, selectedUserIdSet, sortBy, updateSelection, userIds]);

  return (
    <AdminPageFrame title={title} description={description}>
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {selectedIds.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-slate-100 p-3">
                <p className="mr-2 text-sm text-muted-foreground">已选 {selectedIds.length} 人</p>
                <Button size="sm" onClick={() => setBatchResetOpen(true)}>重置密码</Button>
                <Button size="sm" variant="destructive" onClick={() => setBatchDeleteOpen(true)}>删除</Button>
              </div>
            ) : <div />}
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="uid-asc">UID 从小到大</SelectItem>
                <SelectItem value="uid-desc">UID 从大到小</SelectItem>
                <SelectItem value="name-asc">姓名 A-Z</SelectItem>
                <SelectItem value="name-desc">姓名 Z-A</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {sortedUsers.length === 0 ? (
            <EmptyState title="暂无账号" description="在用户创建页添加账号后，这里会同步显示。" />
          ) : (
            <DataTable columns={columns} data={sortedUsers} />
          )}
          {resetResult ? (
            <UserCredentialsResult
              autoDownload
              users={resetResult.users}
              credentialsCsv={resetResult.credentialsCsv}
              filename="reset_teachers.csv"
              summary={`成功重置 ${resetResult.users.length} 个教师的密码。`}
            />
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑账号</DialogTitle>
            <DialogDescription>密码留空表示不修改。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="姓名">
              <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </Field>
            <Field label="新密码">
              <Input type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} />
            </Field>
            <Button
              onClick={async () => {
                if (!token || !editing) return;

                try {
                  await unwrapResponse(createApiClient(token).admin.users({ id: editing.id }).put({
                    name: form.name.trim(),
                    password: form.password
                  }));
                  setEditing(null);
                  toastSuccess('账号信息已保存。');
                  await loadUsers();
                } catch (error) {
                  if (error instanceof ApiResponseError && error.status === 401) {
                    signOut();
                    return;
                  }

                  toastError(error, '更新失败。');
                }
              }}
            >
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={batchResetOpen}
        onOpenChange={setBatchResetOpen}
        title="确认重置密码"
        description={`将重置当前选中的 ${selectedIds.length} 个教师密码，并下载包含新密码的 CSV 文件。`}
        confirmLabel="重置密码"
        loading={resetLoading}
        onConfirm={async () => {
          if (!token) return;

          try {
            setResetLoading(true);
            const data = await unwrapResponse<CreatedUsersPayload>(
              createApiClient(token).admin.users.password.patch({ ids: selectedIds })
            );
            setBatchResetOpen(false);
            setResetResult({ users: data.users, credentialsCsv: data.credentialsCsv });
            toastSuccess(`已重置 ${data.users.length} 个教师的密码。`);
          } catch (error) {
            if (error instanceof ApiResponseError && error.status === 401) {
              signOut();
              return;
            }

            toastError(error, '重置失败。');
          } finally {
            setResetLoading(false);
          }
        }}
      />

      <ConfirmActionDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        title="确认删除账号"
        description={deleteTarget ? `将删除 ${deleteTarget.name}（${deleteTarget.uid}）账号，删除后不可恢复。` : ''}
        confirmLabel="删除"
        loading={deleteLoading}
        variant="destructive"
        onConfirm={async () => {
          if (!token || !deleteTarget) return;

          try {
            setDeleteLoading(true);
            await unwrapResponse(createApiClient(token).admin.users({ id: deleteTarget.id }).delete());
            setDeleteTarget(null);
            toastSuccess('账号已删除。');
            await loadUsers();
          } catch (error) {
            if (error instanceof ApiResponseError && error.status === 401) {
              signOut();
              return;
            }

            toastError(error, '删除失败。');
          } finally {
            setDeleteLoading(false);
          }
        }}
      />

      <ConfirmActionDialog
        open={batchDeleteOpen}
        onOpenChange={setBatchDeleteOpen}
        title="确认批量删除教师账号"
        description={`将删除当前选中的 ${selectedIds.length} 个教师账号，删除后不可恢复。`}
        confirmLabel="删除"
        loading={deleteLoading}
        variant="destructive"
        onConfirm={async () => {
          if (!token) return;

          try {
            setDeleteLoading(true);
            await unwrapResponse(createApiClient(token).admin.users.delete({ ids: selectedIds }));
            setBatchDeleteOpen(false);
            toastSuccess(`已删除 ${selectedIds.length} 个教师账号。`);
            await loadUsers();
          } catch (error) {
            if (error instanceof ApiResponseError && error.status === 401) {
              signOut();
              return;
            }

            toastError(error, '删除失败。');
          } finally {
            setDeleteLoading(false);
          }
        }}
      />
    </AdminPageFrame>
  );
}
