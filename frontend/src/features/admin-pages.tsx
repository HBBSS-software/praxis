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
import type { ClassAssignments, ClassSummary, CreatedUser, CsvImportEntry, CsvImportPreview, StudentSummary, StudentWithClassSummary, TeacherStatistics, UserRole, UserSummary } from '@/lib/types';
import { EmptyState } from '@/shared/empty-state';
import { UserCredentialsResult } from '@/shared/user-credentials-result';

const comboboxPageSize = 50;

function AdminPageFrame({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-6">
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

export function AdminUsersPage() {
  const { token, signOut } = useSession();
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [singleForm, setSingleForm] = useState({ name: '', role: 'student' as UserRole, class_id: null as number | null });
  const [singleResult, setSingleResult] = useState<CreatedUser | null>(null);
  const [csvFileName, setCsvFileName] = useState('');
  const [csvEncoding, setCsvEncoding] = useState<CsvImportPreview['encoding'] | null>(null);
  const [csvResult, setCsvResult] = useState<CreatedUser[]>([]);
  const [csvImporting, setCsvImporting] = useState(false);
  const [batchEntries, setBatchEntries] = useState([{ name: '', role: 'student' as UserRole, class_id: null as number | null }]);
  const [batchResult, setBatchResult] = useState<CreatedUser[]>([]);

  useEffect(() => {
    if (!token) return;

    unwrapResponse<{ classes: ClassSummary[] }>(createApiClient(token).admin.classes.get())
      .then((data) => setClasses(data.classes))
      .catch((error) => {
        if (error instanceof ApiResponseError && error.status === 401) {
          signOut();
          return;
        }

        toastError(error, '加载班级列表失败。');
      });
  }, [signOut, token]);

  return (
    <AdminPageFrame title="用户创建" description="管理员可以单个创建、批量填写或导入 CSV 创建账号，并下载生成结果。">
      <Tabs defaultValue="single">
        <TabsList className="grid h-auto w-full grid-cols-1 sm:grid-cols-3">
          <TabsTrigger value="single">单个创建</TabsTrigger>
          <TabsTrigger value="csv">CSV 导入</TabsTrigger>
          <TabsTrigger value="batch">批量填写</TabsTrigger>
        </TabsList>

        <TabsContent value="single" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>单个创建</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="姓名">
                  <Input value={singleForm.name} onChange={(event) => setSingleForm((current) => ({ ...current, name: event.target.value }))} />
                </Field>
                <SelectRole value={singleForm.role} onChange={(role) => setSingleForm((current) => ({ ...current, role }))} />
                <SelectClass
                  classes={classes}
                  value={singleForm.class_id}
                  disabled={singleForm.role !== 'student'}
                  onChange={(class_id) => setSingleForm((current) => ({ ...current, class_id }))}
                />
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={async () => {
                    if (!token) return;

                    try {
                      const data = await unwrapResponse<{ message: string; user: CreatedUser }>(createApiClient(token).admin.users.post(singleForm));
                      setSingleResult(data.user);
                      toastSuccess('账号创建成功。');
                    } catch (error) {
                      if (error instanceof ApiResponseError && error.status === 401) {
                        signOut();
                        return;
                      }

                      toastError(error, '创建失败。');
                    }
                  }}
                >
                  <UserPlus className="size-4" />
                  创建账号
                </Button>
              </div>
              {singleResult ? <UserCredentialsResult users={[singleResult]} filename="created_user.csv" summary="成功生成 1 个账号。" /> : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="csv" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1.5">
                  <CardTitle>CSV 导入</CardTitle>
                  <CardDescription>不包含表头，格式参见<CsvImportExampleDialog />。支持 UTF-8、UTF-16 和 GBK 编码。</CardDescription>
                </div>
                <CsvImportExampleDialog />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                ref={csvInputRef}
                className="hidden"
                type="file"
                accept=".csv,text/csv"
                onChange={async (event) => {
                  if (!token) return;

                  const file = event.target.files?.[0];
                  if (!file) return;

                  setCsvResult([]);
                  setCsvFileName('');
                  setCsvEncoding(null);

                  if (file.size > 50 * 1024 * 1024) {
                    toastError(new Error('CSV 文件不能超过 50 MiB。'));
                    event.currentTarget.value = '';
                    return;
                  }

                  if (!file.name.toLowerCase().endsWith('.csv')) {
                    toastError(new Error('请上传 .csv 文件。'));
                    event.currentTarget.value = '';
                    return;
                  }

                  try {
                    setCsvImporting(true);
                    const data = await importUserCsv(file, token);
                    setCsvResult(data.users);
                    setCsvFileName(file.name);
                    setCsvEncoding(data.encoding);
                    toastSuccess(`成功导入 ${data.users.length} 个账号。`);
                  } catch (error) {
                    if (error instanceof ApiResponseError && error.status === 401) {
                      signOut();
                      return;
                    }

                    toastError(error, '导入失败。');
                  } finally {
                    setCsvImporting(false);
                    event.currentTarget.value = '';
                  }
                }}
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button disabled={csvImporting} onClick={() => csvInputRef.current?.click()}>
                  {csvImporting ? <Spinner className="size-4 text-current" /> : <FileUp className="size-4" />}
                  {csvImporting ? '导入中...' : '选择 CSV 并导入'}
                </Button>
                {csvFileName ? (
                  <p className="text-sm text-muted-foreground">
                    最近导入：{csvFileName}{csvEncoding ? ` · ${formatCsvEncoding(csvEncoding)}` : ''}
                  </p>
                ) : null}
              </div>
              {csvResult.length ? <UserCredentialsResult users={csvResult} filename="imported_users.csv" summary={`成功生成 ${csvResult.length} 个账号。`} /> : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="batch" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>批量填写</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {batchEntries.map((entry, index) => (
                  <div key={`${index}-${entry.role}`} className="grid gap-3 rounded-xl bg-muted/40 p-4 md:grid-cols-[1.2fr_1fr_1fr_auto]">
                    <Input
                      value={entry.name}
                      onChange={(event) =>
                        setBatchEntries((current) =>
                          current.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item)
                        )
                      }
                      placeholder="姓名"
                    />
                    <Select
                      value={entry.role}
                      onValueChange={(value) =>
                        setBatchEntries((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, role: value as UserRole, class_id: value === 'student' ? item.class_id : null }
                              : item
                          )
                        )
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="student">学生</SelectItem>
                        <SelectItem value="teacher">教师</SelectItem>
                        <SelectItem value="admin">管理员</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={entry.class_id ? String(entry.class_id) : '__none__'}
                      disabled={entry.role !== 'student'}
                      onValueChange={(value) =>
                        setBatchEntries((current) =>
                          current.map((item, itemIndex) => itemIndex === index ? { ...item, class_id: value === '__none__' ? null : Number(value) } : item)
                        )
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="班级" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">不分配班级</SelectItem>
                        {classes.map((item) => (
                          <SelectItem key={item.id} value={String(item.id)}>
                            {item.name} ({item.cid})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setBatchEntries((current) => current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => setBatchEntries((current) => [...current, { name: '', role: 'student', class_id: null }])}>
                  <Plus className="size-4" />
                  新增一行
                </Button>
                <Button
                  onClick={async () => {
                    if (!token) return;

                    const entries = batchEntries.filter((entry) => entry.name.trim());
                    if (entries.length === 0) {
                      toastError(new Error('请至少填写一条有效记录。'));
                      return;
                    }

                    try {
                      const data = await unwrapResponse<{ message: string; users: CreatedUser[] }>(createApiClient(token).admin.users.batch.post({ entries }));
                      setBatchResult(data.users);
                      toastSuccess(`成功创建 ${data.users.length} 个账号。`);
                    } catch (error) {
                      if (error instanceof ApiResponseError && error.status === 401) {
                        signOut();
                        return;
                      }

                      toastError(error, '批量创建失败。');
                    }
                  }}
                >
                  批量创建
                </Button>
              </div>
              {batchResult.length ? <UserCredentialsResult users={batchResult} filename="batch_created_users.csv" summary={`成功生成 ${batchResult.length} 个账号。`} /> : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminPageFrame>
  );
}

export function AdminAssignmentsPage() {
  const { token, signOut } = useSession();
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [teachers, setTeachers] = useState<UserSummary[]>([]);
  const [students, setStudents] = useState<StudentWithClassSummary[]>([]);
  const [assignments, setAssignments] = useState<ClassAssignments>({ teachers: [], students: [] });
  const [visibleCount, setVisibleCount] = useState(comboboxPageSize);
  const [creating, setCreating] = useState(false);
  const [editingClassId, setEditingClassId] = useState<number | null>(null);

  async function loadData() {
    if (!token) return;

    try {
      const api = createApiClient(token);
      const [assignmentData, studentData] = await Promise.all([
        unwrapResponse<{ classes: ClassSummary[]; assignments: ClassAssignments; teachers: UserSummary[] }>(api.admin.classes.get()),
        unwrapResponse<{ students: StudentWithClassSummary[] }>(api.admin.classes.students.get({ query: { scope: 'all' } }))
      ]);
      setClasses(assignmentData.classes);
      setAssignments(assignmentData.assignments);
      setTeachers(assignmentData.teachers);
      setStudents(studentData.students);
    } catch (error) {
      if (error instanceof ApiResponseError && error.status === 401) {
        signOut();
        return;
      }

      toastError(error, '加载分配关系失败。');
    }
  }

  useEffect(() => {
    void loadData();
  }, [token]);

  const teacherMap = useMemo(() => new Map(teachers.map((teacher) => [teacher.id, teacher])), [teachers]);
  const classTeacherMap = useMemo(() => {
    const next = new Map<number, number[]>();

    for (const assignment of assignments.teachers) {
      next.set(assignment.class_id, [...(next.get(assignment.class_id) ?? []), assignment.teacher_id]);
    }

    return next;
  }, [assignments.teachers]);
  const classStudentMap = useMemo(() => {
    const next = new Map<number, StudentWithClassSummary[]>();

    for (const student of students) {
      if (!student.class_id) continue;
      next.set(student.class_id, [...(next.get(student.class_id) ?? []), student]);
    }

    return next;
  }, [students]);
  const visibleClasses = useMemo(() => classes.slice(0, visibleCount), [classes, visibleCount]);

  function loadMoreClasses(event: React.UIEvent<HTMLDivElement>) {
    const element = event.currentTarget;

    if (element.scrollTop + element.clientHeight < element.scrollHeight - 48) {
      return;
    }

    setVisibleCount((current) => Math.min(current + comboboxPageSize, classes.length));
  }

  return (
    <AdminPageFrame title="班级管理" description="管理员可以创建班级，并维护每个班级的教师和学生。">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          添加班级
        </Button>
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-4xl">
          <ClassEditorCard
            mode="create"
            teachers={teachers}
            token={token}
            signOut={signOut}
            onCancel={() => setCreating(false)}
            onSave={async (name, teacherIds, studentIds) => {
              if (!token) return;

              const data = await unwrapResponse<{ class: ClassSummary }>(createApiClient(token).admin.classes.post({ name }));
              if (teacherIds.length > 0) {
                await unwrapResponse(createApiClient(token).admin.classes.assignTeachers({ class_id: data.class.id, teacher_ids: teacherIds }));
              }
              if (studentIds.length > 0) {
                await unwrapResponse(createApiClient(token).admin.classes.assignStudents({ class_id: data.class.id, student_ids: studentIds }));
              }
              setCreating(false);
              toastSuccess('班级已创建。');
              await loadData();
            }}
          />
        </DialogContent>
      </Dialog>

      <div className="max-h-[calc(100vh-220px)] space-y-4 overflow-y-auto pr-1" onScroll={loadMoreClasses}>
        {visibleClasses.length === 0 && !creating ? (
          <EmptyState title="暂无班级" description="点击添加班级创建第一个班级。" />
        ) : null}

        {visibleClasses.map((item) => {
          const teacherIds = classTeacherMap.get(item.id) ?? [];
          const classTeachers = teacherIds.map((id) => teacherMap.get(id)).filter((teacher): teacher is UserSummary => Boolean(teacher));
          const classStudents = classStudentMap.get(item.id) ?? [];

          return (
            <div key={item.id}>
            <ClassSummaryCard
              classItem={item}
              teachers={classTeachers}
              students={classStudents}
              onEdit={() => setEditingClassId(item.id)}
            />
            <Dialog open={editingClassId === item.id} onOpenChange={(open) => setEditingClassId(open ? item.id : null)}>
              <DialogContent className="sm:max-w-4xl">
                <ClassEditorCard
                  mode="edit"
                  classItem={item}
                  teachers={teachers}
                  teacherIds={teacherIds}
                  students={classStudents}
                  token={token}
                  signOut={signOut}
                  onCancel={() => setEditingClassId(null)}
                  onSave={async (name, nextTeacherIds, nextStudentIds) => {
                    if (!token) return;

                    const api = createApiClient(token);
                    const currentTeacherSet = new Set(teacherIds);
                    const nextTeacherSet = new Set(nextTeacherIds);
                    const addTeacherIds = nextTeacherIds.filter((id) => !currentTeacherSet.has(id));
                    const removeTeacherIds = teacherIds.filter((id) => !nextTeacherSet.has(id));
                    const currentStudentIds = classStudents.map((student) => student.id);
                    const currentStudentSet = new Set(currentStudentIds);
                    const nextStudentSet = new Set(nextStudentIds);
                    const addStudentIds = nextStudentIds.filter((id) => !currentStudentSet.has(id));
                    const removeStudentIds = currentStudentIds.filter((id) => !nextStudentSet.has(id));

                    await unwrapResponse(api.admin.classes(item.id).put({ name }));
                    if (addTeacherIds.length > 0) {
                      await unwrapResponse(api.admin.classes.assignTeachers({ class_id: item.id, teacher_ids: addTeacherIds }));
                    }
                    if (removeTeacherIds.length > 0) {
                      await unwrapResponse(api.admin.classes.removeTeachers({ class_id: item.id, teacher_ids: removeTeacherIds }));
                    }
                    if (addStudentIds.length > 0) {
                      await unwrapResponse(api.admin.classes.assignStudents({ class_id: item.id, student_ids: addStudentIds }));
                    }
                    if (removeStudentIds.length > 0) {
                      await unwrapResponse(api.admin.classes.removeStudents({ class_id: item.id, student_ids: removeStudentIds }));
                    }
                    setEditingClassId(null);
                    toastSuccess('班级信息已保存。');
                    await loadData();
                  }}
                />
              </DialogContent>
            </Dialog>
            </div>
          );
        })}
      </div>
    </AdminPageFrame>
  );
}

export function AdminStudentsPage() {
  return <AdminStudentListPage />;
}

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
  const [resetResult, setResetResult] = useState<CreatedUser[]>([]);
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
          {resetResult.length > 0 ? (
            <UserCredentialsResult
              autoDownload
              users={resetResult}
              filename="reset_teachers.csv"
              summary={`成功重置 ${resetResult.length} 个教师的密码。`}
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
            const data = await unwrapResponse<{ message: string; users: CreatedUser[] }>(
              createApiClient(token).admin.users.password.patch({ ids: selectedIds })
            );
            setBatchResetOpen(false);
            setResetResult(data.users);
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ClassSummaryCard({
  classItem,
  teachers,
  students,
  onEdit
}: {
  classItem: ClassSummary;
  teachers: UserSummary[];
  students: StudentWithClassSummary[];
  onEdit: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>{classItem.name}</CardTitle>
            <CardDescription>{classItem.cid}</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="size-4" />
            编辑
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-sm font-medium">教师</p>
          <CompactNameList emptyText="未分配教师" items={teachers.map((teacher) => `${teacher.name} (${teacher.uid})`)} />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">学生</p>
          <CompactNameList emptyText="未分配学生" items={students.map((student) => `${student.name} (${student.uid})`)} />
        </div>
      </CardContent>
    </Card>
  );
}

function CompactNameList({ items, emptyText }: { items: string[]; emptyText: string }) {
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  const visibleItems = expanded ? items : items.slice(0, 12);

  return (
    <div className="flex flex-wrap gap-1.5">
      {visibleItems.map((item) => (
        <span key={item} className="rounded-md bg-muted px-2 py-1 text-xs">
          {item}
        </span>
      ))}
      {!expanded && items.length > 12 ? (
        <button
          type="button"
          className="inline-flex h-6 items-center rounded-md bg-muted px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          onClick={() => setExpanded(true)}
          aria-label="展开全部"
        >
          <ChevronDown className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function ClassEditorCard({
  mode,
  classItem,
  teachers,
  teacherIds = [],
  students = [],
  token,
  signOut,
  onCancel,
  onSave
}: {
  mode: 'create' | 'edit';
  classItem?: ClassSummary;
  teachers: UserSummary[];
  teacherIds?: number[];
  students?: StudentWithClassSummary[];
  token: string | null;
  signOut: () => void;
  onCancel: () => void;
  onSave: (name: string, teacherIds: number[], studentIds: number[]) => Promise<void>;
}) {
  const [name, setName] = useState(classItem?.name ?? '');
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<number[]>(teacherIds);
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>(students.map((student) => student.id));
  const [saving, setSaving] = useState(false);

  async function save() {
    const normalizedName = name.trim();

    if (!normalizedName) {
      toastError(new Error('请输入班级名称。'));
      return;
    }

    try {
      setSaving(true);
      await onSave(normalizedName, selectedTeacherIds, selectedStudentIds);
    } catch (error) {
      toastError(error, mode === 'create' ? '创建失败。' : '保存失败。');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <DialogHeader>
        <DialogTitle>{mode === 'create' ? '添加班级' : `编辑 ${classItem?.cid ?? ''}`}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-4 lg:grid-cols-[minmax(180px,260px)_minmax(240px,1fr)_minmax(240px,1fr)]">
        <Field label="班级名称">
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <TeacherMultiSelect teachers={teachers} value={selectedTeacherIds} onChange={setSelectedTeacherIds} />
        <ClassStudentMultiSelect classId={classItem?.id ?? null} token={token} signOut={signOut} initialStudents={students} value={selectedStudentIds} onChange={setSelectedStudentIds} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={saving} onClick={() => void save()}>
          {saving ? <Spinner className="size-4 text-current" /> : null}
          保存
        </Button>
        <Button disabled={saving} variant="outline" onClick={onCancel}>取消</Button>
      </div>
    </div>
  );
}

function TeacherMultiSelect({
  teachers,
  value,
  onChange
}: {
  teachers: UserSummary[];
  value: number[];
  onChange: (value: number[]) => void;
}) {
  const anchorRef = useComboboxAnchor();
  const selectedTeachers = useMemo(() => teachers.filter((teacher) => value.includes(teacher.id)), [teachers, value]);

  return (
    <Field label="教师">
      <Combobox
        multiple
        items={teachers}
        value={selectedTeachers}
        onValueChange={(nextValue) => onChange(nextValue.map((teacher) => teacher.id))}
        itemToStringLabel={(teacher) => `${teacher.name} ${teacher.uid}`}
        itemToStringValue={(teacher) => String(teacher.id)}
        isItemEqualToValue={(item, selected) => item.id === selected.id}
      >
        <ComboboxChips ref={anchorRef} className="min-h-9 w-full">
          {selectedTeachers.map((teacher) => (
            <ComboboxChip key={teacher.id}>{teacher.name} ({teacher.uid})</ComboboxChip>
          ))}
          <ComboboxChipsInput placeholder={selectedTeachers.length > 0 ? '' : '筛选教师'} />
          {selectedTeachers.length > 0 ? (
            <Button type="button" variant="ghost" size="icon-xs" onClick={() => onChange([])}>
              <X className="size-3" />
            </Button>
          ) : null}
        </ComboboxChips>
        <ComboboxContent anchor={anchorRef} className="max-h-80">
          <ComboboxEmpty>暂无教师</ComboboxEmpty>
          <ComboboxList>
            <ComboboxGroup items={teachers}>
              <ComboboxCollection>
                {(teacher: UserSummary) => (
                  <ComboboxItem key={teacher.id} value={teacher}>
                    {teacher.name} ({teacher.uid})
                  </ComboboxItem>
                )}
              </ComboboxCollection>
            </ComboboxGroup>
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </Field>
  );
}

function ClassStudentMultiSelect({
  classId,
  token,
  signOut,
  initialStudents,
  value,
  onChange
}: {
  classId: number | null;
  token: string | null;
  signOut: () => void;
  initialStudents: StudentWithClassSummary[];
  value: number[];
  onChange: (value: number[]) => void;
}) {
  const anchorRef = useComboboxAnchor();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query);
  const [students, setStudents] = useState<StudentWithClassSummary[]>(initialStudents);
  const [selectedStudentMap, setSelectedStudentMap] = useState(() => new Map(initialStudents.map((student) => [student.id, student])));
  const [visibleCount, setVisibleCount] = useState(comboboxPageSize);
  const [loading, setLoading] = useState(false);
  const selectedStudents = useMemo(
    () => value.map((id) => selectedStudentMap.get(id)).filter((student): student is StudentWithClassSummary => Boolean(student)),
    [selectedStudentMap, value]
  );
  const visibleStudents = useMemo(() => students.slice(0, visibleCount), [students, visibleCount]);

  useEffect(() => {
    let cancelled = false;

    async function loadMatchedStudents() {
      if (!token) return;
      setLoading(true);
      try {
        const data = await unwrapResponse<{ students: StudentWithClassSummary[] }>(
          createApiClient(token).admin.classes.students.get({
            query: {
              q: debouncedQuery.trim() || undefined,
              class_id: classId ? String(classId) : undefined
            }
          })
        );

        if (cancelled) return;

        setStudents(data.students);
        setSelectedStudentMap((current) => {
          const next = new Map(current);
          for (const student of data.students) {
            next.set(student.id, student);
          }
          return next;
        });
      } catch (error) {
        if (error instanceof ApiResponseError && error.status === 401) signOut();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadMatchedStudents();

    return () => {
      cancelled = true;
    };
  }, [classId, debouncedQuery, signOut, token]);

  useEffect(() => {
    setVisibleCount(comboboxPageSize);
  }, [debouncedQuery, students]);

  function loadMoreStudents(event: React.UIEvent<HTMLDivElement>) {
    const element = event.currentTarget;

    if (element.scrollTop + element.clientHeight < element.scrollHeight - 24) {
      return;
    }

    setVisibleCount((current) => Math.min(current + comboboxPageSize, students.length));
  }

  return (
    <Field label="学生">
      <Combobox
        multiple
        items={students}
        inputValue={query}
        value={selectedStudents}
        onInputValueChange={setQuery}
        filter={null}
        onValueChange={(nextValue) => {
          setSelectedStudentMap((current) => {
            const next = new Map(current);
            for (const student of nextValue) {
              next.set(student.id, student);
            }
            return next;
          });
          onChange(nextValue.map((student) => student.id));
        }}
        itemToStringLabel={(student) => `${student.name} ${student.uid}`}
        itemToStringValue={(student) => String(student.id)}
        isItemEqualToValue={(item, selected) => item.id === selected.id}
      >
        <ComboboxChips ref={anchorRef} className="min-h-9 w-full">
          {selectedStudents.map((student) => (
            <ComboboxChip key={student.id}>{student.name} ({student.uid})</ComboboxChip>
          ))}
          <ComboboxChipsInput placeholder={selectedStudents.length > 0 ? '' : 'UID / 姓名'} />
          {selectedStudents.length > 0 ? (
            <Button type="button" variant="ghost" size="icon-xs" onClick={() => onChange([])}>
              <X className="size-3" />
            </Button>
          ) : null}
        </ComboboxChips>
        <ComboboxContent anchor={anchorRef} className="max-h-80">
          <ComboboxEmpty>暂无学生</ComboboxEmpty>
          {loading && students.length === 0 ? (
            <div className="px-2 py-2 text-sm text-muted-foreground">加载中...</div>
          ) : (
            <ComboboxList onScroll={loadMoreStudents}>
              <ComboboxGroup items={visibleStudents}>
                <ComboboxCollection>
                  {(student: StudentWithClassSummary) => (
                    <ComboboxItem key={student.id} value={student}>
                      {student.name} ({student.uid})
                    </ComboboxItem>
                  )}
                </ComboboxCollection>
              </ComboboxGroup>
            </ComboboxList>
          )}
        </ComboboxContent>
      </Combobox>
    </Field>
  );
}

function AssignmentStudentFilter({
  token,
  signOut,
  value,
  onChange
}: {
  token: string | null;
  signOut: () => void;
  value: number[];
  onChange: (value: number[], selectedStudents: StudentWithClassSummary[]) => void;
}) {
  const anchorRef = useComboboxAnchor();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query);
  const [students, setStudents] = useState<StudentWithClassSummary[]>([]);
  const [selectedStudentMap, setSelectedStudentMap] = useState(() => new Map<number, StudentWithClassSummary>());
  const [visibleCount, setVisibleCount] = useState(comboboxPageSize);
  const [loading, setLoading] = useState(false);
  const visibleStudents = useMemo(() => students.slice(0, visibleCount), [students, visibleCount]);
  const studentGroups = useMemo(() => {
    const groupMap = new Map<string, { value: string; items: StudentWithClassSummary[] }>();

    for (const student of visibleStudents) {
      const groupKey = student.class_id ? String(student.class_id) : '__unassigned__';
      const groupLabel = student.class_id && student.class_name && student.class_cid
        ? `${student.class_name} (${student.class_cid})`
        : '未分配';
      const group = groupMap.get(groupKey) ?? { value: groupLabel, items: [] };
      group.items.push(student);
      groupMap.set(groupKey, group);
    }

    return [...groupMap.values()];
  }, [visibleStudents]);
  const selectedStudents = useMemo(
    () => value.map((id) => selectedStudentMap.get(id)).filter((student): student is StudentWithClassSummary => Boolean(student)),
    [selectedStudentMap, value]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadMatchedStudents() {
      if (!token) return;
      setLoading(true);
      try {
        const data = await unwrapResponse<{ students: StudentWithClassSummary[] }>(
          createApiClient(token).admin.classes.students.get({ query: { q: debouncedQuery.trim() || undefined } })
        );

        if (cancelled) return;

        setStudents(data.students);
        setSelectedStudentMap((current) => {
          const next = new Map(current);
          for (const student of data.students) {
            next.set(student.id, student);
          }
          return next;
        });
      } catch (error) {
        if (error instanceof ApiResponseError && error.status === 401) signOut();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadMatchedStudents();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, signOut, token]);

  useEffect(() => {
    setVisibleCount(comboboxPageSize);
  }, [debouncedQuery]);

  function loadMoreStudents(event: React.UIEvent<HTMLDivElement>) {
    const element = event.currentTarget;

    if (element.scrollTop + element.clientHeight < element.scrollHeight - 24) {
      return;
    }

    setVisibleCount((current) => Math.min(current + comboboxPageSize, students.length));
  }

  return (
    <Field label="筛选学生">
      <Combobox
        multiple
        items={studentGroups}
        inputValue={query}
        value={selectedStudents}
        onInputValueChange={setQuery}
        filter={null}
        onValueChange={(nextValue) => {
          setSelectedStudentMap((current) => {
            const next = new Map(current);
            for (const student of nextValue) {
              next.set(student.id, student);
            }
            return next;
          });
          onChange(nextValue.map((student) => student.id), nextValue);
        }}
        itemToStringLabel={(item: { value?: string; name?: string; uid?: string }) => item.name && item.uid ? `${item.name} ${item.uid}` : item.value ?? ''}
        itemToStringValue={(item: { id?: number; value?: string }) => item.id ? String(item.id) : item.value ?? ''}
        isItemEqualToValue={(item: { id?: number }, selected: StudentWithClassSummary) => item.id === selected.id}
      >
        <ComboboxChips ref={anchorRef} className="min-h-9 w-full">
          {selectedStudents.map((student) => (
            <ComboboxChip key={student.id}>{student.name} ({student.uid})</ComboboxChip>
          ))}
          <ComboboxChipsInput placeholder={selectedStudents.length > 0 ? '' : 'UID / 姓名'} />
          {selectedStudents.length > 0 ? (
            <Button type="button" variant="ghost" size="icon-xs" onClick={() => onChange([], [])}>
              <X className="size-3" />
            </Button>
          ) : null}
        </ComboboxChips>
        <ComboboxContent anchor={anchorRef} className="max-h-80">
          <ComboboxEmpty>暂无学生</ComboboxEmpty>
          {loading && students.length === 0 ? (
            <div className="px-2 py-2 text-sm text-muted-foreground">加载中...</div>
          ) : (
            <ComboboxList onScroll={loadMoreStudents}>
              {(group, index) => (
                <ComboboxGroup key={group.value} items={group.items}>
                  <ComboboxLabel>{group.value}</ComboboxLabel>
                  <ComboboxCollection>
                    {(student: StudentWithClassSummary) => (
                      <ComboboxItem key={student.id} value={student}>
                        {student.name} ({student.uid})
                      </ComboboxItem>
                    )}
                  </ComboboxCollection>
                  {index < studentGroups.length - 1 && <ComboboxSeparator />}
                </ComboboxGroup>
              )}
            </ComboboxList>
          )}
        </ComboboxContent>
      </Combobox>
    </Field>
  );
}

function SelectRole({ value, onChange }: { value: UserRole; onChange: (role: UserRole) => void }) {
  return (
    <Field label="角色">
      <Select value={value} onValueChange={(nextValue) => onChange(nextValue as UserRole)}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="student">学生</SelectItem>
          <SelectItem value="teacher">教师</SelectItem>
          <SelectItem value="admin">管理员</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  );
}

function SelectClass({
  classes,
  value,
  disabled,
  onChange
}: {
  classes: ClassSummary[];
  value: number | null;
  disabled?: boolean;
  onChange: (value: number | null) => void;
}) {
  return (
    <Field label="班级">
      <Select
        value={value ? String(value) : '__none__'}
        disabled={disabled}
        onValueChange={(nextValue) => onChange(nextValue === '__none__' ? null : Number(nextValue))}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="班级" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">不分配班级</SelectItem>
          {classes.map((item) => (
            <SelectItem key={item.id} value={String(item.id)}>
              {item.name} ({item.cid})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function formatStudentClass(student: Pick<StudentWithClassSummary, 'class_cid' | 'class_name'>) {
  return student.class_cid && student.class_name ? `${student.class_cid} ${student.class_name}` : <span className="text-muted-foreground">未分配</span>;
}

function getStudentClassSortValue(student: Pick<StudentWithClassSummary, 'class_cid'>) {
  return student.class_cid ?? null;
}

function compareStudentClass(left: Pick<StudentWithClassSummary, 'class_cid' | 'uid'>, right: Pick<StudentWithClassSummary, 'class_cid' | 'uid'>, direction: 'asc' | 'desc') {
  const leftClass = getStudentClassSortValue(left);
  const rightClass = getStudentClassSortValue(right);

  if (!leftClass && !rightClass) return left.uid.localeCompare(right.uid);
  if (!leftClass) return 1;
  if (!rightClass) return -1;

  const result = leftClass.localeCompare(rightClass) || left.uid.localeCompare(right.uid);
  return direction === 'asc' ? result : -result;
}

function AdminStudentListPage() {
  const { token, signOut } = useSession();
  const { captureShiftKey, resetSelectionAnchor, updateSelection } = useShiftMultiSelect();
  const [students, setStudents] = useState<StudentWithClassSummary[]>([]);
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [durations, setDurations] = useState<Record<number, number>>({});
  const [sortBy, setSortBy] = useState<'duration-desc' | 'duration-asc' | 'uid-asc' | 'uid-desc' | 'name-asc' | 'name-desc' | 'class-asc' | 'class-desc'>('duration-desc');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [editing, setEditing] = useState<StudentWithClassSummary | null>(null);
  const [form, setForm] = useState({ name: '', password: '', class_id: null as number | null });
  const [batchClassId, setBatchClassId] = useState<number | null>(null);
  const [batchResetOpen, setBatchResetOpen] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetResult, setResetResult] = useState<CreatedUser[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<StudentWithClassSummary | null>(null);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function reload() {
    if (!token) return;

    try {
      const api = createApiClient(token);
      const [studentsData, statisticsData, classesData] = await Promise.all([
        unwrapResponse<{ students: StudentWithClassSummary[] }>(api.teacher.students.get()),
        unwrapResponse<{ statistics: TeacherStatistics }>(api.teacher.statistics.get()),
        unwrapResponse<{ classes: ClassSummary[] }>(api.admin.classes.get())
      ]);

      setStudents(studentsData.students);
      setClasses(classesData.classes);
      setDurations(Object.fromEntries(statisticsData.statistics.student_durations.map((item) => [item.student_id, item.total_duration])));
      setSelectedIds([]);
      resetSelectionAnchor();
    } catch (error) {
      if (error instanceof ApiResponseError && error.status === 401) {
        signOut();
        return;
      }

      toastError(error, '加载学生列表失败。');
    }
  }

  useEffect(() => {
    if (!token) return;
    void reload();
  }, [token]);

  const sortedStudents = useMemo(() => {
    return [...students].sort((left, right) => {
      const leftDuration = durations[left.id] ?? 0;
      const rightDuration = durations[right.id] ?? 0;
      if (sortBy === 'duration-desc') return rightDuration - leftDuration || left.name.localeCompare(right.name);
      if (sortBy === 'duration-asc') return leftDuration - rightDuration || left.name.localeCompare(right.name);
      if (sortBy === 'uid-desc') return right.uid.localeCompare(left.uid);
      if (sortBy === 'uid-asc') return left.uid.localeCompare(right.uid);
      if (sortBy === 'class-asc') return compareStudentClass(left, right, 'asc');
      if (sortBy === 'class-desc') return compareStudentClass(left, right, 'desc');
      if (sortBy === 'name-desc') return right.name.localeCompare(left.name);
      return left.name.localeCompare(right.name);
    });
  }, [durations, sortBy, students]);

  const studentIds = useMemo(() => sortedStudents.map((student) => student.id), [sortedStudents]);
  const selectedStudentIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allSelected = sortedStudents.length > 0 && selectedIds.length === sortedStudents.length;

  const columns = useMemo<Array<ColumnDef<StudentWithClassSummary>>>(() => [
    {
      id: 'select',
      header: () => (
        <Checkbox
          checked={allSelected}
          onCheckedChange={(checked) => setSelectedIds(checked ? studentIds : [])}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={selectedStudentIdSet.has(row.original.id)}
          onClick={captureShiftKey}
          onCheckedChange={(checked) =>
            setSelectedIds((current) =>
              updateSelection(studentIds, current, row.original.id, checked === true)
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
      id: 'class',
      header: () => (
        <SortButton
          active={sortBy === 'class-asc' || sortBy === 'class-desc'}
          descending={sortBy === 'class-desc'}
          label="班级"
          onClick={() => setSortBy((current) => current === 'class-asc' ? 'class-desc' : 'class-asc')}
        />
      ),
      cell: ({ row }) => formatStudentClass(row.original)
    },
    {
      id: 'duration',
      header: () => (
        <SortButton
          active={sortBy === 'duration-desc' || sortBy === 'duration-asc'}
          descending={sortBy === 'duration-desc'}
          label="总时长"
          onClick={() => setSortBy((current) => current === 'duration-desc' ? 'duration-asc' : 'duration-desc')}
        />
      ),
      cell: ({ row }) => `${formatDuration(durations[row.original.id] ?? 0)} h`
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
              setForm({ name: row.original.name, password: '', class_id: row.original.class_id });
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
  ], [allSelected, captureShiftKey, durations, selectedStudentIdSet, sortBy, studentIds, updateSelection]);

  return (
    <AdminPageFrame title="学生列表" description="管理员可以维护学生姓名和密码，支持批量重置密码、批量删除，并按总时长查看排序。">
      <Card>
        <CardHeader>
          <CardTitle>学生列表</CardTitle>
          <CardDescription>总时长仅统计已通过记录。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {selectedIds.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-slate-100 p-3">
                <p className="mr-2 text-sm text-muted-foreground">已选 {selectedIds.length} 人</p>
                <Button size="sm" onClick={() => setBatchResetOpen(true)}>重置密码</Button>
                <Select value={batchClassId ? String(batchClassId) : '__none__'} onValueChange={(value) => setBatchClassId(value === '__none__' ? null : Number(value))}>
                  <SelectTrigger className="h-8 w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">未分配班级</SelectItem>
                    {classes.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {item.name} ({item.cid})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={() => void updateSelectedClass()}>批量改班级</Button>
                <Button size="sm" variant="destructive" onClick={() => setBatchDeleteOpen(true)}>删除</Button>
              </div>
            ) : <div />}

            <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="duration-desc">总时长从高到低</SelectItem>
                <SelectItem value="duration-asc">总时长从低到高</SelectItem>
                <SelectItem value="uid-asc">UID 从小到大</SelectItem>
                <SelectItem value="uid-desc">UID 从大到小</SelectItem>
                <SelectItem value="class-asc">班级 CID 从小到大</SelectItem>
                <SelectItem value="class-desc">班级 CID 从大到小</SelectItem>
                <SelectItem value="name-asc">姓名 A-Z</SelectItem>
                <SelectItem value="name-desc">姓名 Z-A</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {sortedStudents.length === 0 ? (
            <EmptyState title="暂无账号" description="在用户创建页添加学生账号后，这里会同步显示。" />
          ) : (
            <DataTable batchSize={60} columns={columns} data={sortedStudents} />
          )}
          {resetResult.length > 0 ? (
            <UserCredentialsResult
              autoDownload
              users={resetResult}
              filename="reset_students.csv"
              summary={`成功重置 ${resetResult.length} 个学生的密码。`}
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
            <SelectClass classes={classes} value={form.class_id} onChange={(class_id) => setForm((current) => ({ ...current, class_id }))} />
            <Button
              onClick={async () => {
                if (!token || !editing) return;

                try {
                  await unwrapResponse(createApiClient(token).admin.users({ id: editing.id }).put({
                    name: form.name.trim(),
                    password: form.password,
                    class_id: form.class_id
                  }));
                  setEditing(null);
                  toastSuccess('学生信息已保存。');
                  await reload();
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
        description={`将重置当前选中的 ${selectedIds.length} 个学生密码，并下载包含新密码的 CSV 文件。`}
        confirmLabel="重置密码"
        loading={resetLoading}
        onConfirm={async () => {
          if (!token) return;

          try {
            setResetLoading(true);
            const data = await unwrapResponse<{ message: string; users: CreatedUser[] }>(
              createApiClient(token).admin.users.password.patch({ ids: selectedIds })
            );
            setBatchResetOpen(false);
            setResetResult(data.users);
            toastSuccess(`已重置 ${data.users.length} 个学生的密码。`);
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
        title="确认删除学生账号"
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
            toastSuccess('学生账号已删除。');
            await reload();
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
        title="确认批量删除学生账号"
        description={`将删除当前选中的 ${selectedIds.length} 个学生账号，删除后不可恢复。`}
        confirmLabel="批量删除"
        loading={deleteLoading}
        variant="destructive"
        onConfirm={async () => {
          if (!token) return;

          try {
            setDeleteLoading(true);
            await unwrapResponse(createApiClient(token).admin.users.delete({ ids: selectedIds }));
            setBatchDeleteOpen(false);
            toastSuccess(`已删除 ${selectedIds.length} 个学生账号。`);
            await reload();
          } catch (error) {
            if (error instanceof ApiResponseError && error.status === 401) {
              signOut();
              return;
            }

            toastError(error, '批量删除失败。');
          } finally {
            setDeleteLoading(false);
          }
        }}
      />
    </AdminPageFrame>
  );

  async function updateSelectedClass() {
    if (!token || selectedIds.length === 0) return;

    try {
      await unwrapResponse(createApiClient(token).admin.students.class.patch({ ids: selectedIds, class_id: batchClassId }));
      toastSuccess('班级已更新。');
      await reload();
    } catch (error) {
      if (error instanceof ApiResponseError && error.status === 401) {
        signOut();
        return;
      }

      toastError(error, '更新失败。');
    }
  }
}

function SortButton({
  active,
  descending,
  label,
  onClick
}: {
  active: boolean;
  descending: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className="inline-flex items-center gap-1 font-medium" type="button" onClick={onClick}>
      {label}
      {active ? descending ? <ArrowDown className="size-3.5" /> : <ArrowUp className="size-3.5" /> : null}
    </button>
  );
}

const CSV_IMPORT_EXAMPLE_ROWS: CsvImportEntry[] = [
  { lineNumber: 1, name: '小奶龙', role: 'student' },
  { lineNumber: 2, name: '大奶龙', role: 'teacher' },
  { lineNumber: 3, name: '超级奶龙', role: 'admin' }
];

function CsvImportExampleDialog() {
  const columns = useMemo<Array<ColumnDef<CsvImportEntry>>>(() => [
    { accessorKey: 'name', header: '姓名' },
    { accessorKey: 'role', header: '角色' }
  ], []);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="h-auto p-0 text-sm" variant="link">示例</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>CSV 示例</DialogTitle>
          <DialogDescription>导入文件不包含表头。</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="source">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="source">源码</TabsTrigger>
            <TabsTrigger value="table">表格</TabsTrigger>
          </TabsList>
          <TabsContent value="source" className="mt-4">
            <pre className="overflow-x-auto rounded-xl border border-border/70 bg-muted/30 p-4 text-sm leading-6">
              {CSV_IMPORT_EXAMPLE_ROWS.map((row) => `${row.name},${row.role}`).join('\n')}
            </pre>
          </TabsContent>
          <TabsContent value="table" className="mt-4">
            <DataTable batchSize={10} columns={columns} data={CSV_IMPORT_EXAMPLE_ROWS} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function formatCsvEncoding(encoding: CsvImportPreview['encoding']) {
  if (encoding === 'utf-16') return 'UTF-16';
  if (encoding === 'gbk') return 'GBK';
  return 'UTF-8';
}
