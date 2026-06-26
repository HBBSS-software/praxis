import { ImagePlus } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { AuthenticatedImage } from '@/shared/authenticated-image';
import { DatePickerField } from '@/shared/date-picker-field';
import { PhotoSwipeImageGallery } from '@/shared/photoswipe-image-gallery';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { ApiResponseError, formatUploadImageMaxSize, uploadImage, validateUploadImageFiles } from '@/lib/api';
import { toastError } from '@/lib/feedback';
import { useRuntimeConfig } from '@/lib/runtime-config';
import { limitTextLength } from '@/lib/text';
import { MAX_RECORD_IMAGES } from '@/lib/types';

export type RecordEditorFormValues = {
  title: string;
  content: string;
  practice_date: string;
  location: string;
  duration: string;
};

export type RecordEditorImageItem = {
  id: string;
  file?: File;
  path?: string;
  preview: string;
};

export type RecordEditorSubmitPayload = {
  title: string;
  content: string;
  practice_date: string;
  location: string | null;
  duration: string;
  image_paths: string[];
  cover_image_path: string | null;
};

export function createLocalRecordImageItem(file: File): RecordEditorImageItem {
  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
    file,
    preview: URL.createObjectURL(file)
  };
}

export function createExistingRecordImageItem(imagePath: string): RecordEditorImageItem {
  return {
    id: imagePath,
    path: imagePath,
    preview: imagePath
  };
}

export function RecordEditorForm({
  task,
  uploadImageMaxSizeBytes,
  initialForm,
  initialImages = [],
  initialCoverImageId = '',
  submitLabel,
  submittingLabel = '提交中...',
  submitErrorLabel = '提交失败。',
  backTo,
  backLabel,
  onUnauthorized,
  onSubmit
}: {
  task: { id: number; min_words: number; min_images: number };
  uploadImageMaxSizeBytes: number;
  initialForm: RecordEditorFormValues;
  initialImages?: RecordEditorImageItem[];
  initialCoverImageId?: string;
  submitLabel: string;
  submittingLabel?: string;
  submitErrorLabel?: string;
  backTo: string;
  backLabel: ReactNode;
  onUnauthorized?: () => void;
  onSubmit: (payload: RecordEditorSubmitPayload) => Promise<void>;
}) {
  const {
    content_max_length: contentMaxLength,
    location_max_length: locationMaxLength,
    record_title_max_length: recordTitleMaxLength
  } = useRuntimeConfig();
  const [form, setForm] = useState(initialForm);
  const [images, setImages] = useState(initialImages);
  const [coverImageId, setCoverImageId] = useState(initialCoverImageId);
  const [submitting, setSubmitting] = useState(false);
  const localPreviewUrls = useRef(new Set<string>());

  useEffect(() => {
    setForm(initialForm);
    setImages(initialImages);
    setCoverImageId(initialCoverImageId);
  }, [initialCoverImageId, initialForm, initialImages]);

  useEffect(() => () => {
    for (const previewUrl of localPreviewUrls.current) {
      URL.revokeObjectURL(previewUrl);
    }
    localPreviewUrls.current.clear();
  }, []);

  const remainingImageSlots = MAX_RECORD_IMAGES - images.length;

  return (
    <form
      className="grid gap-4 sm:gap-5 lg:grid-cols-[1.1fr_0.9fr]"
      onSubmit={async (event) => {
        event.preventDefault();
        setSubmitting(true);

        try {
          if (images.length > MAX_RECORD_IMAGES) {
            throw new Error(`每条记录最多上传 ${MAX_RECORD_IMAGES} 张图片。`);
          }
          if (form.content.trim().length < task.min_words) {
            throw new Error(`实践内容不能少于 ${task.min_words} 字。`);
          }
          if (images.length < task.min_images) {
            throw new Error(`至少需要上传 ${task.min_images} 张图片。`);
          }

          const uploadedImages = await Promise.all(images.map(async (image) => {
            if (image.path) {
              return {
                id: image.id,
                path: image.path
              };
            }

            const uploadResult = await uploadImage(image.file!, uploadImageMaxSizeBytes);
            return {
              id: image.id,
              path: uploadResult.imageUrl
            };
          }));
          const imagePaths = uploadedImages.map((image) => image.path);
          const coverImagePath = uploadedImages.find((image) => image.id === coverImageId)?.path ?? imagePaths[0] ?? null;

          await onSubmit({
            title: form.title.trim(),
            content: form.content.trim(),
            practice_date: form.practice_date,
            location: form.location.trim() || null,
            duration: form.duration.trim(),
            image_paths: imagePaths,
            cover_image_path: coverImagePath
          });
        } catch (nextError) {
          if (nextError instanceof ApiResponseError && nextError.status === 401 && onUnauthorized) {
            onUnauthorized();
            return;
          }
          toastError(nextError, submitErrorLabel);
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <div className="space-y-4 sm:space-y-5">
        <RecordEditorField label="标题">
          <Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: limitTextLength(event.target.value, recordTitleMaxLength) }))} required />
        </RecordEditorField>
        <RecordEditorField label="实践内容">
          <Textarea value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: limitTextLength(event.target.value, contentMaxLength) }))} required />
        </RecordEditorField>
        <div className="grid gap-4 md:grid-cols-2">
          <RecordEditorField label="实践日期">
            <DatePickerField value={form.practice_date} onChange={(value) => setForm((current) => ({ ...current, practice_date: value }))} placeholder="选择实践日期" />
          </RecordEditorField>
          <RecordEditorField label="时长（小时）">
            <Input type="number" min="0.1" step="0.1" value={form.duration} onChange={(event) => setForm((current) => ({ ...current, duration: event.target.value }))} required />
          </RecordEditorField>
        </div>
        <RecordEditorField label="地点">
          <Input value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: limitTextLength(event.target.value, locationMaxLength) }))} />
        </RecordEditorField>
        <div className="flex flex-wrap gap-3">
          <Button disabled={submitting} type="submit">
            {submitting ? <Spinner className="size-4 text-current" /> : null}
            {submitting ? submittingLabel : submitLabel}
          </Button>
          <Button variant="ghost" asChild>
            <Link to={backTo}>{backLabel}</Link>
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <RecordEditorField label="实践图片">
          <label className="group flex min-h-28 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-muted/20 p-4 text-center transition hover:bg-muted/40 has-disabled:pointer-events-none has-disabled:opacity-60">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
              <ImagePlus className="size-5" />
            </div>
            <div>
              <p className="text-sm font-medium">选择图片</p>
              <p className="mt-1 text-xs text-muted-foreground">最多 {MAX_RECORD_IMAGES} 张，单张最大 {formatUploadImageMaxSize(uploadImageMaxSizeBytes)}</p>
            </div>
            <input
              className="hidden"
              type="file"
              accept="image/jpeg,image/png,image/gif"
              disabled={remainingImageSlots <= 0}
              multiple
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                if (files.length === 0) {
                  return;
                }

                try {
                  if (files.length > remainingImageSlots) {
                    throw new Error(`还能选择 ${remainingImageSlots} 张图片。`);
                  }
                  validateUploadImageFiles(files, uploadImageMaxSizeBytes);
                } catch (nextError) {
                  event.target.value = '';
                  toastError(nextError);
                  return;
                }

                const nextImages = files.map(createLocalRecordImageItem);
                for (const image of nextImages) {
                  localPreviewUrls.current.add(image.preview);
                }
                setImages((current) => {
                  const merged = [...current, ...nextImages];
                  if (!coverImageId && merged[0]) {
                    setCoverImageId(merged[0].id);
                  }
                  return merged;
                });
                event.target.value = '';
              }}
            />
          </label>
        </RecordEditorField>
        {images.length > 0 ? (
          <PhotoSwipeImageGallery
            className="grid grid-cols-2 gap-3 sm:grid-cols-3"
            images={images.map((image) => ({
              src: image.preview,
              alt: '实践图片',
              downloadName: image.file?.name
            }))}
          >
            {({ image: previewImage, index, previewProps }) => {
              const recordImage = images[index];

              return (
                <div key={recordImage.id} className="space-y-2 rounded-2xl bg-muted p-2">
                  <a className="block cursor-zoom-in" {...previewProps}>
                    <AuthenticatedImage
                      className="aspect-square w-full rounded-md object-cover"
                      placeholderClassName="flex aspect-square w-full items-center justify-center rounded-md bg-muted/40"
                      src={previewImage.src}
                      alt={previewImage.alt ?? '实践图片'}
                    />
                  </a>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      type="button"
                      variant={coverImageId === recordImage.id ? 'default' : 'outline'}
                      onClick={() => setCoverImageId(recordImage.id)}
                    >
                      封面
                    </Button>
                    <Button
                      size="sm"
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        if (recordImage.file) {
                          URL.revokeObjectURL(recordImage.preview);
                          localPreviewUrls.current.delete(recordImage.preview);
                        }
                        setImages((current) => {
                          const nextImages = current.filter((item) => item.id !== recordImage.id);
                          if (coverImageId === recordImage.id) {
                            setCoverImageId(nextImages[0]?.id ?? '');
                          }
                          return nextImages;
                        });
                      }}
                    >
                      移除
                    </Button>
                  </div>
                </div>
              );
            }}
          </PhotoSwipeImageGallery>
        ) : null}
      </div>
    </form>
  );
}

function RecordEditorField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
