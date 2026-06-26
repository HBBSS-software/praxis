import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiResponseError, createApiClient, formatUploadImageMaxSize, unwrapResponse } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { toastError, toastSuccess } from '@/lib/feedback';
import { getServerUtcDateInputValue, normalizeDateInputValue } from '@/lib/format';
import { useRuntimeConfig } from '@/lib/runtime-config';
import type { PracticeTaskSummary, StudentRecord } from '@/lib/types';
import {
  createExistingRecordImageItem,
  RecordEditorForm,
  type RecordEditorFormValues,
  type RecordEditorImageItem
} from '@/shared/record-editor-form';
import { ErrorCard, LoadingCard, StudentPageFrame } from './shared';

export function StudentUploadPage() {
  const { signOut } = useSession();
  const runtimeConfig = useRuntimeConfig();
  const uploadImageMaxSizeBytes = runtimeConfig.upload_image_max_size_bytes;
  const defaultPracticeDate = getServerUtcDateInputValue(runtimeConfig.client_time_offset_ms);
  const navigate = useNavigate();
  const { taskId: taskIdParam } = useParams();
  const taskId = Number(taskIdParam);
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [task, setTask] = useState<PracticeTaskSummary | null>(null);
  const [initialForm, setInitialForm] = useState<RecordEditorFormValues | null>(null);
  const [initialImages, setInitialImages] = useState<RecordEditorImageItem[]>([]);
  const [initialCoverImageId, setInitialCoverImageId] = useState('');

  useEffect(() => {
    if (!Number.isInteger(taskId) || taskId <= 0) return;

    setLoading(true);
    setError('');

    unwrapResponse<{ task: PracticeTaskSummary; records: StudentRecord[] }>(createApiClient().student.tasks({ id: taskId }).get())
      .then((data) => {
        setTask(data.task);

        if (editId) {
          const record = data.records.find((item) => String(item.id) === editId);
          if (!record || (record.status !== 'pending' && record.status !== 'rejected')) {
            toastError(new Error('无法编辑该记录或记录不存在。'));
            navigate(`/student/tasks/${taskId}`, { replace: true });
            return;
          }

          setInitialForm({
            title: record.title,
            content: record.content,
            practice_date: normalizeDateInputValue(record.practice_date),
            location: record.location ?? '',
            duration: String(record.duration)
          });
          const recordImages = record.image_paths.map(createExistingRecordImageItem);
          setInitialImages(recordImages);
          setInitialCoverImageId(record.cover_image_path ?? recordImages[0]?.id ?? '');
          return;
        }

        setInitialForm({
          title: '',
          content: '',
          practice_date: defaultPracticeDate,
          location: '',
          duration: ''
        });
        setInitialImages([]);
        setInitialCoverImageId('');
      })
      .catch((nextError) => {
        if (nextError instanceof ApiResponseError && nextError.status === 401) {
          signOut();
          return;
        }
        setError(nextError instanceof Error ? nextError.message : '加载任务失败。');
      })
      .finally(() => setLoading(false));
  }, [defaultPracticeDate, editId, navigate, signOut, taskId]);

  return (
    <StudentPageFrame
      title={editId ? '编辑实践记录' : '上传实践记录'}
      description={task?.title}
    >
      <Card>
        <CardHeader>
          <CardTitle>{editId ? '保存修改' : '填写记录内容'}</CardTitle>
          <CardDescription>实践日期不能晚于今天；时长至少 0.1 小时；每张图片不能超过 {formatUploadImageMaxSize(uploadImageMaxSizeBytes)}。</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingCard label="正在加载记录内容..." />
          ) : error ? (
            <ErrorCard message={error} onRetry={() => navigate('/student/tasks', { replace: true })} />
          ) : task && initialForm ? (
            <RecordEditorForm
              key={editId ?? `new-${defaultPracticeDate}`}
              task={task}
              uploadImageMaxSizeBytes={uploadImageMaxSizeBytes}
              initialForm={initialForm}
              initialImages={initialImages}
              initialCoverImageId={initialCoverImageId}
              submitLabel={editId ? '保存修改' : '提交记录'}
              backTo={`/student/tasks/${task.id}`}
              backLabel="返回任务"
              onUnauthorized={signOut}
              onSubmit={async (payload) => {
                const api = createApiClient();

                if (editId) {
                  await unwrapResponse(api.student.records({ id: Number(editId) }).put(payload));
                } else {
                  await unwrapResponse(api.student.records.post({
                    ...payload,
                    task_id: task.id
                  }));
                }

                toastSuccess(editId ? '记录更新成功。' : '记录提交成功。');
                navigate(`/student/tasks/${task.id}`, { replace: true });
              }}
            />
          ) : null}
        </CardContent>
      </Card>
    </StudentPageFrame>
  );
}
