import { BarChart3, Clock3, FilePenLine, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiResponseError, createApiClient, unwrapResponse } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { formatDuration } from '@/lib/format';
import type { StudentDashboardOverview } from '@/lib/types';
import { OverviewChart } from '@/shared/overview-chart';
import { StatCard } from '@/shared/stat-card';
import { ErrorCard, LoadingCard, StudentPageFrame } from './shared';

export function StudentDashboardPage() {
  const { signOut } = useSession();
  const [overview, setOverview] = useState<StudentDashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');

    try {
      const data = await unwrapResponse<{ overview: StudentDashboardOverview }>(createApiClient().student.overview.get());
      setOverview(data.overview);
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
  }, []);

  return (
    <StudentPageFrame title="数据概览">
      {loading ? (
        <LoadingCard label="正在加载数据概览..." />
      ) : error ? (
        <ErrorCard message={error} onRetry={() => void load()} />
      ) : overview ? (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard title="进行中的任务数" value={String(overview.current_task_count)} icon={FilePenLine} />
            <StatCard title="记录总数" value={String(overview.total_records)} icon={BarChart3} />
            <StatCard title="总时长" value={`${formatDuration(overview.total_duration)} 小时`} icon={Clock3} />
            <StatCard title="班级排名" value={overview.class_rank ? String(overview.class_rank) : '-'} icon={Trophy} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>月度趋势</CardTitle>
            </CardHeader>
            <CardContent>
              <OverviewChart trend={overview.trend} />
            </CardContent>
          </Card>
        </div>
      ) : null}
    </StudentPageFrame>
  );
}
