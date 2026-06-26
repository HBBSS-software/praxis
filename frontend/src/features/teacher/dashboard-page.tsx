import { BarChart3, Clock3, FilePenLine, Timer, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { DataTable } from '@/components/data-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatCard } from '@/shared/stat-card';
import { ApiResponseError, createApiClient, unwrapResponse } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { formatDuration } from '@/lib/format';
import type { ClassSummary, OverviewData } from '@/lib/types';
import { EmptyState } from '@/shared/empty-state';
import { OverviewChart } from '@/shared/overview-chart';
import { ErrorCard, LoadingCard, PageFrame } from './shared';
import type { ColumnDef } from '@tanstack/react-table';

export function TeacherDashboardPage() {
  const { signOut, user } = useSession();
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [classId, setClassId] = useState<string>('all');
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [rankingTab, setRankingTab] = useState('students');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');

    try {
      const api = createApiClient();
      const [classesData, overviewData] = await Promise.all([
        unwrapResponse<{ classes: ClassSummary[] }>(api.teacher.classes.get()),
        unwrapResponse<{ overview: OverviewData }>(api.teacher.overview.get({ query: { class_id: classId === 'all' ? undefined : classId } }))
      ]);
      setClasses(classesData.classes);
      setOverview(overviewData.overview);
    } catch (nextError) {
      if (nextError instanceof ApiResponseError && nextError.status === 401) {
        signOut();
        return;
      }
      setError(nextError instanceof Error ? nextError.message : '加载概览失败。');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [classId]);

  const totals = overview?.classes.reduce((acc, item) => ({
    student_count: acc.student_count + item.student_count,
    task_count: acc.task_count + item.task_count,
    total_records: acc.total_records + item.total_records,
    pending_count: acc.pending_count + item.pending_count,
    approved_count: acc.approved_count + item.approved_count,
    rejected_count: acc.rejected_count + item.rejected_count,
    total_duration: acc.total_duration + item.total_duration
  }), {
    student_count: 0,
    task_count: 0,
    total_records: 0,
    pending_count: 0,
    approved_count: 0,
    rejected_count: 0,
    total_duration: 0
  });

  const columns = useMemo<Array<ColumnDef<OverviewData['classes'][number]>>>(() => [
    {
      id: 'class',
      header: '班级',
      cell: ({ row }) => (
        <span>{row.original.class_name}</span>
      )
    },
    { accessorKey: 'student_count', header: '学生数' },
    { accessorKey: 'task_count', header: '进行中的任务数' },
    { accessorKey: 'total_records', header: '记录总数' },
    { accessorKey: 'pending_count', header: '待审核' },
    { accessorKey: 'approved_count', header: '已通过' },
    { accessorKey: 'rejected_count', header: '已驳回' },
    {
      accessorKey: 'total_duration',
      header: '累计时长',
      cell: ({ row }) => `${formatDuration(row.original.total_duration)} 小时`
    }
  ], []);
  const studentColumns = useMemo<Array<ColumnDef<OverviewData['students'][number]>>>(() => [
    {
      id: 'student',
      header: '学生',
      cell: ({ row }) => (
        <div>
          <p>{row.original.student_name}</p>
          <p className="text-xs text-muted-foreground">{row.original.student_uid}</p>
        </div>
      )
    },
    {
      id: 'class',
      header: '班级',
      cell: ({ row }) => (
        <span>{row.original.class_name}</span>
      )
    },
    { accessorKey: 'total_records', header: '记录总数' },
    { accessorKey: 'pending_count', header: '待审核' },
    { accessorKey: 'approved_count', header: '已通过' },
    { accessorKey: 'rejected_count', header: '已驳回' },
    {
      accessorKey: 'total_duration',
      header: '累计时长',
      cell: ({ row }) => `${formatDuration(row.original.total_duration)} 小时`
    }
  ], []);

  const selectValue = classes.length === 1 ? String(classes[0].id) : classId;
  const hasMultipleClasses = (overview?.classes.length ?? 0) > 1;

  return (
    <PageFrame
      title="数据概览"
      action={
        classes.length > 0 ? (
          <Select value={selectValue} onValueChange={setClassId}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {classes.length > 1 ? <SelectItem value="all">总览</SelectItem> : null}
              {classes.map((item) => (
                <SelectItem key={item.id} value={String(item.id)}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null
      }
    >
      {loading ? (
        <LoadingCard label="正在加载数据概览..." />
      ) : error ? (
        <ErrorCard message={error} onRetry={() => void load()} />
      ) : classes.length === 0 ? (
        <EmptyState
          title="暂无班级"
          description={user?.role === 'admin' ? '创建班级后即可查看数据。' : '分配班级后即可查看数据。'}
        />
      ) : overview && totals ? (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <StatCard title="进行中的任务数" value={String(totals.task_count)} icon={FilePenLine} />
            <StatCard title="记录总数" value={String(totals.total_records)} icon={BarChart3} />
            <StatCard title="总时长" value={`${formatDuration(totals.total_duration)} 小时`} icon={Timer} />
            <StatCard title="待审核" value={String(totals.pending_count)} icon={Clock3} />
            <StatCard title="学生人数" value={String(totals.student_count)} icon={Users} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>月度趋势</CardTitle>
            </CardHeader>
            <CardContent>
              <OverviewChart trend={overview.trend} />
            </CardContent>
          </Card>

          {hasMultipleClasses ? (
            <Tabs value={rankingTab} onValueChange={setRankingTab}>
              <Card>
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle>排名</CardTitle>
                  <TabsList>
                    <TabsTrigger value="classes">班级排名</TabsTrigger>
                    <TabsTrigger value="students">学生排名</TabsTrigger>
                  </TabsList>
                </CardHeader>
                <CardContent>
                  <TabsContent value="classes" className="mt-0">
                    <DataTable columns={columns} data={overview.class_rankings} />
                  </TabsContent>
                  <TabsContent value="students" className="mt-0">
                    <DataTable batchSize={50} columns={studentColumns} data={overview.student_rankings} />
                  </TabsContent>
                </CardContent>
              </Card>
            </Tabs>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>学生排名</CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable batchSize={50} columns={studentColumns} data={overview.student_rankings} />
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}
    </PageFrame>
  );
}
