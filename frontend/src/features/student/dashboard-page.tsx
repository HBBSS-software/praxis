import { CalendarDays, CheckCircle2, Clock3, Eye, ImagePlus, MapPin, Pencil, PlusCircle, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { useSession } from '@/lib/auth';
import { ConfirmActionDialog } from '@/components/confirm-action-dialog';
import { AuthenticatedImage } from '@/shared/authenticated-image';
import { DatePickerField } from '@/shared/date-picker-field';
import { EmptyState } from '@/shared/empty-state';
import { StatCard } from '@/shared/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { ApiResponseError, createApiClient, formatUploadImageMaxSize, getRuntimeConfig, unwrapResponse, uploadImage, validateUploadImageFiles } from '@/lib/api';
import { toastError, toastSuccess } from '@/lib/feedback';
import { formatDate, formatDateTime, formatDuration, normalizeDateInputValue, notificationLabel, statusLabel } from '@/lib/format';
import { MAX_RECORD_IMAGES, type AppNotification, type RecordStatistics, type StudentRecord } from '@/lib/types';
import { ErrorCard, Field, LoadingCard, StatusBadge, StudentPageFrame } from './shared';

export function StudentDashboardPage() {
  const { token, signOut } = useSession();
  const [records, setRecords] = useState<StudentRecord[]>([]);
  const [statistics, setStatistics] = useState<RecordStatistics | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<StudentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<StudentRecord | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function load() {
    if (!token) return;
    setLoading(true);
    setError('');

    try {
      const data = await unwrapResponse<{ records: StudentRecord[]; statistics: RecordStatistics }>(createApiClient(token).student.records.get());
      setRecords(data.records);
      setStatistics(data.statistics);
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

  useEffect(() => {
    void load();
  }, [token]);

  return (
    <StudentPageFrame
      title="实践概览"
      description="查看个人提交记录、审核状态与累计时长。待审核和已驳回的记录可以继续修改。"
      action={
        <Button asChild>
          <Link to="/student/upload">
            <PlusCircle className="size-4" />
            新建记录
          </Link>
        </Button>
      }
    >
      {statistics ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="总记录数" value={String(statistics.total_records)} hint="包含待审核、已通过和已驳回" icon={CalendarDays} />
          <StatCard title="累计时长" value={`${formatDuration(statistics.total_duration)} h`} hint="仅统计已通过记录" icon={Clock3} />
          <StatCard title="待审核" value={String(statistics.pending_count)} hint="可以继续删除或编辑" icon={Clock3} />
          <StatCard title="已通过" value={String(statistics.approved_count)} hint="通过后计入总时长" icon={CheckCircle2} />
        </div>
      ) : null}

      {loading ? (
        <LoadingCard label="正在加载你的实践记录..." />
      ) : error ? (
        <ErrorCard message={error} onRetry={() => void load()} />
      ) : records.length === 0 ? (
        <EmptyState title="还没有实践记录" description="从上传页提交第一条记录后，这里会自动汇总统计和状态变化。" action={<Button asChild><Link to="/student/upload">去上传</Link></Button>} />
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {records.map((record) => (
            <Card key={record.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="grid min-h-full md:grid-cols-[180px_minmax(0,1fr)]">
                  <div className="relative min-h-40 overflow-hidden bg-muted">
                    {record.cover_image_path ? (
                      <AuthenticatedImage
                        className="h-full w-full object-cover"
                        placeholderClassName="flex h-full w-full items-center justify-center bg-muted/40"
                        src={record.cover_image_path}
                        alt={record.title}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-white/85">
                        <ImagePlus className="size-12" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-3 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <h3 className="text-xl font-semibold">{record.title}</h3>
                        <div className="flex flex-wrap gap-2 text-sm text-[color:var(--muted-foreground)]">
                          <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" />{formatDate(record.practice_date)}</span>
                          {record.location ? <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{record.location}</span> : null}
                          <span>{formatDuration(record.duration)} 小时</span>
                        </div>
                      </div>
                      <StatusBadge status={record.status} />
                    </div>
                    <p className="line-clamp-4 text-sm leading-6 text-[color:var(--muted-foreground)]">{record.content}</p>
                    {record.teacher_comment ? (
                      <div className="rounded-2xl bg-slate-100/80 p-4 text-sm">
                        <p className="mb-1 font-medium">教师评语</p>
                        <p className="text-[color:var(--muted-foreground)]">{record.teacher_comment}</p>
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setSelectedRecord(record)}>
                        <Eye className="size-4" />
                        详情
                      </Button>
                      {record.status === 'pending' || record.status === 'rejected' ? (
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/student/upload?id=${record.id}`}>
                            <Pencil className="size-4" />
                            修改
                          </Link>
                        </Button>
                      ) : null}
                      {record.status === 'pending' ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeleteTarget(record)}
                        >
                          <Trash2 className="size-4" />
                          删除
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={Boolean(selectedRecord)} onOpenChange={(open) => !open && setSelectedRecord(null)}>
        <DialogContent>
          {selectedRecord ? (
            <>
              <DialogHeader>
                <DialogTitle>{selectedRecord.title}</DialogTitle>
                <DialogDescription>{formatDate(selectedRecord.practice_date)} · {formatDuration(selectedRecord.duration)} 小时</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {selectedRecord.image_paths.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {selectedRecord.image_paths.map((imagePath) => (
                      <AuthenticatedImage
                        key={imagePath}
                        className="max-h-80 w-full rounded-2xl object-cover"
                        placeholderClassName="flex min-h-52 w-full items-center justify-center rounded-2xl bg-muted/40"
                        src={imagePath}
                        alt={selectedRecord.title}
                      />
                    ))}
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status={selectedRecord.status} />
                  {selectedRecord.location ? <Badge variant="outline">{selectedRecord.location}</Badge> : null}
                </div>
                <p className="whitespace-pre-wrap text-sm leading-7 text-[color:var(--muted-foreground)]">{selectedRecord.content}</p>
                {selectedRecord.teacher_comment ? (
                  <div className="rounded-2xl bg-slate-100 p-4 text-sm">
                    <p className="mb-1 font-medium">教师评语</p>
                    <p className="text-[color:var(--muted-foreground)]">{selectedRecord.teacher_comment}</p>
                  </div>
                ) : null}
              </div>
            </>
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
          if (!token || !deleteTarget) return;

          try {
            setDeleteLoading(true);
            await unwrapResponse(createApiClient(token).student.records({ id: deleteTarget.id }).delete());
            setDeleteTarget(null);
            toastSuccess('记录已删除。');
            await load();
          } catch (nextError) {
            if (nextError instanceof ApiResponseError && nextError.status === 401) {
              signOut();
              return;
            }
            toastError(nextError, '删除失败。');
          } finally {
            setDeleteLoading(false);
          }
        }}
      />
    </StudentPageFrame>
  );
}
