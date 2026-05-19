import { ArrowDown, ArrowUp, CheckCircle2, Clock3, FilePenLine, RefreshCw, UserRoundCog, Users, X } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';

import { useSession } from '@/lib/auth';
import { DatePickerField } from '@/shared/date-picker-field';
import { EmptyState } from '@/shared/empty-state';
import { AuthenticatedImage } from '@/shared/authenticated-image';
import { StatCard } from '@/shared/stat-card';
import { ConfirmActionDialog } from '@/components/confirm-action-dialog';
import { DataTable } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { ApiResponseError, createApiClient, unwrapResponse } from '@/lib/api';
import { toastError, toastSuccess } from '@/lib/feedback';
import { formatDate, formatDateTime, formatDuration, normalizeDateInputValue, statusLabel } from '@/lib/format';
import { useShiftMultiSelect } from '@/lib/shift-selection';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import type { ClassSummary, CreatedUser, CreatedUsersPayload, StudentSummary, StudentWithClassSummary, TeacherRecord, TeacherRecordSummary, TeacherStatistics, UserSummary } from '@/lib/types';
import { UserCredentialsResult } from '@/shared/user-credentials-result';
import { defaultFilters, ErrorCard, Field, FilterSelect, LoadingCard, PageFrame, RecordPreview, StatusBadge, StudentMultiCombobox, toStudentOption, UserMultiCombobox } from './shared';

export function TeacherDashboardPage() {
  const { token, signOut, user } = useSession();
  const { captureShiftKey, resetSelectionAnchor, updateSelection } = useShiftMultiSelect();
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [filters, setFilters] = useState(defaultFilters);
  const [records, setRecords] = useState<TeacherRecordSummary[]>([]);
  const [statistics, setStatistics] = useState<TeacherStatistics | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [reviewRecord, setReviewRecord] = useState<TeacherRecord | null>(null);
  const [editRecord, setEditRecord] = useState<TeacherRecord | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [reviewComment, setReviewComment] = useState('');
  const [editForm, setEditForm] = useState({
    title: '',
    content: '',
    practice_date: '',
    duration: '',
    location: ''
  });
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<TeacherRecordSummary | null>(null);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const recordIds = useMemo(() => records.map((record) => record.id), [records]);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allSelected = records.length > 0 && selectedIds.length === records.length;
  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.student_ids.length > 0) params.set('student_ids', filters.student_ids.join(','));
    if (filters.class_ids.length > 0) params.set('class_ids', filters.class_ids.join(','));
    if (filters.status) params.set('status', filters.status);
    if (filters.practice_after) params.set('practice_after', filters.practice_after);
    if (filters.practice_before) params.set('practice_before', filters.practice_before);
    if (filters.created_after) params.set('created_after', new Date(filters.created_after).toISOString());
    if (filters.created_before) {
      const end = new Date(filters.created_before);
      end.setHours(23, 59, 59, 999);
      params.set('created_before', end.toISOString());
    }
    return params.toString();
  }, [filters]);

  const searchStudents = useCallback(async (searchQuery: string) => {
    if (!token) return [];

    try {
      const data = await unwrapResponse<{ students: StudentWithClassSummary[] }>(
        createApiClient(token).teacher.students.search({
          query: {
            q: searchQuery.trim() || undefined,
            class_ids: user?.role === 'admin' && filters.class_ids.length > 0 ? filters.class_ids.join(',') : undefined
          }
        })
      );
      return data.students.map(toStudentOption);
    } catch (nextError) {
      if (nextError instanceof ApiResponseError && nextError.status === 401) signOut();
      return [];
    }
  }, [filters.class_ids, signOut, token, user?.role]);

  const searchClasses = useCallback(async (searchQuery: string) => {
    if (!token || user?.role !== 'admin') return [];

    try {
      const normalized = searchQuery.trim().toLowerCase();
      const nextClasses = classes.length > 0
        ? classes
        : (await unwrapResponse<{ classes: ClassSummary[] }>(createApiClient(token).admin.classes.get())).classes;

      if (classes.length === 0) {
        setClasses(nextClasses);
      }

      return nextClasses
        .filter((item) => !normalized || item.name.toLowerCase().includes(normalized) || item.cid.toLowerCase().includes(normalized))
        .map((item) => ({
          label: `${item.name} (${item.cid})`,
          value: String(item.id)
        }));
    } catch (nextError) {
      if (nextError instanceof ApiResponseError && nextError.status === 401) signOut();
      return [];
    }
  }, [classes, signOut, token, user?.role]);

  async function loadRecords() {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await unwrapResponse<{ records: TeacherRecordSummary[] }>(
        createApiClient(token).teacher.records.get({
          query: {
            student_ids: filters.student_ids.length > 0 ? filters.student_ids.join(',') : undefined,
            class_ids: filters.class_ids.length > 0 ? filters.class_ids.join(',') : undefined,
            status: filters.status ? (filters.status as 'approved' | 'pending' | 'rejected') : undefined,
            practice_after: filters.practice_after || undefined,
            practice_before: filters.practice_before || undefined,
            created_after: filters.created_after ? new Date(filters.created_after).toISOString() : undefined,
            created_before: filters.created_before ? (() => {
              const end = new Date(filters.created_before);
              end.setHours(23, 59, 59, 999);
              return end.toISOString();
            })() : undefined
          }
        })
      );
      setRecords(data.records);
      setSelectedIds([]);
      resetSelectionAnchor();
    } catch (nextError) {
      if (nextError instanceof ApiResponseError && nextError.status === 401) {
        signOut();
        return;
      }
      setError(nextError instanceof Error ? nextError.message : '加载记录失败。');
    } finally {
      setLoading(false);
    }
  }

  async function loadStatistics() {
    if (!token) return;
    setStatsLoading(true);
    try {
      const data = await unwrapResponse<{ statistics: TeacherStatistics }>(createApiClient(token).teacher.statistics.get());
      setStatistics(data.statistics);
    } catch (nextError) {
      if (nextError instanceof ApiResponseError && nextError.status === 401) signOut();
    } finally {
      setStatsLoading(false);
    }
  }

  useEffect(() => {
    void loadRecords();
  }, [query, token]);

  useEffect(() => {
    void loadStatistics();
  }, [token]);

  const columns = useMemo<Array<ColumnDef<TeacherRecordSummary>>>(() => [
    {
      id: 'select',
      header: () => <Checkbox checked={allSelected} onCheckedChange={(checked) => setSelectedIds(checked ? recordIds : [])} />,
      cell: ({ row }) => (
        <Checkbox
          checked={selectedIdSet.has(row.original.id)}
          onClick={captureShiftKey}
          onCheckedChange={(checked) =>
            setSelectedIds((current) =>
              updateSelection(
                recordIds,
                current,
                row.original.id,
                checked === true
              )
            )
          }
        />
      )
    },
    {
      id: 'student',
      header: '学生',
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.student_name}</p>
          <p className="text-xs text-muted-foreground">{row.original.student_uid}</p>
        </div>
      )
    },
    { accessorKey: 'title', header: '标题' },
    {
      accessorKey: 'practice_date',
      header: '实践日期',
      cell: ({ row }) => formatDate(row.original.practice_date)
    },
    {
      id: 'status',
      header: '状态',
      cell: ({ row }) => <StatusBadge status={row.original.status} />
    },
    {
      accessorKey: 'created_at',
      header: '上传日期',
      cell: ({ row }) => <span className="text-muted-foreground">{formatDateTime(row.original.created_at)}</span>
    },
    {
      id: 'actions',
      header: '操作',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void openReview(row.original.id)}>审核</Button>
          <Button size="sm" variant="outline" onClick={() => void openEdit(row.original.id)}>编辑</Button>
          <Button size="sm" variant="destructive" onClick={() => setDeleteTarget(row.original)}>删除</Button>
        </div>
      )
    }
  ], [allSelected, captureShiftKey, recordIds, selectedIdSet, updateSelection]);

  return (
    <PageFrame
      title={user?.role === 'admin' ? '记录管理' : '审核中心'}
      description={user?.role === 'admin' ? '管理员可以查看并审核全部实践记录，支持按学生、实践日期、上传日期和状态筛选，以及批量处理。' : '保留原有审核、编辑、删除和批量处理逻辑，支持按学生、实践日期和上传日期筛选。'}
      action={<Button variant="secondary" onClick={() => { void loadRecords(); void loadStatistics(); }}><RefreshCw className="size-4" />刷新数据</Button>}
    >
      {statistics ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="记录总数" value={String(statistics.total_records)} hint="当前可见范围内的全部记录" icon={FilePenLine} />
          <StatCard title="待审核" value={String(statistics.pending_count)} hint="需要尽快处理" icon={Clock3} />
          <StatCard title="已通过" value={String(statistics.approved_count)} hint="通过后计入时长" icon={CheckCircle2} />
          <StatCard title="学生人数" value={String(statistics.student_count)} hint={statsLoading ? '统计中...' : '当前可见学生数量'} icon={Users} />
        </div>
      ) : null}

      <div className="min-w-0">
        <Card>
          <CardHeader>
            <CardTitle>记录筛选</CardTitle>
            <CardDescription>筛选条件会即时刷新列表。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {user?.role === 'admin' ? (
                <UserMultiCombobox
                  label="班级"
                  value={filters.class_ids}
                  loadOptions={searchClasses}
                  onChange={(value) => setFilters((current) => ({ ...current, class_ids: value, student_ids: [] }))}
                />
              ) : null}
              <StudentMultiCombobox
                label="学生"
                value={filters.student_ids}
                loadOptions={searchStudents}
                onChange={(value) => setFilters((current) => ({ ...current, student_ids: value }))}
              />
              <FilterSelect
                label="状态"
                value={filters.status}
                options={[
                  { label: '全部状态', value: '' },
                  { label: '待审核', value: 'pending' },
                  { label: '已通过', value: 'approved' },
                  { label: '已驳回', value: 'rejected' }
                ]}
                onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
              />
              <Field label="实践日期起始">
                <DatePickerField value={filters.practice_after} onChange={(value) => setFilters((current) => ({ ...current, practice_after: value }))} />
              </Field>
              <Field label="实践日期结束">
                <DatePickerField value={filters.practice_before} onChange={(value) => setFilters((current) => ({ ...current, practice_before: value }))} />
              </Field>
              <Field label="上传日期起始">
                <DatePickerField value={filters.created_after} onChange={(value) => setFilters((current) => ({ ...current, created_after: value }))} />
              </Field>
              <Field label="上传日期结束">
                <DatePickerField value={filters.created_before} onChange={(value) => setFilters((current) => ({ ...current, created_before: value }))} />
              </Field>
            </div>

            {selectedIds.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-slate-100 p-3">
                <p className="mr-2 text-sm text-[color:var(--muted-foreground)]">已选 {selectedIds.length} 条</p>
                <Button size="sm" onClick={() => void runBatchAction('approved')}>批量通过</Button>
                <Button size="sm" variant="outline" onClick={() => void runBatchAction('rejected')}>批量驳回</Button>
                <Button size="sm" variant="secondary" onClick={() => void runBatchAction('pending')}>撤回待审核</Button>
                <Button size="sm" variant="destructive" onClick={() => setBatchDeleteOpen(true)}>批量删除</Button>
              </div>
            ) : null}

            {loading ? (
              <LoadingCard label="正在加载记录列表..." />
            ) : error ? (
              <ErrorCard message={error} onRetry={() => void loadRecords()} />
            ) : records.length === 0 ? (
              <EmptyState title="暂无记录" description="当前筛选条件下没有找到对应的实践记录。" />
            ) : (
              <DataTable batchSize={60} columns={columns} data={records} />
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(reviewRecord)} onOpenChange={(open) => !open && setReviewRecord(null)}>
        <DialogContent>
          {reviewRecord ? (
            <>
              <DialogHeader>
                <DialogTitle>审核记录</DialogTitle>
                <DialogDescription>{reviewRecord.student_name} · {reviewRecord.student_uid}</DialogDescription>
              </DialogHeader>
              <RecordPreview record={reviewRecord} />
              <div className="space-y-2">
                <Label>审核评语</Label>
                <Textarea value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void submitReview('approved')}>通过</Button>
                <Button variant="outline" onClick={() => void submitReview('rejected')}>驳回</Button>
                <Button variant="secondary" onClick={() => void submitReview('pending')}>撤回待审核</Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={editLoading || Boolean(editRecord)}
        onOpenChange={(open) => {
          if (!open) {
            setEditLoading(false);
            setEditRecord(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          {editRecord ? (
            <>
              <DialogHeader>
                <DialogTitle>编辑记录</DialogTitle>
                <DialogDescription>保留原有教师端编辑逻辑。</DialogDescription>
              </DialogHeader>
              <div className="space-y-5">
                <Field label="标题"><Input value={editForm.title} onChange={(event) => setEditForm((current) => ({ ...current, title: event.target.value }))} /></Field>
                <Field label="内容"><Textarea value={editForm.content} onChange={(event) => setEditForm((current) => ({ ...current, content: event.target.value }))} /></Field>
                <div className="grid gap-5 md:grid-cols-3">
                  <Field label="日期"><DatePickerField value={editForm.practice_date} onChange={(value) => setEditForm((current) => ({ ...current, practice_date: value }))} /></Field>
                  <Field label="时长"><Input type="number" step="0.1" min="0.1" value={editForm.duration} onChange={(event) => setEditForm((current) => ({ ...current, duration: event.target.value }))} /></Field>
                  <Field label="地点"><Input value={editForm.location} onChange={(event) => setEditForm((current) => ({ ...current, location: event.target.value }))} /></Field>
                </div>
                <Button className="w-full sm:w-auto" onClick={() => void saveEdit()}>保存修改</Button>
              </div>
            </>
          ) : editLoading ? (
            <LoadingCard label="正在加载记录详情..." />
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        title="确认删除记录"
        description={deleteTarget ? `将删除《${deleteTarget.title}》，删除后不可恢复。` : ''}
        confirmLabel="删除"
        loading={deleteLoading}
        variant="destructive"
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteRecord(deleteTarget.id);
        }}
      />

      <ConfirmActionDialog
        open={batchDeleteOpen}
        onOpenChange={setBatchDeleteOpen}
        title="确认批量删除记录"
        description={`将删除当前选中的 ${selectedIds.length} 条记录，删除后不可恢复。`}
        confirmLabel="批量删除"
        loading={deleteLoading}
        variant="destructive"
        onConfirm={async () => {
          await runBatchAction('deleted');
        }}
      />
    </PageFrame>
  );

  async function openReview(recordId: number) {
    if (!token) return;
    try {
      const data = await unwrapResponse<{ record: TeacherRecord }>(createApiClient(token).teacher.records({ id: recordId }).get());
      setReviewRecord(data.record);
      setReviewComment(data.record.teacher_comment ?? '');
    } catch (nextError) {
      if (nextError instanceof ApiResponseError && nextError.status === 401) {
        signOut();
        return;
      }
      toastError(nextError, '加载记录详情失败。');
    }
  }

  async function openEdit(recordId: number) {
    if (!token) return;
    setEditLoading(true);
    setEditRecord(null);
    try {
      const data = await unwrapResponse<{ record: TeacherRecord }>(createApiClient(token).teacher.records({ id: recordId }).get());
      setEditRecord(data.record);
      setEditForm({
        title: data.record.title,
        content: data.record.content,
        practice_date: normalizeDateInputValue(data.record.practice_date),
        duration: String(data.record.duration ?? ''),
        location: data.record.location ?? ''
      });
    } catch (nextError) {
      if (nextError instanceof ApiResponseError && nextError.status === 401) {
        signOut();
        return;
      }
      setEditLoading(false);
      toastError(nextError, '加载记录详情失败。');
      return;
    }
    setEditLoading(false);
  }

  async function submitReview(status: 'approved' | 'rejected' | 'pending') {
    if (!token || !reviewRecord) return;
    try {
      await unwrapResponse(
        createApiClient(token).teacher.records({ id: reviewRecord.id }).review.put({
          status,
          comment: reviewComment.trim()
        })
      );
      setReviewRecord(null);
      setReviewComment('');
      toastSuccess('审核结果已保存。');
      await Promise.all([loadRecords(), loadStatistics()]);
    } catch (nextError) {
      if (nextError instanceof ApiResponseError && nextError.status === 401) {
        signOut();
        return;
      }
      toastError(nextError, '保存审核结果失败。');
    }
  }

  async function runBatchAction(action: 'approved' | 'rejected' | 'pending' | 'deleted') {
    if (!token) return;
    try {
      await unwrapResponse(createApiClient(token).teacher.records['batch-review'].post({ ids: selectedIds, action }));
      if (action === 'deleted') {
        setBatchDeleteOpen(false);
        toastSuccess(`已删除 ${selectedIds.length} 条记录。`);
      } else {
        toastSuccess(`已处理 ${selectedIds.length} 条记录。`);
      }
      await Promise.all([loadRecords(), loadStatistics()]);
    } catch (nextError) {
      if (nextError instanceof ApiResponseError && nextError.status === 401) {
        signOut();
        return;
      }
      toastError(nextError, '批量操作失败。');
    }
  }

  async function saveEdit() {
    if (!token || !editRecord) return;
    try {
      await unwrapResponse(
        createApiClient(token).teacher.records({ id: editRecord.id }).put({
          title: editForm.title.trim(),
          content: editForm.content.trim(),
          practice_date: editForm.practice_date,
          duration: editForm.duration,
          location: editForm.location.trim() || null
        })
      );
      setEditRecord(null);
      toastSuccess('记录修改已保存。');
      await loadRecords();
    } catch (nextError) {
      if (nextError instanceof ApiResponseError && nextError.status === 401) {
        signOut();
        return;
      }
      toastError(nextError, '保存修改失败。');
    }
  }

  async function deleteRecord(recordId: number) {
    if (!token) return;
    try {
      setDeleteLoading(true);
      await unwrapResponse(createApiClient(token).teacher.records({ id: recordId }).delete());
      setDeleteTarget(null);
      toastSuccess('记录已删除。');
      await Promise.all([loadRecords(), loadStatistics()]);
    } catch (nextError) {
      if (nextError instanceof ApiResponseError && nextError.status === 401) {
        signOut();
        return;
      }
      toastError(nextError, '删除失败。');
    } finally {
      setDeleteLoading(false);
    }
  }
}
