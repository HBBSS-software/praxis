import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { ApiResponseError, createApiClient, formatUploadImageMaxSize, unwrapResponse } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { toastError, toastSuccess } from '@/lib/feedback';
import { normalizeDateInputValue } from '@/lib/format';
import { useRuntimeConfig } from '@/lib/runtime-config';
import type { PracticeTaskDetail, TeacherRecord } from '@/lib/types';
import {
  createExistingRecordImageItem,
  RecordEditorForm,
  type RecordEditorFormValues,
  type RecordEditorImageItem
} from '@/shared/record-editor-form';
import { PageFrame } from './shared';

export function TeacherRecordEditPage() {
  const { id: taskIdParam, recordId: recordIdParam } = useParams();
  const taskId = Number(taskIdParam);
  const recordId = Number(recordIdParam);
  const navigate = useNavigate();
  const { signOut, user } = useSession();
  const { upload_image_max_size_bytes: uploadImageMaxSizeBytes } = useRuntimeConfig();
  const basePath = user?.role === 'admin' ? '/admin/tasks' : '/teacher/tasks';
  const [task, setTask] = useState<PracticeTaskDetail | null>(null);
  const [record, setRecord] = useState<TeacherRecord | null>(null);
  const [initialForm, setInitialForm] = useState<RecordEditorFormValues | null>(null);
  const [initialImages, setInitialImages] = useState<RecordEditorImageItem[]>([]);
  const [initialCoverImageId, setInitialCoverImageId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!Number.isInteger(taskId) || taskId <= 0 || !Number.isInteger(recordId) || recordId <= 0) {
      setLoading(false);
      setError('记录不存在。');
      return;
    }

    setLoading(true);
    setError('');

    const api = createApiClient();
    Promise.all([
      unwrapResponse<{ task: PracticeTaskDetail }>(api.teacher.tasks({ id: taskId }).get()),
      unwrapResponse<{ record: TeacherRecord }>(api.teacher.records({ id: recordId }).get())
    ])
      .then(([taskData, recordData]) => {
        if (recordData.record.task_id !== taskData.task.id) {
          setError('记录不属于当前任务。');
          return;
        }

        setTask(taskData.task);
        setRecord(recordData.record);
        setInitialForm({
          title: recordData.record.title,
          content: recordData.record.content,
          practice_date: normalizeDateInputValue(recordData.record.practice_date),
          location: recordData.record.location ?? '',
          duration: String(recordData.record.duration)
        });
        const recordImages = recordData.record.image_paths.map(createExistingRecordImageItem);
        setInitialImages(recordImages);
        setInitialCoverImageId(recordData.record.cover_image_path ?? recordImages[0]?.id ?? '');
      })
      .catch((nextError) => {
        if (nextError instanceof ApiResponseError && nextError.status === 401) {
          signOut();
          return;
        }
        setError(nextError instanceof Error ? nextError.message : '加载记录失败。');
      })
      .finally(() => setLoading(false));
  }, [recordId, signOut, taskId]);

  return (
    <PageFrame title="修改记录" description={task?.title}>
      <Card>
        <CardHeader>
          <CardTitle>修改记录</CardTitle>
          <CardDescription>
            {record ? `学生：${record.student_name}（${record.student_english_name || '-'}）；每张图片不能超过 ${formatUploadImageMaxSize(uploadImageMaxSizeBytes)}。` : null}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex min-h-52 items-center justify-center gap-3 text-sm text-muted-foreground">
              <Spinner />
              正在加载记录内容...
            </div>
          ) : error ? (
            <div className="flex min-h-52 flex-col items-center justify-center gap-4 text-center">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          ) : task && record && initialForm ? (
            <RecordEditorForm
              key={record.id}
              task={task}
              uploadImageMaxSizeBytes={uploadImageMaxSizeBytes}
              initialForm={initialForm}
              initialImages={initialImages}
              initialCoverImageId={initialCoverImageId}
              submitLabel="保存修改"
              submitErrorLabel="保存失败。"
              backTo={`${basePath}/${task.id}`}
              backLabel="返回任务"
              onUnauthorized={signOut}
              onSubmit={async (payload) => {
                await unwrapResponse(createApiClient().teacher.records({ id: record.id }).put(payload));
                toastSuccess('记录已更新。');
                navigate(`${basePath}/${task.id}`, { replace: true });
              }}
            />
          ) : null}
        </CardContent>
      </Card>
    </PageFrame>
  );
}
